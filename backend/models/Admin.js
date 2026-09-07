var db = require('../config/db');

var Admin = {
  // Cari admin berdasarkan username
  findByUsername: function(username, callback) {
    var sql = 'SELECT * FROM admin WHERE username = ?';
    db.query(sql, [username], function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0] || null);
    });
  },

  // Buat admin baru
  create: function(data, callback) {
    var sql = 'INSERT INTO admin (username, password_hash, nama, role, status) VALUES (?, ?, ?, ?, ?)';
    var values = [
      data.username,
      data.password_hash,
      data.nama,
      data.role || 'admin',
      data.status || 'aktif'
    ];
    db.query(sql, values, function(err, result) {
      if (err) return callback(err, null);
      callback(null, { id_admin: result.insertId, ...data });
    });
  },

  // Ambil semua akun admin
  getAll: function(callback) {
    var sql = 'SELECT id_admin, username, nama, role, status, created_at, updated_at FROM admin ORDER BY id_admin ASC';
    db.query(sql, function(err, results) {
      if (err) return callback(err, null);
      callback(null, results);
    });
  },

  // Cek apakah sudah ada admin di database
  count: function(callback) {
    var sql = 'SELECT COUNT(*) as total FROM admin';
    db.query(sql, function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0].total);
    });
  },

  // Hitung jumlah superadmin yang aktif
  countSuperAdmin: function(callback) {
    var sql = "SELECT COUNT(*) as total FROM admin WHERE role = 'superadmin' AND status = 'aktif'";
    db.query(sql, function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0].total);
    });
  },

  // Cari admin berdasarkan ID
  findById: function(id, callback) {
    var sql = 'SELECT id_admin, username, nama, role, status, created_at FROM admin WHERE id_admin = ?';
    db.query(sql, [id], function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0] || null);
    });
  },

  // Cari admin berdasarkan ID (termasuk password_hash untuk verifikasi)
  findByIdWithPassword: function(id, callback) {
    var sql = 'SELECT * FROM admin WHERE id_admin = ?';
    db.query(sql, [id], function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0] || null);
    });
  },

  // Update profil admin
  updateProfile: function(id, data, callback) {
    var fields = [];
    var values = [];

    if (data.nama !== undefined) { fields.push('nama = ?'); values.push(data.nama); }
    if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }

    if (fields.length === 0) return callback(null, { affectedRows: 0 });

    values.push(id);
    var sql = 'UPDATE admin SET ' + fields.join(', ') + ' WHERE id_admin = ?';
    db.query(sql, values, function(err, result) {
      if (err) return callback(err, null);
      callback(null, result);
    });
  },

  // Update password admin
  updatePassword: function(id, passwordHash, callback) {
    var sql = 'UPDATE admin SET password_hash = ? WHERE id_admin = ?';
    db.query(sql, [passwordHash, id], function(err, result) {
      if (err) return callback(err, null);
      callback(null, result);
    });
  },

  // Hapus akun admin
  delete: function(id, callback) {
    var sql = 'DELETE FROM admin WHERE id_admin = ?';
    db.query(sql, [id], function(err, result) {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }
};

module.exports = Admin;
