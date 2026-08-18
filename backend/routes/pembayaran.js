var express = require('express');
var router = express.Router();
var Pembayaran = require('../models/Pembayaran');
var Tagihan = require('../models/Tagihan');
var Pelanggan = require('../models/Pelanggan');
var MikrotikService = require('../services/mikrotik');
var EmailService = require('../services/emailService');
var PdfService = require('../services/pdfService');
var SocketService = require('../services/socket');
var verifyToken = require('../middleware/auth');

// Protect all payment verification routes with Admin JWT
router.use(verifyToken);

/* GET /api/pembayaran/pending - Get all pending payment approvals */
router.get('/pending', function (req, res) {
  Pembayaran.getAllPending(function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

/* GET /api/pembayaran/midtrans - Get all Midtrans online payments */
router.get('/midtrans', function (req, res) {
  var db = require('../config/db');
  var sql = `
    SELECT 
      pem.*, 
      t.periode, 
      t.nominal, 
      p.nama, 
      p.no_hp
    FROM pembayaran pem
    JOIN tagihan t ON pem.id_tagihan = t.id_tagihan
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
    WHERE pem.bukti_file LIKE 'Midtrans%'
    ORDER BY pem.tanggal_upload DESC
  `;
  db.query(sql, function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

/* GET /api/pembayaran/duitku - Get all Duitku online payments */
router.get('/duitku', function (req, res) {
  var db = require('../config/db');
  var sql = `
    SELECT 
      pem.*, 
      t.periode, 
      t.nominal, 
      p.nama, 
      p.no_hp
    FROM pembayaran pem
    JOIN tagihan t ON pem.id_tagihan = t.id_tagihan
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
    WHERE pem.bukti_file LIKE 'Duitku%'
    ORDER BY pem.tanggal_upload DESC
  `;
  db.query(sql, function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

/* GET /api/pembayaran/manual - Get all approved manual-transfer payments */
router.get('/manual', function (req, res) {
  Pembayaran.getAllApprovedManual(function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

/* POST /api/pembayaran/:id/approve - Approve payment proof */
router.post('/:id/approve', function (req, res) {
  var id_pembayaran = req.params.id;
  var id_admin = req.adminId; // extracted from verifyToken middleware

  Pembayaran.getById(id_pembayaran, function (err, payment) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Data konfirmasi pembayaran tidak ditemukan.' });
    }

    // 1. Set pembayaran status to 'diterima'
    Pembayaran.verify(id_pembayaran, {
      status: 'diterima',
      alasan_tolak: null,
      id_admin: id_admin
    }, function (verifyErr, result) {
      if (verifyErr) {
        return res.status(500).json({ success: false, message: 'Gagal memverifikasi pembayaran.' });
      }

      if (!result || result.affectedRows === 0) {
        return res.status(409).json({ success: false, message: 'Pembayaran ini sudah diverifikasi atau ditolak oleh admin lain.' });
      }

      // 2. Set tagihan status to 'lunas'
      Tagihan.updateStatus(payment.id_tagihan, 'lunas', function (tagihanErr) {
        if (tagihanErr) {
          return res.status(500).json({ success: false, message: 'Gagal memperbarui status tagihan.' });
        }

        // 3. Update pelanggan: set status to 'hijau' and extend due_date by 30 days
        var currentDueDate = new Date(payment.due_date);
        var newDueDate = new Date(currentDueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        var newDueDateString = newDueDate.toISOString().split('T')[0];

        Pelanggan.update(payment.id_pelanggan, {
          status_tagihan: 'hijau',
          due_date: newDueDateString
        }, async function (pelangganErr) {
          if (pelangganErr) {
            console.error('Gagal memperbarui status pelanggan:', pelangganErr.message);
          }

          // 4. Generate next month's bill in tagihan table
          var parts = payment.periode.split('-');
          var year = parseInt(parts[0], 10);
          var month = parseInt(parts[1], 10);
          if (month === 12) {
            month = 1;
            year += 1;
          } else {
            month += 1;
          }
          var nextPeriod = year + '-' + (month < 10 ? '0' + month : month);

          // Query the customer's current package price to ensure nominal matches their package
          var db = require('../config/db');
          var nominal = await new Promise((resolve) => {
            db.query(`
              SELECT pl.harga 
              FROM pelanggan p 
              JOIN paket_layanan pl ON p.paket = pl.nama_paket 
              WHERE p.id_pelanggan = ?
            `, [payment.id_pelanggan], (err, rows) => {
              resolve(rows && rows[0] ? rows[0].harga : payment.nominal);
            });
          });

          Tagihan.create({
            id_pelanggan: payment.id_pelanggan,
            periode: nextPeriod,
            nominal: nominal,
            status: 'belum_bayar',
            due_date: newDueDateString
          }, async function (nextBillErr) {
            if (nextBillErr) {
              console.error('Gagal membuat tagihan periode berikutnya:', nextBillErr.message);
            } else {
              console.log(`Tagihan periode berikutnya (${nextPeriod}) berhasil dibuat untuk pelanggan ID ${payment.id_pelanggan}`);
            }

            // 5. Activate PPPoE in Mikrotik if username is present
            var pppoeStatus = 'unknown';
            if (payment.pppoe_username) {
              try {
                var mRes = await MikrotikService.enableSecret(payment.pppoe_username);
                if (mRes) pppoeStatus = 'active';
              } catch (mikrotikErr) {
                console.error(`Gagal mengaktifkan PPPoE ${payment.pppoe_username} di router:`, mikrotikErr.message);
              }
            }

            // 6. Send Email confirmation of approval with Paid Invoice PDF
            if (payment.email) {
              var dueDateFormatted = newDueDate.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              });

              var tglBayarStr = new Date(payment.tanggal_upload || new Date()).toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              var pdfBuffer = null;
              try {
                var custData = await new Promise(resolve => Pelanggan.getById(payment.id_pelanggan, (err, c) => resolve(c || {})));
                pdfBuffer = await PdfService.generateInvoicePdf({
                  id_tagihan: payment.id_tagihan,
                  periode: payment.periode,
                  nominal: payment.nominal,
                  status: 'lunas',
                  due_date: newDueDateString,
                  created_at: payment.tanggal_upload || new Date(),
                  nama: payment.nama,
                  email: payment.email,
                  no_hp: payment.no_hp || '-',
                  alamat: custData.alamat || '-',
                  paket: custData.paket || '-'
                }, true);
              } catch (pdfErr) {
                console.error('[Pembayaran] Gagal membuat PDF invoice lunas:', pdfErr.message);
              }

              await EmailService.sendPaymentApprovedEmail(payment.email, {
                nama: payment.nama,
                periode: payment.periode,
                nominal: Number(payment.nominal).toLocaleString('id-ID'),
                dueDateFormatted: dueDateFormatted,
                tanggalBayar: tglBayarStr,
                metodePembayaran: 'Manual Transfer Bank'
              }, pdfBuffer);
            } else {
              console.log('[Pembayaran] Pelanggan tidak memiliki email, notifikasi dilewati.');
            }

            // 7. Broadcast websocket updates to all clients
            SocketService.broadcast('pelanggan_updated', {
              id_pelanggan: payment.id_pelanggan,
              status_tagihan: 'hijau',
              pppoe_status: pppoeStatus
            });

            res.json({
              success: true,
              message: 'Pembayaran disetujui! Status pelanggan lunas, masa aktif diperpanjang, dan akun internet diaktifkan.'
            });
          });
        });
      });
    });
  });
});

/* POST /api/pembayaran/:id/reject - Reject payment proof */
router.post('/:id/reject', function (req, res) {
  var id_pembayaran = req.params.id;
  var id_admin = req.adminId;
  var { alasan_tolak } = req.body;

  if (!alasan_tolak) {
    return res.status(400).json({ success: false, message: 'Alasan penolakan wajib diisi.' });
  }

  Pembayaran.getById(id_pembayaran, function (err, payment) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Data konfirmasi pembayaran tidak ditemukan.' });
    }

    // 1. Set pembayaran status to 'ditolak'
    Pembayaran.verify(id_pembayaran, {
      status: 'ditolak',
      alasan_tolak: alasan_tolak,
      id_admin: id_admin
    }, function (verifyErr, result) {
      if (verifyErr) {
        return res.status(500).json({ success: false, message: 'Gagal memperbarui status verifikasi.' });
      }

      if (!result || result.affectedRows === 0) {
        return res.status(409).json({ success: false, message: 'Pembayaran ini sudah diverifikasi atau ditolak oleh admin lain.' });
      }

      // Calculate if the bill is late or just unpaid
      var today = new Date();
      var dueDate = new Date(payment.due_date);
      var isLate = today >= dueDate;
      var targetBillStatus = isLate ? 'terlambat' : 'belum_bayar';
      var targetCustomerStatus = isLate ? 'merah' : 'kuning';

      // 2. Revert tagihan status
      Tagihan.updateStatus(payment.id_tagihan, targetBillStatus, function (tagihanErr) {
        if (tagihanErr) {
          return res.status(500).json({ success: false, message: 'Gagal memperbarui status tagihan.' });
        }

        // 3. Revert pelanggan billing status
        Pelanggan.update(payment.id_pelanggan, { status_tagihan: targetCustomerStatus }, async function (pelangganErr) {
          if (pelangganErr) {
            console.error('Gagal memperbarui status pelanggan:', pelangganErr.message);
          }

          // 4. Send Email notification to customer with rejection reason
          if (payment.email) {
            var nominal = Number(payment.nominal).toLocaleString('id-ID');
            var paymentUrl = `${process.env.PAYMENT_PORTAL_URL || 'http://localhost:3001/bayar'}/${encodeURIComponent(payment.email)}`;

            await EmailService.sendPaymentRejectedEmail(payment.email, {
              nama: payment.nama,
              periode: payment.periode,
              nominal: nominal,
              alasan_tolak: alasan_tolak,
              paymentUrl: paymentUrl
            });
          } else {
            console.log('[Pembayaran] Pelanggan tidak memiliki email, notifikasi penolakan dilewati.');
          }

          // 5. Broadcast status updates
          SocketService.broadcast('pelanggan_updated', {
            id_pelanggan: payment.id_pelanggan,
            status_tagihan: targetCustomerStatus
          });

          // Trigger billing check immediately in background to update status & send reminder if due
          var CronService = require('../services/cronService');
          CronService.checkAndSendReminders();

          res.json({
            success: true,
            message: 'Pembayaran ditolak. Notifikasi penolakan telah dikirim ke Email pelanggan.'
          });
        });
      });
    });
  });
});

/* GET /api/pembayaran/invoice/:id_tagihan/pdf - Download or view PDF Invoice */
router.get('/invoice/:id_tagihan/pdf', function (req, res) {
  var idTagihan = req.params.id_tagihan;
  var db = require('../config/db');
  var sql = `
    SELECT t.*, p.nama, p.no_hp, p.email, p.alamat, p.paket 
    FROM tagihan t 
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
    WHERE t.id_tagihan = ?
  `;
  db.query(sql, [idTagihan], async function (err, results) {
    if (err || !results || results.length === 0) {
      return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan.' });
    }
    var bill = results[0];
    var isPaid = bill.status === 'lunas';
    try {
      var pdfBuffer = await PdfService.generateInvoicePdf(bill, isPaid);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Invoice_${bill.periode}_${idTagihan}.pdf"`);
      res.send(pdfBuffer);
    } catch (pdfErr) {
      res.status(500).json({ success: false, message: 'Gagal membuat PDF invoice', error: pdfErr.message });
    }
  });
});

module.exports = router;
