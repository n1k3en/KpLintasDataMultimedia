var express = require('express');
var router = express.Router();
var db = require('../config/db');
var Tagihan = require('../models/Tagihan');
var verifyToken = require('../middleware/auth');

// Protect all routes with admin token (accessible by operational Admin only, not Super Admin)
router.use(verifyToken);
router.use(verifyToken.requireAdminOnly);

/* GET /api/tagihan - List semua tagihan dengan filter lengkap */
router.get('/', function (req, res) {
  var { periode, status, q, search, page, limit } = req.query;
  var searchText = (q || search || '').trim();

  var pageNum = Math.max(1, parseInt(page, 10) || 1);
  var limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  var offset = (pageNum - 1) * limitNum;

  var whereConditions = [];
  var queryParams = [];

  if (periode && periode !== 'semua') {
    whereConditions.push('t.periode = ?');
    queryParams.push(periode);
  }

  if (status && status !== 'semua') {
    if (status === 'terlambat') {
      whereConditions.push('(t.status = ? OR (t.status != ? AND t.due_date < CURDATE()))');
      queryParams.push('terlambat', 'lunas');
    } else if (status === 'belum_bayar') {
      whereConditions.push('(t.status = ? OR t.status = ?)');
      queryParams.push('belum_bayar', 'terlambat');
    } else {
      whereConditions.push('t.status = ?');
      queryParams.push(status);
    }
  }

  if (searchText) {
    whereConditions.push('(p.nama LIKE ? OR p.no_hp LIKE ? OR p.pppoe_username LIKE ? OR CAST(t.id_tagihan AS CHAR) LIKE ?)');
    var keyword = '%' + searchText + '%';
    queryParams.push(keyword, keyword, keyword, keyword);
  }

  var whereSql = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

  var countSql = `
    SELECT COUNT(*) AS total 
    FROM tagihan t 
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
    ${whereSql}
  `;

  var dataSql = `
    SELECT 
      t.id_tagihan, t.id_pelanggan, t.periode, t.nominal, t.status, t.due_date, t.created_at, t.updated_at,
      p.nama, p.no_hp, p.alamat, p.pppoe_username, p.pppoe_status, p.paket, p.email,
      pem.id_pembayaran, pem.bukti_file, pem.status AS status_pembayaran
    FROM tagihan t 
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
    LEFT JOIN (
      SELECT p1.id_tagihan, p1.id_pembayaran, p1.bukti_file, p1.status 
      FROM pembayaran p1
      INNER JOIN (
        SELECT id_tagihan, MAX(id_pembayaran) AS max_id 
        FROM pembayaran 
        GROUP BY id_tagihan
      ) p2 ON p1.id_pembayaran = p2.max_id
    ) pem ON t.id_tagihan = pem.id_tagihan
    ${whereSql}
    ORDER BY t.due_date DESC, t.id_tagihan DESC
    LIMIT ? OFFSET ?
  `;

  db.query(countSql, queryParams, function (countErr, countRows) {
    if (countErr) {
      return res.status(500).json({ success: false, message: 'Database error', error: countErr.message });
    }

    var total = countRows[0].total;

    var paginationParams = [...queryParams, limitNum, offset];
    db.query(dataSql, paginationParams, function (dataErr, rows) {
      if (dataErr) {
        return res.status(500).json({ success: false, message: 'Database error', error: dataErr.message });
      }

      res.json({
        success: true,
        data: rows,
        pagination: {
          total: total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    });
  });
});

/* GET /api/tagihan/stats - Statistik ringkasan tagihan */
router.get('/stats', function (req, res) {
  var { periode } = req.query;
  var whereSql = '';
  var params = [];

  if (periode && periode !== 'semua') {
    whereSql = 'WHERE periode = ?';
    params.push(periode);
  }

  var sql = `
    SELECT 
      status, 
      COUNT(*) AS total_count, 
      COALESCE(SUM(nominal), 0) AS total_nominal 
    FROM tagihan 
    ${whereSql}
    GROUP BY status
  `;

  db.query(sql, params, function (err, rows) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    var stats = {
      belum_bayar: { count: 0, nominal: 0 },
      menunggu_verifikasi: { count: 0, nominal: 0 },
      lunas: { count: 0, nominal: 0 },
      terlambat: { count: 0, nominal: 0 },
      total_count: 0,
      total_nominal: 0,
      // Flat properties for frontend direct consumption
      total_tagihan: 0,
      total_unpaid: 0,
      nominal_unpaid: 0,
      total_pending: 0,
      nominal_pending: 0,
      total_paid: 0,
      nominal_paid: 0
    };

    rows.forEach(function (r) {
      if (stats[r.status]) {
        stats[r.status].count = r.total_count;
        stats[r.status].nominal = parseFloat(r.total_nominal);
      }
      stats.total_count += r.total_count;
      stats.total_nominal += parseFloat(r.total_nominal);
    });

    stats.total_tagihan = stats.total_count;
    stats.total_unpaid = stats.belum_bayar.count + stats.terlambat.count;
    stats.nominal_unpaid = stats.belum_bayar.nominal + stats.terlambat.nominal;
    stats.total_pending = stats.menunggu_verifikasi.count;
    stats.nominal_pending = stats.menunggu_verifikasi.nominal;
    stats.total_paid = stats.lunas.count;
    stats.nominal_paid = stats.lunas.nominal;

    res.json({ success: true, data: stats });
  });
});

/* GET /api/tagihan/:id - Detail tagihan */
router.get('/:id', function (req, res) {
  var id = req.params.id;
  var sql = `
    SELECT 
      t.*, 
      p.nama, p.no_hp, p.alamat, p.pppoe_username, p.pppoe_status, p.paket, p.email 
    FROM tagihan t 
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
    WHERE t.id_tagihan = ?
  `;

  db.query(sql, [id], function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan.' });
    }

    var bill = results[0];

    // Ambil histori pembayaran untuk tagihan ini
    var paymentSql = 'SELECT * FROM pembayaran WHERE id_tagihan = ? ORDER BY tanggal_upload DESC';
    db.query(paymentSql, [id], function (pemErr, payments) {
      bill.pembayaran_list = payments || [];
      res.json({ success: true, data: bill });
    });
  });
});

/* POST /api/tagihan - Terbitkan tagihan baru secara manual */
router.post('/', function (req, res) {
  var { id_pelanggan, periode, nominal, jumlah, due_date, status } = req.body;
  var finalNominal = nominal || jumlah;

  if (!id_pelanggan || !periode || !finalNominal || !due_date) {
    return res.status(400).json({ success: false, message: 'Pelanggan, periode, nominal/jumlah, dan jatuh tempo wajib diisi.' });
  }

  Tagihan.create({
    id_pelanggan: id_pelanggan,
    periode: periode,
    nominal: finalNominal,
    due_date: due_date,
    status: status || 'belum_bayar'
  }, function (err, result) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal menerbitkan tagihan', error: err.message });
    }

    res.status(201).json({
      success: true,
      message: 'Tagihan berhasil diterbitkan!',
      data: result
    });
  });
});

/* PUT /api/tagihan/:id - Ubah tagihan */
router.put('/:id', function (req, res) {
  var id = req.params.id;
  var { nominal, due_date, status } = req.body;

  var fields = [];
  var values = [];

  if (nominal !== undefined) { fields.push('nominal = ?'); values.push(nominal); }
  if (due_date !== undefined) { fields.push('due_date = ?'); values.push(due_date); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }

  if (fields.length === 0) {
    return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah.' });
  }

  values.push(id);
  var sql = 'UPDATE tagihan SET ' + fields.join(', ') + ', updated_at = NOW() WHERE id_tagihan = ?';

  db.query(sql, values, function (err, result) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal memperbarui tagihan', error: err.message });
    }

    res.json({ success: true, message: 'Tagihan berhasil diperbarui!' });
  });
});

/* DELETE /api/tagihan/:id - Hapus tagihan (hanya jika belum lunas) */
router.delete('/:id', function (req, res) {
  var id = req.params.id;

  db.query('SELECT status FROM tagihan WHERE id_tagihan = ?', [id], function (err, rows) {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan' });

    if (rows[0].status === 'lunas') {
      return res.status(400).json({ success: false, message: 'Tagihan yang sudah lunas tidak boleh dihapus demi integritas pembukuan.' });
    }

    db.query('DELETE FROM tagihan WHERE id_tagihan = ?', [id], function (delErr) {
      if (delErr) return res.status(500).json({ success: false, message: 'Gagal menghapus tagihan', error: delErr.message });
      res.json({ success: true, message: 'Tagihan berhasil dihapus.' });
    });
  });
});

module.exports = router;
