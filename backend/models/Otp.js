var db = require('../config/db');

var Otp = {
  // Simpan OTP baru untuk email
  createOtp: function(email, otp, callback) {
    // Hapus OTP lama terlebih dahulu agar tidak menumpuk
    var deleteSql = 'DELETE FROM customer_otp WHERE email = ?';
    db.query(deleteSql, [email], function(err) {
      if (err) return callback(err);

      // Set expiry to 5 minutes from now
      var expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      var insertSql = 'INSERT INTO customer_otp (email, otp, expires_at) VALUES (?, ?, ?)';
      
      db.query(insertSql, [email, otp, expiresAt], function(err, result) {
        if (err) return callback(err);
        callback(null, result);
      });
    });
  },

  // Verifikasi OTP
  checkOtp: function(email, otp, callback) {
    var sql = `
      SELECT * FROM customer_otp
      WHERE email = ? AND otp = ?
    `;
    db.query(sql, [email, otp], function(err, results) {
      if (err) return callback(err, null);
      if (results.length === 0) return callback(null, null);

      var expiresAt = new Date(results[0].expires_at);
      if (expiresAt < new Date()) return callback(null, null);
      callback(null, results[0]);
    });
  },

  // Verifikasi OTP dan hapus setelah digunakan
  verifyOtp: function(email, otp, callback) {
    var sql = `
      SELECT * FROM customer_otp 
      WHERE email = ? AND otp = ?
    `;
    db.query(sql, [email, otp], function(err, results) {
      if (err) return callback(err, null);
      if (results.length === 0) {
        return callback(null, null); // OTP invalid
      }
      
      var otpRecord = results[0];
      var now = new Date();
      var expiresAt = new Date(otpRecord.expires_at);
      
      if (expiresAt < now) {
        return callback(null, null); // OTP expired
      }
      
      // Hapus OTP setelah berhasil digunakan
      var deleteSql = 'DELETE FROM customer_otp WHERE email = ?';
      db.query(deleteSql, [email], function() {
        callback(null, otpRecord);
      });
    });
  }
};

module.exports = Otp;
