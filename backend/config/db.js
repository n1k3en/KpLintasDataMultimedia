const mysql = require('mysql2');

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '', 
  database: process.env.DB_NAME || 'dashboard_isp'
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error menghubungkan ke database dashboard_isp:', err.message);
  } else {
    console.log('Koneksi ke database dashboard_isp berhasil!');

    // Pengecekan dan penambahan kolom latitude & longitude secara aman jika belum ada
    connection.query("SHOW COLUMNS FROM pelanggan LIKE 'latitude'", (colErr, rows) => {
      if (!colErr && rows.length === 0) {
        connection.query("ALTER TABLE pelanggan ADD COLUMN latitude DECIMAL(10,8) NULL AFTER alamat", (alterErr) => {
          if (!alterErr) console.log('[DB Migration] Kolom latitude berhasil ditambahkan ke tabel pelanggan.');
        });
      }
    });

    connection.query("SHOW COLUMNS FROM pelanggan LIKE 'longitude'", (colErr, rows) => {
      if (!colErr && rows.length === 0) {
        connection.query("ALTER TABLE pelanggan ADD COLUMN longitude DECIMAL(11,8) NULL AFTER latitude", (alterErr) => {
          if (!alterErr) console.log('[DB Migration] Kolom longitude berhasil ditambahkan ke tabel pelanggan.');
        });
      }
    });

    // Pengecekan tabel pengaturan
    connection.query(`
      CREATE TABLE IF NOT EXISTS pengaturan (
        kunci VARCHAR(100) PRIMARY KEY,
        nilai TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, () => {});

    connection.release(); 
  }
});

module.exports = pool;
