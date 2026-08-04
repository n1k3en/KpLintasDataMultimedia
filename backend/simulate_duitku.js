require('dotenv').config();
var crypto = require('crypto');
var axios = require('axios');
var db = require('./config/db');

// 1. Cek tagihan yang belum lunas
db.query(
  "SELECT t.id_tagihan, t.periode, t.nominal, t.status, p.nama FROM tagihan t JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan WHERE t.status != 'lunas' ORDER BY t.id_tagihan DESC LIMIT 5",
  function(err, rows) {
    if (err) { console.error(err.message); process.exit(1); }

    console.log('\n=== TAGIHAN BELUM LUNAS ===');
    if (rows.length === 0) {
      console.log('  Tidak ada tagihan belum lunas.');
      process.exit();
    }
    rows.forEach(function(r) {
      console.log('  #' + r.id_tagihan + ' | ' + r.nama + ' | ' + r.periode + ' | Rp ' + Number(r.nominal).toLocaleString('id-ID') + ' | ' + r.status);
    });

    // 2. Ambil tagihan pertama untuk disimulasi
    var target = rows[0];
    console.log('\n=== SIMULASI PEMBAYARAN UNTUK TAGIHAN #' + target.id_tagihan + ' ===');

    // 3. Ambil config Duitku
    db.query("SELECT kunci, nilai FROM pengaturan WHERE kunci IN ('DUITKU_MERCHANT_CODE', 'DUITKU_API_KEY')", function(err2, cfgRows) {
      if (err2) { console.error(err2.message); process.exit(1); }

      var config = {};
      cfgRows.forEach(function(r) { config[r.kunci] = r.nilai; });

      var merchantCode = config.DUITKU_MERCHANT_CODE;
      var apiKey = config.DUITKU_API_KEY;
      var amount = String(Math.round(Number(target.nominal)));
      var merchantOrderId = 'TRX-DUITKU-' + target.id_tagihan + '-' + Date.now();

      // HMAC-SHA256 signature: HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey)
      var stringToSign = merchantCode + amount + merchantOrderId;
      var signature = crypto.createHmac('sha256', apiKey).update(stringToSign).digest('hex');

      var payload = {
        merchantCode: merchantCode,
        amount: amount,
        merchantOrderId: merchantOrderId,
        signature: signature,
        resultCode: '00',
        paymentCode: 'LQ',
        reference: 'SIM-' + Date.now()
      };

      console.log('  Pelanggan : ' + target.nama);
      console.log('  Periode   : ' + target.periode);
      console.log('  Nominal   : Rp ' + Number(target.nominal).toLocaleString('id-ID'));
      console.log('  Order ID  : ' + merchantOrderId);
      console.log('');

      // 4. Kirim callback ke localhost
      axios.post('http://localhost:3000/api/customer/portal/duitku-callback', payload, {
        headers: { 'Content-Type': 'application/json' }
      })
      .then(function(res) {
        console.log('✅ Status  : ' + res.status);
        console.log('✅ Response: ' + JSON.stringify(res.data));
        console.log('');
        console.log('🎉 Tagihan #' + target.id_tagihan + ' (' + target.nama + ') sekarang LUNAS!');
        console.log('   Cek di: http://localhost:3001/dashboard/pembayaran?type=duitku');
        process.exit();
      })
      .catch(function(err) {
        console.error('❌ Error:', err.response ? JSON.stringify(err.response.data) : err.message);
        process.exit(1);
      });
    });
  }
);
