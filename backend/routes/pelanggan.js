var express = require('express');
var router = express.Router();
var Pelanggan = require('../models/Pelanggan');
var verifyToken = require('../middleware/auth');

// Semua route pelanggan butuh auth
router.use(verifyToken);

/* GET /api/pelanggan - List semua pelanggan */
router.get('/', function(req, res) {
  Pelanggan.getAll(function(err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil data pelanggan', error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

/* GET /api/pelanggan/stats - Statistik pelanggan untuk dashboard */
router.get('/stats', function(req, res) {
  Pelanggan.countActive(function(err, totalAktif) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil statistik', error: err.message });
    }

    Pelanggan.countByStatus(function(statusErr, statusData) {
      if (statusErr) {
        return res.status(500).json({ success: false, message: 'Gagal mengambil statistik status', error: statusErr.message });
      }

      var stats = {
        total_aktif: totalAktif,
        hijau: 0,
        kuning: 0,
        merah: 0,
        abu_abu: 0
      };

      statusData.forEach(function(item) {
        stats[item.status_tagihan] = item.total;
      });

      res.json({ success: true, data: stats });
    });
  });
});

/* GET /api/pelanggan/:id - Detail pelanggan */
router.get('/:id', function(req, res) {
  Pelanggan.getById(req.params.id, function(err, pelanggan) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (!pelanggan) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    }

    res.json({ success: true, data: pelanggan });
  });
});

/* POST /api/pelanggan - Tambah pelanggan baru */
router.post('/', async function(req, res) {
  var { nama, alamat, latitude, longitude, no_hp, email, pppoe_username, paket, due_date } = req.body;
  var MikrotikService = require('../services/mikrotik');

  if (!nama || !no_hp) {
    return res.status(400).json({ success: false, message: 'Nama dan nomor HP harus diisi.' });
  }

  try {
    // 1. Cek duplikat no_hp
    var existingNoHp = await new Promise((resolve, reject) => {
      Pelanggan.findByNoHp(no_hp, (err, result) => err ? reject(err) : resolve(result));
    });
    if (existingNoHp) {
      return res.status(400).json({ success: false, message: 'Nomor HP sudah terdaftar.' });
    }

    // 2. Cek duplikat email (jika diisi)
    if (email) {
      var emailNormalized = email.trim().toLowerCase();
      var existingEmail = await new Promise((resolve, reject) => {
        Pelanggan.findByEmail(emailNormalized, (err, result) => err ? reject(err) : resolve(result));
      });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });
      }
    }

    // 3. Cek duplikat pppoe_username (jika diisi)
    if (pppoe_username) {
      var existingPppoe = await new Promise((resolve, reject) => {
        Pelanggan.findByPppoe(pppoe_username, (err, result) => err ? reject(err) : resolve(result));
      });
      if (existingPppoe) {
        return res.status(400).json({ success: false, message: 'PPPoE Username sudah dikaitkan dengan pelanggan lain.' });
      }

      // 4. Validasi PPPoE Username di Mikrotik Router
      var pingRes = await MikrotikService.ping();
      if (pingRes.online) {
        var isValid = await MikrotikService.validateSecret(pppoe_username);
        if (!isValid) {
          return res.status(400).json({ success: false, message: `PPPoE Username "${pppoe_username}" tidak ditemukan di router Mikrotik.` });
        }
      } else {
        console.warn('Mikrotik offline during onboarding validation. Skipping check.');
      }
    }

    // 5. Buat pelanggan baru
    var result = await new Promise((resolve, reject) => {
      Pelanggan.create({
        nama: nama,
        alamat: alamat,
        latitude: latitude,
        longitude: longitude,
        no_hp: no_hp,
        email: email ? email.trim().toLowerCase() : null,
        pppoe_username: pppoe_username || '',
        paket: paket,
        due_date: due_date
      }, (err, resObj) => err ? reject(err) : resolve(resObj));
    });

    // 6. Buat tagihan awal otomatis jika due_date dan paket diset
    if (due_date && paket) {
      var db = require('../config/db');
      var nominal = await new Promise((resolve) => {
        db.query('SELECT harga FROM paket_layanan WHERE nama_paket = ?', [paket], (err, rows) => {
          resolve(rows && rows[0] ? rows[0].harga : 0);
        });
      });

      if (nominal > 0) {
        var parts = due_date.split('-');
        var period = parts[0] + '-' + parts[1];
        var Tagihan = require('../models/Tagihan');
        await new Promise((resolve) => {
          Tagihan.create({
            id_pelanggan: result.id_pelanggan,
            periode: period,
            nominal: nominal,
            status: 'belum_bayar',
            due_date: due_date
          }, () => resolve());
        });
      }
    }

    // Trigger billing check immediately in background to update status & send reminder if due
    var CronService = require('../services/cronService');
    CronService.checkAndSendReminders();

    res.status(201).json({
      success: true,
      message: 'Pelanggan berhasil ditambahkan!',
      data: result
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

/* PUT /api/pelanggan/:id - Update data pelanggan */
router.put('/:id', async function(req, res) {
  var id = req.params.id;
  var MikrotikService = require('../services/mikrotik');

  try {
    // 1. Get existing customer
    var pelanggan = await new Promise((resolve, reject) => {
      Pelanggan.getById(id, (err, result) => err ? reject(err) : resolve(result));
    });

    if (!pelanggan) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    }

    var updates = { ...req.body };

    // 2. Validate no_hp change
    if (updates.no_hp && updates.no_hp !== pelanggan.no_hp) {
      var existingNoHp = await new Promise((resolve, reject) => {
        Pelanggan.findByNoHp(updates.no_hp, (err, result) => err ? reject(err) : resolve(result));
      });
      if (existingNoHp && existingNoHp.id_pelanggan !== parseInt(id, 10)) {
        return res.status(400).json({ success: false, message: 'Nomor HP sudah terdaftar.' });
      }
    }

    // 3. Validate email change
    if (updates.email !== undefined) {
      var emailVal = updates.email ? updates.email.trim().toLowerCase() : null;
      updates.email = emailVal;
      
      if (emailVal && emailVal !== pelanggan.email) {
        var existingEmail = await new Promise((resolve, reject) => {
          Pelanggan.findByEmail(emailVal, (err, result) => err ? reject(err) : resolve(result));
        });
        if (existingEmail && existingEmail.id_pelanggan !== parseInt(id, 10)) {
          return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });
        }
      }
    }

    // 4. Validate pppoe_username change
    if (updates.pppoe_username !== undefined && updates.pppoe_username !== pelanggan.pppoe_username) {
      var pppoeVal = updates.pppoe_username || '';
      updates.pppoe_username = pppoeVal;

      if (pppoeVal) {
        // Uniqueness check
        var existingPppoe = await new Promise((resolve, reject) => {
          Pelanggan.findByPppoe(pppoeVal, (err, result) => err ? reject(err) : resolve(result));
        });
        if (existingPppoe && existingPppoe.id_pelanggan !== parseInt(id, 10)) {
          return res.status(400).json({ success: false, message: 'PPPoE Username sudah dikaitkan dengan pelanggan lain.' });
        }

        // Mikrotik validation
        var pingRes = await MikrotikService.ping();
        if (pingRes.online) {
          var isValid = await MikrotikService.validateSecret(pppoeVal);
          if (!isValid) {
            return res.status(400).json({ success: false, message: `PPPoE Username "${pppoeVal}" tidak ditemukan di router Mikrotik.` });
          }
        } else {
          console.warn('Mikrotik offline during update validation. Skipping check.');
        }
      }
    }

    var db = require('../config/db');

    // If due_date was updated:
    if (updates.due_date) {
      var parts = updates.due_date.split('-');
      var period = parts[0] + '-' + parts[1];

      // Calculate new billing status based on the new due_date
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var newDue = new Date(updates.due_date);
      newDue.setHours(0, 0, 0, 0);
      var daysDiff = Math.ceil((newDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      var targetBillStatus = 'belum_bayar';
      var targetCustomerStatus = 'hijau';
      if (daysDiff < 0) {
        targetBillStatus = 'terlambat';
        targetCustomerStatus = 'merah';
      } else if (daysDiff <= 3) {
        targetCustomerStatus = 'kuning';
      }

      // Check if this is extending the period (moving due_date to a future month)
      var oldPeriod = pelanggan.due_date ? pelanggan.due_date.toISOString().split('T')[0].substring(0, 7) : '';
      var isExtending = oldPeriod && period > oldPeriod;

      if (isExtending) {
        // Find unpaid tagihan for the old period
        var oldUnpaidTagihan = await new Promise((resolve) => {
          db.query("SELECT * FROM tagihan WHERE id_pelanggan = ? AND periode = ? AND status != 'lunas'", [id, oldPeriod], (err, rows) => {
            resolve(rows && rows[0] ? rows[0] : null);
          });
        });

        if (oldUnpaidTagihan) {
          // 1. Mark the old period's tagihan as 'lunas' (paid)
          await new Promise((resolve) => {
            db.query("UPDATE tagihan SET status = 'lunas', updated_at = NOW() WHERE id_tagihan = ?", [oldUnpaidTagihan.id_tagihan], () => resolve());
          });

          // 2. Record payment in pembayaran table so it shows up in reports
          await new Promise((resolve) => {
            db.query(
              "INSERT INTO pembayaran (id_tagihan, bukti_file, status, tanggal_upload, verified_at, id_admin) VALUES (?, 'Bayar Tunai / Diubah Admin', 'diterima', NOW(), NOW(), ?)",
              [oldUnpaidTagihan.id_tagihan, req.adminId || null],
              () => resolve()
            );
          });
        }

        // 3. Create or update the tagihan for the new period
        var existingPeriodTagihan = await new Promise((resolve) => {
          db.query("SELECT * FROM tagihan WHERE id_pelanggan = ? AND periode = ?", [id, period], (err, rows) => {
            resolve(rows && rows[0] ? rows[0] : null);
          });
        });

        if (existingPeriodTagihan) {
          await new Promise((resolve) => {
            db.query("UPDATE tagihan SET due_date = ?, status = ? WHERE id_tagihan = ?", [updates.due_date, targetBillStatus, existingPeriodTagihan.id_tagihan], () => resolve());
          });
        } else {
          var pkg = updates.paket || pelanggan.paket;
          if (pkg) {
            var nominal = await new Promise((resolve) => {
              db.query('SELECT harga FROM paket_layanan WHERE nama_paket = ?', [pkg], (err, rows) => {
                resolve(rows && rows[0] ? rows[0].harga : 0);
              });
            });

            if (nominal > 0) {
              var Tagihan = require('../models/Tagihan');
              await new Promise((resolve) => {
                Tagihan.create({
                  id_pelanggan: id,
                  periode: period,
                  nominal: nominal,
                  status: targetBillStatus,
                  due_date: updates.due_date
                }, () => resolve());
              });
            }
          }
        }

      } else {
        // Standard non-extending logic (e.g. adjusting date within the same month, or moving back)
        // Check if a tagihan for this specific period already exists
        var existingPeriodTagihan = await new Promise((resolve) => {
          db.query("SELECT * FROM tagihan WHERE id_pelanggan = ? AND periode = ?", [id, period], (err, rows) => {
            resolve(rows && rows[0] ? rows[0] : null);
          });
        });

        if (existingPeriodTagihan) {
          // Revert it to unpaid/late and set its new due date
          await new Promise((resolve) => {
            db.query("UPDATE tagihan SET due_date = ?, status = ? WHERE id_tagihan = ?", [updates.due_date, targetBillStatus, existingPeriodTagihan.id_tagihan], (err) => {
              resolve();
            });
          });
          
          // Delete any future unpaid tagihan (since we reverted the current one)
          await new Promise((resolve) => {
            db.query("DELETE FROM tagihan WHERE id_pelanggan = ? AND periode > ? AND status != 'lunas'", [id, period], () => {
              resolve();
            });
          });
        } else {
          // Find any active unpaid tagihan (e.g. future period) to shift back to this period
          var activeTagihan = await new Promise((resolve) => {
            db.query("SELECT * FROM tagihan WHERE id_pelanggan = ? AND status != 'lunas' ORDER BY due_date ASC LIMIT 1", [id], (err, rows) => {
              resolve(rows && rows[0] ? rows[0] : null);
            });
          });

          if (activeTagihan) {
            await new Promise((resolve) => {
              db.query("UPDATE tagihan SET due_date = ?, periode = ?, status = ? WHERE id_tagihan = ?", [updates.due_date, period, targetBillStatus, activeTagihan.id_tagihan], (err) => {
                resolve();
              });
            });
          } else {
            // Create a new unpaid bill
            var pkg = updates.paket || pelanggan.paket;
            if (pkg) {
              var nominal = await new Promise((resolve) => {
                db.query('SELECT harga FROM paket_layanan WHERE nama_paket = ?', [pkg], (err, rows) => {
                  resolve(rows && rows[0] ? rows[0].harga : 0);
                });
              });

              if (nominal > 0) {
                var Tagihan = require('../models/Tagihan');
                await new Promise((resolve) => {
                  Tagihan.create({
                    id_pelanggan: id,
                    periode: period,
                    nominal: nominal,
                    status: targetBillStatus,
                    due_date: updates.due_date
                  }, () => resolve());
                });
              }
            }
          }
        }
      }

      // Also set updates.status_tagihan to match the new due_date calculated status
      updates.status_tagihan = targetCustomerStatus;
    }

    // If paket was updated, sync nominal of all unpaid tagihans for this customer
    if (updates.paket) {
      var nominal = await new Promise((resolve) => {
        db.query('SELECT harga FROM paket_layanan WHERE nama_paket = ?', [updates.paket], (err, rows) => {
          resolve(rows && rows[0] ? rows[0].harga : null);
        });
      });

      if (nominal !== null) {
        await new Promise((resolve) => {
          db.query("UPDATE tagihan SET nominal = ? WHERE id_pelanggan = ? AND status != 'lunas'", [nominal, id], () => {
            resolve();
          });
        });
      }
    }

    // 5. Perform update
    await new Promise((resolve, reject) => {
      Pelanggan.update(id, updates, (err, result) => err ? reject(err) : resolve(result));
    });

    // Trigger billing check immediately in background to update status & send reminder if due
    var CronService = require('../services/cronService');
    CronService.checkAndSendReminders();

    res.json({
      success: true,
      message: 'Data pelanggan berhasil diupdate!'
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

/* DELETE /api/pelanggan/:id - Hapus pelanggan */
router.delete('/:id', function(req, res) {
  var id = req.params.id;

  Pelanggan.getById(id, function(err, pelanggan) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (!pelanggan) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    }

    Pelanggan.delete(id, function(deleteErr, result) {
      if (deleteErr) {
        return res.status(500).json({ success: false, message: 'Gagal menghapus pelanggan', error: deleteErr.message });
      }

      res.json({
        success: true,
        message: 'Pelanggan berhasil dihapus.'
      });
    });
  });
});

module.exports = router;
