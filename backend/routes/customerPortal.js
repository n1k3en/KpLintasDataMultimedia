var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var axios = require('axios');
var db = require('../config/db');
var verifyCustomerToken = require('../middleware/customerAuth');
var SocketService = require('../services/socket');
var ConfigService = require('../services/configService');

// Duitku Webhook Callback Endpoint (Public - must be BEFORE verifyCustomerToken)
router.post('/duitku-callback', function (req, res) {
  var notification = req.body || {};

  // Support both urlencoded and json body params from Duitku
  var merchantCode = notification.merchantCode;
  var amount = notification.amount;
  var merchantOrderId = notification.merchantOrderId;
  var signature = notification.signature;
  var resultCode = notification.resultCode;
  var paymentMethod = notification.paymentCode || notification.paymentMethod || 'Duitku';

  if (!merchantCode || !amount || !merchantOrderId || !signature) {
    console.log('[Duitku Callback] Received incomplete payload / test ping.');
    return res.status(200).json({ success: true, message: 'Duitku Callback ping received successfully' });
  }

  var apiKey = ConfigService.get('DUITKU_API_KEY', process.env.DUITKU_API_KEY || '');

  // MD5 signature verification: md5(merchantCode + amount + merchantOrderId + apiKey)
  var rawString = merchantCode + amount + merchantOrderId + apiKey;
  var computedSignature = crypto.createHash('md5').update(rawString).digest('hex');

  if (computedSignature.toLowerCase() !== signature.toLowerCase()) {
    console.error('[Duitku Callback] Invalid Signature! Verification failed.');
    return res.status(200).json({ success: false, message: 'Invalid signature' });
  }

  // Parse id_tagihan from merchantOrderId (e.g. 'TRX-DUITKU-12-1783492810' or 'TRX-12-1783492810')
  var parts = merchantOrderId.split('-');
  var id_tagihan = null;
  for (var i = 0; i < parts.length; i++) {
    var val = parseInt(parts[i], 10);
    if (!isNaN(val) && val > 0) {
      id_tagihan = val;
      break;
    }
  }

  if (!id_tagihan) {
    console.error('[Duitku Callback] Failed to parse id_tagihan from merchantOrderId:', merchantOrderId);
    return res.status(200).json({ success: false, message: 'Invalid merchantOrderId format' });
  }

  console.log(`[Duitku Callback] Received status for Tagihan #${id_tagihan}: resultCode=${resultCode}, type=${paymentMethod}`);

  // ResultCode '00' indicates payment success in Duitku
  if (resultCode === '00') {
    // 1. Get Tagihan and Customer Info
    var selectSql = `
      SELECT t.*, p.nama, p.no_hp, p.email, p.pppoe_username, p.due_date 
      FROM tagihan t 
      JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
      WHERE t.id_tagihan = ?
    `;
    db.query(selectSql, [id_tagihan], function (err, results) {
      if (err) {
        console.error('[Duitku Callback] Database error:', err.message);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (results.length === 0) {
        console.error('[Duitku Callback] Tagihan not found for ID:', id_tagihan);
        return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan' });
      }

      var billing = results[0];

      // If already paid, do nothing
      if (billing.status === 'lunas') {
        console.log(`[Duitku Callback] Tagihan #${id_tagihan} is already lunas. Skipping duplicate processing.`);
        return res.json({ success: true, message: 'Tagihan sudah lunas.' });
      }

      // 2. Create Pembayaran entry with status 'diterima'
      var relativePath = 'Duitku / ' + paymentMethod + ' / success';
      var insertSql = `
        INSERT INTO pembayaran (id_tagihan, bukti_file, status, tanggal_upload, verified_at, id_admin) 
        VALUES (?, ?, 'diterima', NOW(), NOW(), NULL)
      `;
      db.query(insertSql, [id_tagihan, relativePath], function (err, paymentResult) {
        if (err) {
          console.error('[Duitku Callback] Failed to insert payment:', err.message);
          return res.status(500).json({ success: false, message: 'Failed to record payment' });
        }

        var id_pembayaran = paymentResult.insertId;

        // Insert notification
        db.query("INSERT INTO notifikasi (id_pembayaran) VALUES (?)", [id_pembayaran], function(notifErr) {
          if (notifErr) {
            console.error('[Duitku Callback] Failed to insert notification record:', notifErr.message);
          }
        });

        // 3. Update tagihan status to 'lunas'
        var TagihanModel = require('../models/Tagihan');
        TagihanModel.updateStatus(id_tagihan, 'lunas', function (tagihanErr) {
          if (tagihanErr) {
            console.error('[Duitku Callback] Failed to update tagihan status:', tagihanErr.message);
            return res.status(500).json({ success: false, message: 'Failed to update bill status' });
          }

          // 4. Update pelanggan: set status to 'hijau' and extend due_date by 30 days
          var currentDueDate = new Date(billing.due_date);
          var newDueDate = new Date(currentDueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
          var newDueDateString = newDueDate.toISOString().split('T')[0];

          var PelangganModel = require('../models/Pelanggan');
          PelangganModel.update(billing.id_pelanggan, {
            status_tagihan: 'hijau',
            due_date: newDueDateString
          }, async function (pelangganErr) {
            if (pelangganErr) {
              console.error('[Duitku Callback] Failed to update customer status:', pelangganErr.message);
            }

            // 5. Generate next month's bill
            var parts = billing.periode.split('-');
            var year = parseInt(parts[0], 10);
            var month = parseInt(parts[1], 10);
            if (month === 12) {
              month = 1;
              year += 1;
            } else {
              month += 1;
            }
            var nextPeriod = year + '-' + (month < 10 ? '0' + month : month);

            var nominal = await new Promise((resolve) => {
              db.query(`
                SELECT pl.harga 
                FROM pelanggan p 
                JOIN paket_layanan pl ON p.paket = pl.nama_paket 
                WHERE p.id_pelanggan = ?
              `, [billing.id_pelanggan], (err, rows) => {
                resolve(rows && rows[0] ? rows[0].harga : billing.nominal);
              });
            });

            TagihanModel.create({
              id_pelanggan: billing.id_pelanggan,
              periode: nextPeriod,
              nominal: nominal,
              status: 'belum_bayar',
              due_date: newDueDateString
            }, async function (nextBillErr) {
              if (nextBillErr) {
                console.error('[Duitku Callback] Failed to generate next month bill:', nextBillErr.message);
              }

              // 6. Enable PPPoE in Mikrotik
              var pppoeStatus = 'unknown';
              if (billing.pppoe_username) {
                try {
                  var MikrotikService = require('../services/mikrotik');
                  var mRes = await MikrotikService.enableSecret(billing.pppoe_username);
                  if (mRes) pppoeStatus = 'active';
                } catch (mikrotikErr) {
                  console.error(`[Duitku Callback] Failed to enable PPPoE ${billing.pppoe_username}:`, mikrotikErr.message);
                }
              }

              // 7. Send Email confirmation of approval
              if (billing.email) {
                try {
                  var EmailService = require('../services/emailService');
                  var dueDateFormatted = newDueDate.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  });

                  var tglBayarStr = new Date().toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  var pdfBuffer = null;
                  try {
                    var PdfService = require('../services/pdfService');
                    pdfBuffer = await PdfService.generateInvoicePdf({
                      id_tagihan: id_tagihan,
                      periode: billing.periode,
                      nominal: billing.nominal,
                      status: 'lunas',
                      due_date: newDueDateString,
                      created_at: new Date(),
                      nama: billing.nama,
                      email: billing.email,
                      no_hp: billing.no_hp || '-',
                      alamat: billing.alamat || '-',
                      paket: billing.paket || '-'
                    }, true);
                  } catch (pdfErr) {
                    console.error('[Duitku Callback] Failed to generate PDF invoice:', pdfErr.message);
                  }

                  await EmailService.sendPaymentApprovedEmail(billing.email, {
                    nama: billing.nama,
                    periode: billing.periode,
                    nominal: Number(billing.nominal).toLocaleString('id-ID'),
                    dueDateFormatted: dueDateFormatted,
                    tanggalBayar: tglBayarStr,
                    metodePembayaran: 'Duitku Gateway (' + paymentMethod + ')'
                  }, pdfBuffer);
                } catch (emailErr) {
                  console.error('[Duitku Callback] Failed to send confirmation email:', emailErr.message);
                }
              }

              // 8. Broadcast websocket updates
              SocketService.broadcast('pelanggan_updated', {
                id_pelanggan: billing.id_pelanggan,
                status_tagihan: 'hijau',
                pppoe_status: pppoeStatus
              });

              SocketService.broadcast('pembayaran_masuk', {
                id_pembayaran: id_pembayaran,
                id_tagihan: id_tagihan,
                nama_pelanggan: billing.nama,
                tanggal_upload: new Date()
              });

              console.log(`[Duitku Callback] Tagihan #${id_tagihan} successfully processed and re-activated!`);
              return res.json({ success: true, message: 'Pembayaran Duitku berhasil diproses!' });
            });
          });
        });
      });
    });
  } else {
    console.log(`[Duitku Callback] Acknowledging transaction status: resultCode=${resultCode}`);
    return res.json({ success: true, message: 'ResultCode callback received: ' + resultCode });
  }
});

// Midtrans Webhook Callback endpoint (Public - must be BEFORE verifyCustomerToken)
router.post('/midtrans-callback', function (req, res) {
  var notification = req.body;

  // Jika payload tidak lengkap (seperti ping test dari Midtrans Dashboard), berikan respon 200 OK agar tes berhasil
  if (!notification || !notification.order_id || !notification.status_code || !notification.gross_amount || !notification.signature_key) {
    console.log('[Midtrans Callback] Received dashboard ping / test request.');
    return res.status(200).json({ success: true, message: 'Test notification received successfully' });
  }

  var order_id = notification.order_id;
  var status_code = notification.status_code;
  var gross_amount = notification.gross_amount;
  var signature_key = notification.signature_key;

  var serverKey = process.env.MIDTRANS_SERVER_KEY || '';

  // Verify signature_key
  var payload = order_id + status_code + gross_amount + serverKey;
  var computedHash = crypto.createHash('sha512').update(payload).digest('hex');

  if (computedHash !== signature_key) {
    console.error('[Midtrans Callback] Invalid Signature Key! Verification failed.');
    // Tetap kembalikan 200 agar dashboard tidak error, namun dengan status sukses false
    return res.status(200).json({ success: false, message: 'Invalid signature key' });
  }

  // Parse id_tagihan from order_id (e.g. 'TRX-12-1783492810' -> id_tagihan = 12)
  var parts = order_id.split('-');
  var id_tagihan = parseInt(parts[1], 10);
  if (isNaN(id_tagihan)) {
    console.error('[Midtrans Callback] Failed to parse id_tagihan from order_id:', order_id);
    return res.status(200).json({ success: false, message: 'Invalid order ID format' });
  }

  var transaction_status = notification.transaction_status;
  var fraud_status = notification.fraud_status;
  var payment_type = notification.payment_type;

  console.log(`[Midtrans Callback] Received status for Tagihan #${id_tagihan}: status=${transaction_status}, type=${payment_type}`);

  // We consider success when status is settlement or capture with fraud accept
  var isSuccess = transaction_status === 'settlement' || (transaction_status === 'capture' && fraud_status === 'accept');

  if (isSuccess) {
    // 1. Get Tagihan and Customer Info
    var selectSql = `
      SELECT t.*, p.nama, p.no_hp, p.email, p.pppoe_username, p.due_date 
      FROM tagihan t 
      JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
      WHERE t.id_tagihan = ?
    `;
    db.query(selectSql, [id_tagihan], function (err, results) {
      if (err) {
        console.error('[Midtrans Callback] Database error:', err.message);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (results.length === 0) {
        console.error('[Midtrans Callback] Tagihan not found for ID:', id_tagihan);
        return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan' });
      }

      var billing = results[0];

      // If the bill is already paid, do nothing
      if (billing.status === 'lunas') {
        console.log(`[Midtrans Callback] Tagihan #${id_tagihan} is already lunas. Skipping duplicate processing.`);
        return res.json({ success: true, message: 'Tagihan sudah lunas.' });
      }

      // Proceed with approval flow
      // 2. Create Pembayaran entry with status 'diterima'
      var relativePath = 'Midtrans / ' + payment_type + ' / ' + transaction_status;
      var insertSql = `
        INSERT INTO pembayaran (id_tagihan, bukti_file, status, tanggal_upload, verified_at, id_admin) 
        VALUES (?, ?, 'diterima', NOW(), NOW(), NULL)
      `;
      db.query(insertSql, [id_tagihan, relativePath], function (err, paymentResult) {
        if (err) {
          console.error('[Midtrans Callback] Failed to insert payment:', err.message);
          return res.status(500).json({ success: false, message: 'Failed to record payment' });
        }

        var id_pembayaran = paymentResult.insertId;

        // Insert into notifikasi table to track payment notification
        db.query("INSERT INTO notifikasi (id_pembayaran) VALUES (?)", [id_pembayaran], function(notifErr) {
          if (notifErr) {
            console.error('[Midtrans Callback] Failed to insert notification record:', notifErr.message);
          }
        });

        // 3. Update tagihan status to 'lunas'
        var TagihanModel = require('../models/Tagihan');
        TagihanModel.updateStatus(id_tagihan, 'lunas', function (tagihanErr) {
          if (tagihanErr) {
            console.error('[Midtrans Callback] Failed to update tagihan status:', tagihanErr.message);
            return res.status(500).json({ success: false, message: 'Failed to update bill status' });
          }

          // 4. Update pelanggan: set status to 'hijau' and extend due_date by 30 days
          var currentDueDate = new Date(billing.due_date);
          var newDueDate = new Date(currentDueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
          var newDueDateString = newDueDate.toISOString().split('T')[0];

          var PelangganModel = require('../models/Pelanggan');
          PelangganModel.update(billing.id_pelanggan, {
            status_tagihan: 'hijau',
            due_date: newDueDateString
          }, async function (pelangganErr) {
            if (pelangganErr) {
              console.error('[Midtrans Callback] Failed to update customer status:', pelangganErr.message);
            }

            // 5. Generate next month's bill in tagihan table
            var parts = billing.periode.split('-');
            var year = parseInt(parts[0], 10);
            var month = parseInt(parts[1], 10);
            if (month === 12) {
              month = 1;
              year += 1;
            } else {
              month += 1;
            }
            var nextPeriod = year + '-' + (month < 10 ? '0' + month : month);

            // Get customer package price for accuracy
            var nominal = await new Promise((resolve) => {
              db.query(`
                SELECT pl.harga 
                FROM pelanggan p 
                JOIN paket_layanan pl ON p.paket = pl.nama_paket 
                WHERE p.id_pelanggan = ?
              `, [billing.id_pelanggan], (err, rows) => {
                resolve(rows && rows[0] ? rows[0].harga : billing.nominal);
              });
            });

            TagihanModel.create({
              id_pelanggan: billing.id_pelanggan,
              periode: nextPeriod,
              nominal: nominal,
              status: 'belum_bayar',
              due_date: newDueDateString
            }, async function (nextBillErr) {
              if (nextBillErr) {
                console.error('[Midtrans Callback] Failed to generate next month bill:', nextBillErr.message);
              }

              // 6. Enable PPPoE in Mikrotik if username is present
              var pppoeStatus = 'unknown';
              if (billing.pppoe_username) {
                try {
                  var MikrotikService = require('../services/mikrotik');
                  var mRes = await MikrotikService.enableSecret(billing.pppoe_username);
                  if (mRes) pppoeStatus = 'active';
                } catch (mikrotikErr) {
                  console.error(`[Midtrans Callback] Failed to enable PPPoE ${billing.pppoe_username}:`, mikrotikErr.message);
                }
              }

              // 7. Send Email confirmation of approval
              if (billing.email) {
                try {
                  var EmailService = require('../services/emailService');
                  var dueDateFormatted = newDueDate.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  });

                  var tglBayarStr = new Date().toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  var metodeMap = {
                    'bank_transfer': 'Midtrans (Virtual Account)',
                    'qris': 'Midtrans (QRIS)',
                    'credit_card': 'Midtrans (Kartu Kredit)',
                    'gopay': 'Midtrans (GoPay)',
                    'shopeepay': 'Midtrans (ShopeePay)',
                    'cstore': 'Midtrans (Minimarket)'
                  };
                  var metodeLengkap = metodeMap[payment_type] || ('Midtrans (' + payment_type.replace(/_/g, ' ') + ')');

                  var pdfBuffer = null;
                  try {
                    var PdfService = require('../services/pdfService');
                    pdfBuffer = await PdfService.generateInvoicePdf({
                      id_tagihan: id_tagihan,
                      periode: billing.periode,
                      nominal: billing.nominal,
                      status: 'lunas',
                      due_date: newDueDateString,
                      created_at: new Date(),
                      nama: billing.nama,
                      email: billing.email,
                      no_hp: billing.no_hp || '-',
                      alamat: billing.alamat || '-',
                      paket: billing.paket || '-'
                    }, true);
                  } catch (pdfErr) {
                    console.error('[Midtrans Callback] Failed to generate PDF invoice:', pdfErr.message);
                  }

                  await EmailService.sendPaymentApprovedEmail(billing.email, {
                    nama: billing.nama,
                    periode: billing.periode,
                    nominal: Number(billing.nominal).toLocaleString('id-ID'),
                    dueDateFormatted: dueDateFormatted,
                    tanggalBayar: tglBayarStr,
                    metodePembayaran: metodeLengkap
                  }, pdfBuffer);
                } catch (emailErr) {
                  console.error('[Midtrans Callback] Failed to send confirmation email:', emailErr.message);
                }
              }

              // 8. Broadcast websocket updates
              SocketService.broadcast('pelanggan_updated', {
                id_pelanggan: billing.id_pelanggan,
                status_tagihan: 'hijau',
                pppoe_status: pppoeStatus
              });

              SocketService.broadcast('pembayaran_masuk', {
                id_pembayaran: id_pembayaran,
                id_tagihan: id_tagihan,
                nama_pelanggan: billing.nama,
                tanggal_upload: new Date()
              });

              console.log(`[Midtrans Callback] Tagihan #${id_tagihan} successfully processed and re-activated!`);
              return res.json({ success: true, message: 'Pembayaran berhasil diproses!' });
            });
          });
        });
      });
    });
  } else {
    // For pending/failed/expired transactions, just return success acknowledgment to Midtrans
    console.log(`[Midtrans Callback] Acknowledging transaction status: ${transaction_status}`);
    return res.json({ success: true, message: 'Status callback received: ' + transaction_status });
  }
});

/* GET /api/customer/portal/check-billing - Public check billing status by Phone or PPPoE username */
router.get('/check-billing', function (req, res) {
  var { query } = req.query; // can be no_hp or pppoe_username

  if (!query) {
    return res.status(400).json({ success: false, message: 'Nomor HP atau Username PPPoE wajib diisi.' });
  }

  var sql = `
    SELECT 
      p.id_pelanggan,
      p.nama,
      p.email,
      p.no_hp,
      p.pppoe_username,
      t.id_tagihan,
      t.periode,
      t.nominal,
      t.status AS status_tagihan,
      t.due_date
    FROM pelanggan p
    LEFT JOIN tagihan t ON p.id_pelanggan = t.id_pelanggan AND t.status != 'lunas'
    WHERE p.no_hp = ? OR p.pppoe_username = ?
    ORDER BY t.due_date ASC
    LIMIT 1
  `;

  db.query(sql, [query, query], function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Data pelanggan tidak ditemukan.' });
    }

    var record = results[0];
    
    // Mask the customer name for security (e.g. John Doe -> J**n D**e)
    var maskName = function (name) {
      if (!name) return '';
      return name.split(' ').map(function(word) {
        if (word.length <= 2) return word[0] + '*';
        return word[0] + '*'.repeat(word.length - 2) + word[word.length - 1];
      }).join(' ');
    };

    var responseData = {
      nama: maskName(record.nama),
      hasActiveBill: !!record.id_tagihan,
      email: record.email
    };

    if (record.id_tagihan) {
      responseData.tagihan = {
        periode: record.periode,
        nominal: record.nominal,
        status: record.status_tagihan,
        due_date: record.due_date
      };
    }

    res.json({
      success: true,
      data: responseData
    });
  });
});

// Protect all portal routes with customer JWT token
router.use(verifyCustomerToken);

// Multer Upload Configuration
var uploadDir = path.join(__dirname, '../public/uploads/bukti');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    var uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bukti-' + uniqueSuffix + path.extname(file.originalname));
  }
});

var upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Hanya file gambar yang diperbolehkan!'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // Max 5MB
  }
});

/* GET /api/customer/portal/billing - Get active bill for customer */
router.get('/billing', function (req, res) {
  var id_pelanggan = req.customerId;

  function sendBillingResponse(billingData) {
    var lastPaymentSql = `
      SELECT pem.*, t.periode, t.nominal 
      FROM pembayaran pem 
      JOIN tagihan t ON pem.id_tagihan = t.id_tagihan 
      WHERE t.id_pelanggan = ? 
      ORDER BY pem.tanggal_upload DESC 
      LIMIT 1
    `;
    db.query(lastPaymentSql, [id_pelanggan], function (payErr, payResults) {
      var lastPayment = null;
      if (!payErr && payResults && payResults[0]) {
        lastPayment = payResults[0];
      }
      res.json({
        success: true,
        data: billingData,
        lastPayment: lastPayment
      });
    });
  }

  var sql = `
    SELECT t.*, p.nama, p.paket, p.status_tagihan 
    FROM tagihan t 
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
    WHERE t.id_pelanggan = ? AND t.status != 'lunas'
    ORDER BY t.due_date ASC 
    LIMIT 1
  `;

  db.query(sql, [id_pelanggan], function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (results.length === 0) {
      // Check if we need to generate the first/missing tagihan for their current due_date
      var checkCustSql = `
        SELECT p.*, pl.harga 
        FROM pelanggan p
        LEFT JOIN paket_layanan pl ON p.paket = pl.nama_paket
        WHERE p.id_pelanggan = ?
      `;
      db.query(checkCustSql, [id_pelanggan], function (custErr, custResults) {
        if (custErr || custResults.length === 0) {
          return sendBillingResponse(null);
        }

        var customer = custResults[0];
        if (!customer.due_date || !customer.harga) {
          return sendBillingResponse(null);
        }

        // Format due_date to YYYY-MM period
        var d = new Date(customer.due_date);
        var year = d.getFullYear();
        var month = d.getMonth() + 1;
        var period = year + '-' + (month < 10 ? '0' + month : month);

        // Check if a bill for this period already exists
        var checkBillSql = 'SELECT * FROM tagihan WHERE id_pelanggan = ? AND periode = ?';
        db.query(checkBillSql, [id_pelanggan, period], function (billErr, billResults) {
          if (billErr || billResults.length > 0) {
            return sendBillingResponse(null);
          }

          console.log(`[Billing Service] Generating missing bill for customer ${customer.nama} (${period})`);
          var Tagihan = require('../models/Tagihan');
          Tagihan.create({
            id_pelanggan: id_pelanggan,
            periode: period,
            nominal: customer.harga,
            status: 'belum_bayar',
            due_date: customer.due_date
          }, function (createBillErr, newBill) {
            if (createBillErr) {
              console.error('[Billing Service] Failed to generate bill:', createBillErr.message);
              return res.status(500).json({ success: false, message: 'Gagal membuat tagihan otomatis', error: createBillErr.message });
            }

            sendBillingResponse({
              id_tagihan: newBill.id_tagihan,
              id_pelanggan: id_pelanggan,
              periode: period,
              nominal: customer.harga,
              status: 'belum_bayar',
              due_date: customer.due_date,
              nama: customer.nama,
              paket: customer.paket,
              status_tagihan: customer.status_tagihan
            });
          });
        });
      });
      return;
    }

    sendBillingResponse(results[0]);
  });
});

/* POST /api/customer/portal/pay - Upload payment proof */
router.post('/pay', function (req, res) {
  upload.single('bukti')(req, res, function (err) {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    var { id_tagihan } = req.body;
    var customerId = req.customerId;

    if (!id_tagihan) {
      return res.status(400).json({ success: false, message: 'ID Tagihan wajib disertakan.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Bukti transfer wajib diunggah.' });
    }

    // Verify that the bill belongs to the logged-in customer
    var verifySql = 'SELECT * FROM tagihan WHERE id_tagihan = ? AND id_pelanggan = ?';
    db.query(verifySql, [id_tagihan, customerId], function (err, results) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (results.length === 0) {
        if (req.file) {
          fs.unlink(req.file.path, () => { });
        }
        return res.status(403).json({ success: false, message: 'Akses ditolak. Tagihan bukan milik Anda.' });
      }

      var tagihan = results[0];
      if (tagihan.status === 'lunas') {
        if (req.file) {
          fs.unlink(req.file.path, () => { });
        }
        return res.status(400).json({ success: false, message: 'Tagihan ini sudah lunas.' });
      }
      if (tagihan.status === 'menunggu_verifikasi') {
        if (req.file) {
          fs.unlink(req.file.path, () => { });
        }
        return res.status(400).json({ success: false, message: 'Pembayaran untuk tagihan ini sedang menunggu verifikasi admin.' });
      }

      var relativePath = '/uploads/bukti/' + req.file.filename;

      // 1. Insert into pembayaran table
      var insertSql = `
        INSERT INTO pembayaran (id_tagihan, bukti_file, status, tanggal_upload) 
        VALUES (?, ?, 'pending', NOW())
      `;
      db.query(insertSql, [id_tagihan, relativePath], function (err, paymentResult) {
        if (err) {
          return res.status(500).json({ success: false, message: 'Gagal mencatat pembayaran.', error: err.message });
        }

        // Insert into notifikasi table to track payment pending notification
        db.query("INSERT INTO notifikasi (id_pembayaran) VALUES (?)", [paymentResult.insertId], function(notifErr) {
          if (notifErr) {
            console.error('[Notification Trigger] Failed to insert notification record:', notifErr.message);
          }
        });

        // 2. Update tagihan status to 'menunggu_verifikasi'
        var updateSql = "UPDATE tagihan SET status = 'menunggu_verifikasi' WHERE id_tagihan = ?";
        db.query(updateSql, [id_tagihan], function (err) {
          if (err) {
            return res.status(500).json({ success: false, message: 'Gagal memperbarui status tagihan.' });
          }

          // Broadcast notification to Admin dashboard (Tahap 6)
          SocketService.broadcast('pembayaran_masuk', {
            id_pembayaran: paymentResult.insertId,
            id_tagihan: id_tagihan,
            nama_pelanggan: results[0].nama,
            tanggal_upload: new Date()
          });

          res.json({
            success: true,
            message: 'Bukti transfer berhasil diunggah! Pembayaran Anda sedang menunggu verifikasi admin.',
            data: {
              id_pembayaran: paymentResult.insertId,
              bukti_file: relativePath
            }
          });
        });
      });
    });
  });
});

// GET /api/customer/portal/midtrans-config - Get Client Key for Snap SDK initialization
router.get('/midtrans-config', function (req, res) {
  var clientKey = ConfigService.get('MIDTRANS_CLIENT_KEY', process.env.MIDTRANS_CLIENT_KEY || '');
  var serverKey = ConfigService.get('MIDTRANS_SERVER_KEY', process.env.MIDTRANS_SERVER_KEY || '');
  var isSandboxConfig = ConfigService.get('MIDTRANS_IS_SANDBOX', process.env.MIDTRANS_IS_SANDBOX || 'true');
  var isSandbox = isSandboxConfig === 'true' || serverKey.startsWith('SB-') || clientKey.startsWith('SB-');
  res.json({
    success: true,
    clientKey: clientKey,
    isSandbox: isSandbox
  });
});

// POST /api/customer/portal/midtrans-token - Request Midtrans Snap Token for a bill
router.post('/midtrans-token', function (req, res) {
  var { id_tagihan } = req.body;
  var customerId = req.customerId;

  if (!id_tagihan) {
    return res.status(400).json({ success: false, message: 'ID Tagihan wajib disertakan.' });
  }

  // Verify that the bill belongs to the logged-in customer and is not paid yet
  var sql = `
    SELECT t.*, p.nama, p.email, p.no_hp 
    FROM tagihan t 
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
    WHERE t.id_tagihan = ? AND t.id_pelanggan = ?
  `;
  db.query(sql, [id_tagihan, customerId], function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(403).json({ success: false, message: 'Tagihan tidak ditemukan atau bukan milik Anda.' });
    }

    var billing = results[0];
    if (billing.status === 'lunas') {
      return res.status(400).json({ success: false, message: 'Tagihan ini sudah lunas.' });
    }

    // Generate unique order ID
    var orderId = 'TRX-' + id_tagihan + '-' + Date.now();
    var serverKey = ConfigService.get('MIDTRANS_SERVER_KEY', process.env.MIDTRANS_SERVER_KEY || '');
    var isSandboxConfig = ConfigService.get('MIDTRANS_IS_SANDBOX', process.env.MIDTRANS_IS_SANDBOX || 'true');
    var isSandbox = isSandboxConfig === 'true' || serverKey.startsWith('SB-');

    var snapUrl = isSandbox
      ? 'https://app.sandbox.midtrans.com/snap/v1/transactions'
      : 'https://app.midtrans.com/snap/v1/transactions';

    // Call Midtrans Snap API
    var authHeader = 'Basic ' + Buffer.from(serverKey + ':').toString('base64');

    var payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(Number(billing.nominal))
      },
      credit_card: {
        secure: true
      },
      customer_details: {
        first_name: billing.nama,
        email: billing.email || (billing.no_hp + '@ldm.net'),
        phone: billing.no_hp
      }
    };

    axios.post(snapUrl, payload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    })
      .then(function (midtransRes) {
        res.json({
          success: true,
          token: midtransRes.data.token,
          redirect_url: midtransRes.data.redirect_url
        });
      })
      .catch(function (midtransErr) {
        console.error('[Midtrans Token API] Error:', midtransErr.response?.data || midtransErr.message);
        res.status(500).json({
          success: false,
          message: 'Gagal membuat transaksi di Midtrans. Silakan coba metode transfer biasa.',
          error: midtransErr.response?.data || midtransErr.message
        });
      });
  });
});

// POST /api/customer/portal/duitku-payment - Request Duitku Payment URL for a bill
router.post('/duitku-payment', function (req, res) {
  var { id_tagihan, paymentMethod } = req.body;
  var customerId = req.customerId;

  if (!id_tagihan) {
    return res.status(400).json({ success: false, message: 'ID Tagihan wajib disertakan.' });
  }

  var merchantCode = ConfigService.get('DUITKU_MERCHANT_CODE', process.env.DUITKU_MERCHANT_CODE || '');
  var apiKey = ConfigService.get('DUITKU_API_KEY', process.env.DUITKU_API_KEY || '');
  var isSandbox = ConfigService.get('DUITKU_IS_SANDBOX', process.env.DUITKU_IS_SANDBOX || 'true') === 'true';

  if (!merchantCode || !apiKey) {
    return res.status(400).json({
      success: false,
      message: 'Payment Gateway Duitku belum dikonfigurasi oleh Admin. Silakan hubungi Customer Service.'
    });
  }

  // Verify that the bill belongs to the logged-in customer and is not paid yet
  var sql = `
    SELECT t.*, p.nama, p.email, p.no_hp 
    FROM tagihan t 
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
    WHERE t.id_tagihan = ? AND t.id_pelanggan = ?
  `;
  db.query(sql, [id_tagihan, customerId], function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(403).json({ success: false, message: 'Tagihan tidak ditemukan atau bukan milik Anda.' });
    }

    var billing = results[0];
    if (billing.status === 'lunas') {
      return res.status(400).json({ success: false, message: 'Tagihan ini sudah lunas.' });
    }

    // Generate unique order ID
    var orderId = 'TRX-DUITKU-' + id_tagihan + '-' + Date.now();
    var amount = Math.round(Number(billing.nominal));

    // MD5 Signature: md5(merchantCode + orderId + amount + apiKey)
    var signature = crypto.createHash('md5').update(merchantCode + orderId + amount + apiKey).digest('hex');

    var duitkuInquiryUrl = isSandbox
      ? 'https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry'
      : 'https://passport.duitku.com/webapi/api/merchant/v2/inquiry';

    var hostHeader = req.get('host');
    var protocol = req.protocol;
    var baseUrl = protocol + '://' + hostHeader;

    var callbackUrl = baseUrl + '/api/customer/portal/duitku-callback';
    var returnUrl = req.get('referer') || (baseUrl + '/portal');

    var methodCode = paymentMethod || 'VC'; // Default to 'VC' if not specified

    var payload = {
      merchantCode: merchantCode,
      paymentAmount: amount,
      paymentMethod: methodCode,
      merchantOrderId: orderId,
      productDetails: 'Pembayaran Tagihan Internet Periode ' + billing.periode,
      email: billing.email || (billing.no_hp + '@ldm.net'),
      additionalParam: String(id_tagihan),
      customerVaName: billing.nama,
      callbackUrl: callbackUrl,
      returnUrl: returnUrl,
      signature: signature,
      expiryPeriod: 1440 // 24 hours
    };

    axios.post(duitkuInquiryUrl, payload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
      .then(function (duitkuRes) {
        if (duitkuRes.data && (duitkuRes.data.paymentUrl || duitkuRes.data.statusCode === '00')) {
          res.json({
            success: true,
            paymentUrl: duitkuRes.data.paymentUrl,
            reference: duitkuRes.data.reference,
            statusCode: duitkuRes.data.statusCode
          });
        } else {
          console.error('[Duitku Payment API] Response error:', duitkuRes.data);
          res.status(400).json({
            success: false,
            message: duitkuRes.data?.statusMessage || 'Gagal membuat transaksi di Duitku.',
            error: duitkuRes.data
          });
        }
      })
      .catch(function (duitkuErr) {
        console.error('[Duitku Payment API] Request Error:', duitkuErr.response?.data || duitkuErr.message);
        res.status(500).json({
          success: false,
          message: 'Gagal menghubungkan ke Duitku Gateway. Silakan coba kembali.',
          error: duitkuErr.response?.data || duitkuErr.message
        });
      });
  });
});

/* GET /api/customer/portal/profile - Get full profile and subscription of customer */
router.get('/profile', function (req, res) {
  var id_pelanggan = req.customerId;
  var sql = `
    SELECT p.*, pl.harga, pl.kecepatan, pl.deskripsi 
    FROM pelanggan p 
    LEFT JOIN paket_layanan pl ON p.paket = pl.nama_paket 
    WHERE p.id_pelanggan = ?
  `;
  db.query(sql, [id_pelanggan], function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    }
    res.json({ success: true, data: results[0] });
  });
});

/* GET /api/customer/portal/payments - Get payment history for customer */
router.get('/payments', function (req, res) {
  var id_pelanggan = req.customerId;
  var sql = `
    SELECT pem.*, t.periode, t.nominal, t.status AS status_tagihan
    FROM pembayaran pem
    JOIN tagihan t ON pem.id_tagihan = t.id_tagihan
    WHERE t.id_pelanggan = ?
    ORDER BY pem.tanggal_upload DESC
  `;
  db.query(sql, [id_pelanggan], function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

/* GET /api/customer/portal/invoice/:id_tagihan/pdf - Download or view PDF Invoice for Customer */
router.get('/invoice/:id_tagihan/pdf', function(req, res) {
  var idTagihan = req.params.id_tagihan;
  var customerId = req.customerId;
  var PdfService = require('../services/pdfService');

  var sql = `
    SELECT t.*, p.nama, p.no_hp, p.email, p.alamat, p.paket 
    FROM tagihan t 
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
    WHERE t.id_tagihan = ? AND t.id_pelanggan = ?
  `;
  db.query(sql, [idTagihan, customerId], async function(err, results) {
    if (err || !results || results.length === 0) {
      return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan atau bukan milik Anda.' });
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
