var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var Admin = require('../models/Admin');
var verifyToken = require('../middleware/auth');

/* POST /api/auth/seed - Buat admin pertama kali */
router.post('/seed', function(req, res) {
  Admin.count(function(err, total) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (total > 0) {
      return res.status(400).json({ success: false, message: 'Admin sudah ada. Seed hanya untuk pertama kali.' });
    }

    var username = req.body.username || 'admin';
    var password = req.body.password || 'admin123';
    var nama = req.body.nama || 'Administrator';

    bcrypt.hash(password, 10, function(hashErr, hashedPassword) {
      if (hashErr) {
        return res.status(500).json({ success: false, message: 'Gagal hash password' });
      }

      Admin.create({
        username: username,
        password_hash: hashedPassword,
        nama: nama
      }, function(createErr, admin) {
        if (createErr) {
          return res.status(500).json({ success: false, message: 'Gagal membuat admin', error: createErr.message });
        }

        res.status(201).json({
          success: true,
          message: 'Admin berhasil dibuat! Silakan login.',
          data: { username: username, nama: nama }
        });
      });
    });
  });
});

/* POST /api/auth/login - Admin login */
router.post('/login', function(req, res) {
  var { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password harus diisi.' });
  }

  Admin.findByUsername(username, function(err, admin) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Username atau password salah.' });
    }

    if (admin.status === 'nonaktif') {
      return res.status(403).json({ success: false, message: 'Akun Anda dinonaktifkan. Silakan hubungi Super Admin.' });
    }

    bcrypt.compare(password, admin.password_hash, function(compareErr, isMatch) {
      if (compareErr) {
        return res.status(500).json({ success: false, message: 'Error saat verifikasi password.' });
      }

      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Username atau password salah.' });
      }

      var userRole = admin.role || 'admin';
      var token = jwt.sign(
        { id: admin.id_admin, username: admin.username, role: userRole },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Login berhasil!',
        data: {
          token: token,
          admin: {
            id: admin.id_admin,
            username: admin.username,
            nama: admin.nama,
            role: userRole,
            status: admin.status || 'aktif'
          }
        }
      });
    });
  });
});

/* GET /api/auth/me - Get current admin info */
router.get('/me', verifyToken, function(req, res) {
  Admin.findById(req.adminId, function(err, admin) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin tidak ditemukan.' });
    }

    res.json({
      success: true,
      data: admin
    });
  });
});

/* PUT /api/auth/profile - Update admin profile (nama) */
router.put('/profile', verifyToken, function(req, res) {
  var { nama } = req.body;

  if (!nama || !nama.trim()) {
    return res.status(400).json({ success: false, message: 'Nama tidak boleh kosong.' });
  }

  Admin.updateProfile(req.adminId, { nama: nama.trim() }, function(err, result) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal memperbarui profil.', error: err.message });
    }

    // Return updated admin data
    Admin.findById(req.adminId, function(findErr, admin) {
      if (findErr || !admin) {
        return res.status(500).json({ success: false, message: 'Gagal mengambil data admin.' });
      }

      res.json({
        success: true,
        message: 'Profil berhasil diperbarui!',
        data: admin
      });
    });
  });
});

/* PUT /api/auth/password - Change admin password */
router.put('/password', verifyToken, function(req, res) {
  var { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Password lama dan baru harus diisi.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter.' });
  }

  Admin.findByIdWithPassword(req.adminId, function(err, admin) {
    if (err || !admin) {
      return res.status(500).json({ success: false, message: 'Admin tidak ditemukan.' });
    }

    bcrypt.compare(currentPassword, admin.password_hash, function(compareErr, isMatch) {
      if (compareErr) {
        return res.status(500).json({ success: false, message: 'Error saat verifikasi password.' });
      }

      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Password lama tidak sesuai.' });
      }

      bcrypt.hash(newPassword, 10, function(hashErr, hashedPassword) {
        if (hashErr) {
          return res.status(500).json({ success: false, message: 'Gagal hash password baru.' });
        }

        Admin.updatePassword(req.adminId, hashedPassword, function(updateErr) {
          if (updateErr) {
            return res.status(500).json({ success: false, message: 'Gagal memperbarui password.', error: updateErr.message });
          }

          res.json({
            success: true,
            message: 'Password berhasil diubah!'
          });
        });
      });
    });
  });
});

module.exports = router;
