var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var Pelanggan = require('../models/Pelanggan');
var Otp = require('../models/Otp');
var EmailService = require('../services/emailService');

var rateLimit = require('express-rate-limit');

var otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 menit
  max: 3, // Maksimal 3 permintaan per IP/Window
  message: {
    success: false,
    message: 'Terlalu banyak permintaan OTP. Silakan coba lagi dalam 5 menit.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/* POST /api/customer/auth/forgot-password/request-otp */
router.post('/forgot-password/request-otp', otpLimiter, function(req, res) {
  var email = normalizeEmail(req.body.email);
  if (!email) return res.status(400).json({ success: false, message: 'Email wajib diisi.' });

  var db = require('../config/db');
  db.query('SELECT * FROM pelanggan WHERE email = ? LIMIT 1', [email], function(err, results) {
    if (err) return res.status(500).json({ success: false, message: 'Database error.' });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Email pelanggan tidak terdaftar.' });

    var customer = results[0];
    var otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    Otp.createOtp(email, otpCode, async function(otpErr) {
      if (otpErr) return res.status(500).json({ success: false, message: 'Gagal membuat OTP.' });
      var sendResult = await EmailService.sendOtpEmail(email, { nama: customer.nama, otp: otpCode, purpose: 'reset password' });
      if (!sendResult.success) return res.status(500).json({ success: false, message: 'Gagal mengirim OTP.' });
      res.json({ success: true, message: 'OTP reset password telah dikirim ke email.' });
    });
  });
});

/* POST /api/customer/auth/forgot-password/reset */
router.post('/forgot-password/verify-otp', function(req, res) {
  var email = normalizeEmail(req.body.email);
  var otp = req.body.otp;
  if (!email || !otp) return res.status(400).json({ success: false, message: 'Email dan OTP wajib diisi.' });

  var db = require('../config/db');
  db.query('SELECT id_pelanggan FROM pelanggan WHERE email = ? LIMIT 1', [email], function(err, results) {
    if (err) return res.status(500).json({ success: false, message: 'Database error.' });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Email pelanggan tidak terdaftar.' });
    Otp.checkOtp(email, otp, function(otpErr, otpRecord) {
      if (otpErr) return res.status(500).json({ success: false, message: 'Database error.' });
      if (!otpRecord) return res.status(400).json({ success: false, message: 'OTP tidak valid atau sudah kedaluwarsa.' });
      res.json({ success: true, message: 'OTP berhasil diverifikasi.' });
    });
  });
});

/* POST /api/customer/auth/forgot-password/reset */
router.post('/forgot-password/reset', function(req, res) {
  var email = normalizeEmail(req.body.email);
  var otp = req.body.otp;
  var newPassword = req.body.newPassword;
  var confirmPassword = req.body.confirmPassword;

  if (!email || !otp || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'Email, OTP, password baru, dan konfirmasi password wajib diisi.' });
  }
  if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter.' });
  if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: 'Konfirmasi password tidak cocok.' });

  var db = require('../config/db');
  db.query('SELECT id_pelanggan FROM pelanggan WHERE email = ? LIMIT 1', [email], function(err, results) {
    if (err) return res.status(500).json({ success: false, message: 'Database error.' });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Email pelanggan tidak terdaftar.' });

    Otp.verifyOtp(email, otp, function(otpErr, otpRecord) {
      if (otpErr) return res.status(500).json({ success: false, message: 'Database error.' });
      if (!otpRecord) return res.status(400).json({ success: false, message: 'OTP tidak valid atau sudah kedaluwarsa.' });

      bcrypt.hash(newPassword, 10, function(hashErr, hash) {
        if (hashErr) return res.status(500).json({ success: false, message: 'Gagal mengenkripsi password.' });
        db.query('UPDATE pelanggan SET password = ? WHERE email = ?', [hash, email], function(updateErr) {
          if (updateErr) return res.status(500).json({ success: false, message: 'Gagal mengubah password.' });
          res.json({ success: true, message: 'Password berhasil diubah. Silakan login kembali.' });
        });
      });
    });
  });
});

/* POST /api/customer/auth/request-otp - Request OTP via Email */
router.post('/request-otp', otpLimiter, function(req, res) {
  var { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
  }

  email = email.trim().toLowerCase();

  // Search customer by email in database
  var db = require('../config/db');
  var sql = 'SELECT * FROM pelanggan WHERE email = ? LIMIT 1';

  db.query(sql, [email], function(err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Email tidak terdaftar. Silakan hubungi admin ESP Lintas Data.' 
      });
    }

    var customer = results[0];

    bcrypt.compare(password, customer.password || '', function(passwordErr, isMatch) {
      if (passwordErr || !isMatch) {
        return res.status(401).json({ success: false, message: 'Email atau password salah.' });
      }

    // Generate random 6 digit OTP
    var otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in database (using email as identifier)
    Otp.createOtp(customer.email, otpCode, async function(otpErr) {
      if (otpErr) {
        return res.status(500).json({ success: false, message: 'Gagal membuat kode verifikasi.' });
      }

      // Send OTP via Email
      var sendRes = await EmailService.sendOtpEmail(customer.email, {
        nama: customer.nama,
        otp: otpCode
      });

      if (sendRes.success) {
        res.json({ 
          success: true, 
          message: 'Kode OTP telah dikirim ke Email Anda!', 
          email: customer.email 
        });
      } else {
        // Fallback info in response if email fails
        res.status(500).json({ 
          success: false, 
          message: 'Gagal mengirim Email OTP. Silakan coba lagi nanti.' 
        });
      }
    });
    });
  });
});

/* POST /api/customer/auth/verify-otp - Verify OTP and login */
router.post('/verify-otp', function(req, res) {
  var { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email dan OTP wajib diisi.' });
  }

  email = email.trim().toLowerCase();

  // Find customer by email
  var db = require('../config/db');
  var sql = 'SELECT * FROM pelanggan WHERE email = ? LIMIT 1';

  db.query(sql, [email], function(err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    }

    var customer = results[0];

    // Verify OTP using email
    Otp.verifyOtp(customer.email, otp, function(verifyErr, otpRecord) {
      if (verifyErr) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (!otpRecord) {
        return res.status(400).json({ success: false, message: 'Kode OTP tidak valid atau sudah kedaluwarsa.' });
      }

      // Generate JWT Customer Token
      var token = jwt.sign(
        { 
          id_pelanggan: customer.id_pelanggan, 
          email: customer.email,
          role: 'customer' 
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' } // Customer stays logged in longer (30 days)
      );

      res.json({
        success: true,
        message: 'Login berhasil!',
        data: {
          token: token,
          customer: {
            id_pelanggan: customer.id_pelanggan,
            nama: customer.nama,
            email: customer.email,
            no_hp: customer.no_hp,
            paket: customer.paket
          }
        }
      });
    });
  });
});

module.exports = router;
