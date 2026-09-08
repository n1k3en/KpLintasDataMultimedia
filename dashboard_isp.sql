-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Sep 07, 2026 at 08:26 AM
-- Server version: 8.0.30
-- PHP Version: 8.1.10

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `dashboard_isp`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin`
--

CREATE TABLE `admin` (
  `id_admin` int UNSIGNED NOT NULL,
  `nama` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('superadmin','admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'admin',
  `status` enum('aktif','nonaktif') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'aktif',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `admin`
--

INSERT INTO `admin` (`id_admin`, `nama`, `username`, `password_hash`, `role`, `status`, `created_at`, `updated_at`) VALUES
(1, 'Administrator', 'admin', '$2b$10$L4siK.NKLGUV76soKiRiyO9k8MebLarYOyiG7TMRhPnvQ0.tLv9va', 'superadmin', 'aktif', '2026-07-01 10:46:15', '2026-09-07 13:24:50'),
(2, 'admin1', 'admin1', '$2b$10$tOSVi7LdhXcH232ezM1iC.tFFJY09H3ZLHlwGeIb9sCKuAwc0qbUq', 'admin', 'aktif', '2026-09-07 13:21:20', '2026-09-07 13:31:03');

-- --------------------------------------------------------

--
-- Table structure for table `customer_otp`
--

CREATE TABLE `customer_otp` (
  `id` int NOT NULL,
  `email` varchar(255) NOT NULL,
  `no_hp` varchar(20) DEFAULT NULL,
  `otp` varchar(6) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `laporan_bulanan`
--

CREATE TABLE `laporan_bulanan` (
  `id_laporan` int UNSIGNED NOT NULL,
  `id_admin` int UNSIGNED NOT NULL,
  `periode` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_pemasukan` decimal(14,2) NOT NULL DEFAULT '0.00',
  `total_pengeluaran` decimal(14,2) NOT NULL DEFAULT '0.00',
  `file_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tipe_generate` enum('otomatis','manual') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'otomatis',
  `generated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifikasi`
--

CREATE TABLE `notifikasi` (
  `id_notifikasi` int UNSIGNED NOT NULL,
  `id_pembayaran` int UNSIGNED NOT NULL,
  `id_admin` int UNSIGNED DEFAULT NULL,
  `status_baca` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifikasi`
--

INSERT INTO `notifikasi` (`id_notifikasi`, `id_pembayaran`, `id_admin`, `status_baca`, `created_at`) VALUES
(5, 31, NULL, 1, '2026-08-10 11:32:44'),
(6, 32, NULL, 1, '2026-08-10 11:46:07'),
(7, 33, NULL, 1, '2026-08-14 13:21:58'),
(8, 34, NULL, 0, '2026-08-14 13:42:30'),
(9, 35, NULL, 0, '2026-08-14 13:44:21');

-- --------------------------------------------------------

--
-- Table structure for table `paket_layanan`
--

CREATE TABLE `paket_layanan` (
  `id` int NOT NULL,
  `nama_paket` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `harga` decimal(12,0) NOT NULL,
  `kecepatan` varchar(50) DEFAULT NULL,
  `deskripsi` text,
  `aktif` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `paket_layanan`
--

INSERT INTO `paket_layanan` (`id`, `nama_paket`, `harga`, `kecepatan`, `deskripsi`, `aktif`, `created_at`) VALUES
(1, 'Paket 10 Mbps', 160000, '10 Mbps', '\nKecepatan 10 Mbps\nUnlimited tanpa FUP\nDukungan 24/7\nInstalasi Gratis\n', 1, '2026-07-01 03:47:47'),
(2, 'Paket 20 Mbps', 185000, '20 Mbps', '\nKecepatan 20 Mbps\nUnlimited tanpa FUP\nDukungan 24/7\nInstalasi Gratis\n', 1, '2026-07-01 03:48:02'),
(3, 'Paket 30 Mbps', 200000, '30 Mbps', '\nKecepatan 30 Mbps\nUnlimited tanpa FUP\nDukungan 24/7\nInstalasi Gratis\n', 1, '2026-07-01 03:48:02'),
(4, 'Paket 50 Mbps', 250000, '50 Mbps', '\nKecepatan 50 Mbps\nUnlimited tanpa FUP\nDukungan 24/7\nInstalasi Gratis', 1, '2026-07-06 06:27:05'),
(5, 'Paket 75 Mbps', 330000, '75 Mbps', '\nKecepatan 75 Mbps\nUnlimited tanpa FUP\nDukungan 24/7\nInstalasi Gratis', 1, '2026-07-06 06:27:38'),
(6, 'Paket Gamer 100 Mbps', 385000, '100Mbps', '\nKecepatan 100 Mbps\nUnlimited tanpa FUP\nDukungan Prioritas 24/7\nInstalasi Gratis', 1, '2026-07-06 06:28:10');

-- --------------------------------------------------------

--
-- Table structure for table `pelanggan`
--

CREATE TABLE `pelanggan` (
  `id_pelanggan` int UNSIGNED NOT NULL,
  `nama` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `alamat` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `no_hp` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pppoe_username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pppoe_status` enum('active','inactive','unknown') COLLATE utf8mb4_unicode_ci DEFAULT 'unknown',
  `paket` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status_tagihan` enum('hijau','kuning','merah','abu_abu') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'hijau',
  `due_date` date NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `pelanggan`
--

INSERT INTO `pelanggan` (`id_pelanggan`, `nama`, `alamat`, `latitude`, `longitude`, `no_hp`, `pppoe_username`, `pppoe_status`, `paket`, `status_tagihan`, `due_date`, `created_at`, `updated_at`, `email`) VALUES
(3, 'Satya', 'Jl. Pemuda, Surabaya Pusat', -7.25750000, 112.75210000, '+62 851-8200-1676', 'pelanggan 2', 'inactive', 'Paket 75 Mbps', 'merah', '2026-07-23', '2026-07-01 15:40:33', '2026-07-28 14:39:54', 'namaprojek.testing@gmail.com'),
(4, 'Niken ', 'Jl. Ahmad Yani, Surabaya Selatan', -7.28910000, 112.73450000, '+62 896-7763-1704', 'pelanggan 3', 'inactive', 'Paket 30 Mbps', 'hijau', '2026-09-19', '2026-07-01 15:41:21', '2026-07-28 14:39:54', 'rahmatillahkurniawan@gmail.com'),
(5, 'rassy', 'Saronggi, Sumenep', -7.04220000, 113.88210000, '+6288989588135', 'pelanggan 1', 'inactive', 'Paket Gamer 100 Mbps', 'hijau', '2026-12-25', '2026-07-06 11:55:52', '2026-09-07 12:39:42', 'rassyhvre@gmail.com');

-- --------------------------------------------------------

--
-- Table structure for table `pembayaran`
--

CREATE TABLE `pembayaran` (
  `id_pembayaran` int UNSIGNED NOT NULL,
  `id_tagihan` int UNSIGNED NOT NULL,
  `id_admin` int UNSIGNED DEFAULT NULL,
  `bukti_file` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','diterima','ditolak') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `alasan_tolak` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal_upload` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verified_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `pembayaran`
--

INSERT INTO `pembayaran` (`id_pembayaran`, `id_tagihan`, `id_admin`, `bukti_file`, `status`, `alasan_tolak`, `tanggal_upload`, `verified_at`) VALUES
(31, 60, NULL, 'Midtrans / bank_transfer / settlement', 'diterima', NULL, '2026-08-10 11:32:44', '2026-08-10 11:32:44'),
(32, 61, NULL, 'Duitku / LQ / success', 'diterima', NULL, '2026-08-10 11:46:07', '2026-08-10 11:46:07'),
(33, 62, NULL, 'Duitku / BC / success', 'diterima', NULL, '2026-08-14 13:21:58', '2026-08-14 13:21:58'),
(34, 63, NULL, 'Duitku / NC / success', 'diterima', NULL, '2026-08-14 13:42:30', '2026-08-14 13:42:30'),
(35, 64, NULL, 'Duitku / BR / success', 'diterima', NULL, '2026-08-14 13:44:21', '2026-08-14 13:44:21');

-- --------------------------------------------------------

--
-- Table structure for table `pengaturan`
--

CREATE TABLE `pengaturan` (
  `kunci` varchar(100) NOT NULL,
  `nilai` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `pengaturan`
--

INSERT INTO `pengaturan` (`kunci`, `nilai`, `updated_at`) VALUES
('ALAMAT_ISP', 'Jl. Raya Saronggi No. 45, Sumenep, Jawa Timur', '2026-07-31 08:07:30'),
('APP_URL', 'https://buzz-raking-grievance.ngrok-free.dev/api/customer/portal/duitku-callback', '2026-08-10 04:37:44'),
('DUITKU_API_KEY', 'd4e37143fbf2da8a1274c3d99911cec9', '2026-07-31 08:07:30'),
('DUITKU_IS_SANDBOX', 'true', '2026-07-31 08:07:30'),
('DUITKU_MERCHANT_CODE', 'DS33629', '2026-07-31 08:07:30'),
('EMAIL_CS', 'cs@lintasdata.net', '2026-07-31 08:07:30'),
('EMAIL_FROM', 'ESP Lintas Data <24percobaan24@gmail.com>', '2026-07-31 08:07:30'),
('EMAIL_PASS', 'jacb ramz jsmh urkf', '2026-07-31 08:07:30'),
('EMAIL_USER', '24percobaan24@gmail.com', '2026-07-31 08:07:30'),
('MIDTRANS_CLIENT_KEY', 'Mid-client-olcy1ykJ6rKhm0FV', '2026-07-31 08:07:30'),
('MIDTRANS_IS_SANDBOX', 'true', '2026-07-31 08:07:30'),
('MIDTRANS_MERCHANT_ID', '', '2026-07-31 08:07:30'),
('MIDTRANS_SERVER_KEY', 'Mid-server-ui3hxC6xZBLZ7gy7zNK4z3vD', '2026-07-31 08:07:30'),
('MIKROTIK_HOST', '192.168.50.1', '2026-07-31 08:07:30'),
('MIKROTIK_PASS', '190925Da', '2026-07-31 08:07:30'),
('MIKROTIK_PORT', '8728', '2026-07-31 08:07:30'),
('MIKROTIK_USER', 'api_isp', '2026-09-07 05:45:57'),
('NAMA_ISP', 'Lintas Data Multimedia', '2026-07-31 08:07:29'),
('REMINDER_AUTO_SEND', 'true', '2026-07-31 08:07:30'),
('REMINDER_DUE_DAYS', '3', '2026-07-31 08:07:30'),
('REMINDER_WA_TEMPLATE', 'Halo [Nama],\n\nIni adalah pengingat otomatis dari Lintas Data Multimedia.\nTagihan internet Anda untuk periode [Periode] sebesar Rp [Nominal] akan jatuh tempo pada [JatuhTempo].\n\nSilakan lakukan pembayaran agar layanan tidak terputus. Terima kasih.', '2026-07-31 08:07:30'),
('TELP_CS', '+62 851-8200-1676', '2026-07-31 08:07:30');

-- --------------------------------------------------------

--
-- Table structure for table `pengeluaran`
--

CREATE TABLE `pengeluaran` (
  `id_pengeluaran` int UNSIGNED NOT NULL,
  `id_admin` int UNSIGNED NOT NULL,
  `kategori` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nominal` decimal(12,2) NOT NULL,
  `tipe` enum('fix','tidak_fix') COLLATE utf8mb4_unicode_ci NOT NULL,
  `tanggal` date NOT NULL,
  `keterangan` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `pengeluaran`
--

INSERT INTO `pengeluaran` (`id_pengeluaran`, `id_admin`, `kategori`, `nominal`, `tipe`, `tanggal`, `keterangan`, `created_at`) VALUES
(1, 1, 'Air', 20000.00, 'tidak_fix', '2026-07-06', NULL, '2026-07-07 15:27:56'),
(2, 1, 'Listrik', 400000.00, 'fix', '2026-07-08', NULL, '2026-07-08 11:19:18');

-- --------------------------------------------------------

--
-- Table structure for table `reminder_log`
--

CREATE TABLE `reminder_log` (
  `id_reminder` int UNSIGNED NOT NULL,
  `id_pelanggan` int UNSIGNED NOT NULL,
  `tanggal_kirim` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status_kirim` enum('terkirim','gagal','pending') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `pesan` text COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `reminder_log`
--

INSERT INTO `reminder_log` (`id_reminder`, `id_pelanggan`, `tanggal_kirim`, `status_kirim`, `pesan`) VALUES
(33, 5, '2026-07-31 15:09:37', 'terkirim', 'Halo rassy,\n\nIni adalah pesan otomatis dari ESP Lintas Data Multimedia.\n\nTagihan internet Anda untuk periode 2026-08 sebesar *Rp 385.000* akan jatuh tempo dalam *1 hari* (2 Agustus 2026).\n\nSilakan lakukan pembayaran dan konfirmasi melalui portal kami:\nhttp://localhost:3001/bayar/rassyhvre%40gmail.com\n\nAbaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.'),
(34, 5, '2026-08-10 11:27:04', 'terkirim', 'Halo rassy,\n\nIni adalah pesan otomatis dari ESP Lintas Data Multimedia.\n\n🚨 *PEMBERITAHUAN TUNGGAKAN* 🚨\nTagihan internet Anda untuk periode 2026-08 sebesar *Rp 385.000* TELAH LEWAT JATUH TEMPO pada tanggal 2 Agustus 2026.\n\nMohon segera lakukan pembayaran agar koneksi internet Anda tidak terputus secara otomatis.\n\nSilakan lakukan pembayaran dan konfirmasi melalui portal kami:\nhttp://localhost:3001/bayar/rassyhvre%40gmail.com\n\nAbaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.'),
(35, 3, '2026-09-07 12:59:19', 'terkirim', 'Halo Satya,\n\nIni adalah pesan otomatis dari ESP Lintas Data Multimedia.\n\n🚨 *PEMBERITAHUAN TUNGGAKAN* 🚨\nTagihan internet Anda untuk periode 2026-07 sebesar *Rp 330.000* TELAH LEWAT JATUH TEMPO pada tanggal 22 Juli 2026.\n\nMohon segera lakukan pembayaran agar koneksi internet Anda tidak terputus secara otomatis.\n\nSilakan lakukan pembayaran dan konfirmasi melalui portal kami:\nhttp://localhost:3001/bayar/namaprojek.testing%40gmail.com\n\nAbaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.');

-- --------------------------------------------------------

--
-- Table structure for table `tagihan`
--

CREATE TABLE `tagihan` (
  `id_tagihan` int UNSIGNED NOT NULL,
  `id_pelanggan` int UNSIGNED NOT NULL,
  `periode` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nominal` decimal(12,2) NOT NULL,
  `status` enum('belum_bayar','menunggu_verifikasi','lunas','terlambat') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'belum_bayar',
  `due_date` date NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tagihan`
--

INSERT INTO `tagihan` (`id_tagihan`, `id_pelanggan`, `periode`, `nominal`, `status`, `due_date`, `created_at`, `updated_at`) VALUES
(60, 5, '2026-08', 385000.00, 'lunas', '2026-08-02', '2026-07-31 15:09:28', '2026-08-10 11:32:44'),
(61, 5, '2026-09', 385000.00, 'lunas', '2026-08-31', '2026-08-10 11:32:44', '2026-08-10 11:46:07'),
(62, 5, '2026-10', 385000.00, 'lunas', '2026-09-29', '2026-08-10 11:46:07', '2026-08-14 13:21:58'),
(63, 5, '2026-11', 385000.00, 'lunas', '2026-10-28', '2026-08-14 13:21:58', '2026-08-14 13:42:30'),
(64, 5, '2026-12', 385000.00, 'lunas', '2026-11-26', '2026-08-14 13:42:30', '2026-08-14 13:44:21'),
(65, 5, '2027-01', 385000.00, 'belum_bayar', '2026-12-25', '2026-08-14 13:44:21', '2026-08-14 13:44:21'),
(66, 3, '2026-07', 330000.00, 'terlambat', '2026-07-22', '2026-09-07 12:55:58', '2026-09-07 12:59:10'),
(67, 4, '2026-09', 200000.00, 'belum_bayar', '2026-09-18', '2026-09-07 12:55:58', '2026-09-07 12:55:58');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin`
--
ALTER TABLE `admin`
  ADD PRIMARY KEY (`id_admin`),
  ADD UNIQUE KEY `uq_admin_username` (`username`);

--
-- Indexes for table `customer_otp`
--
ALTER TABLE `customer_otp`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `laporan_bulanan`
--
ALTER TABLE `laporan_bulanan`
  ADD PRIMARY KEY (`id_laporan`),
  ADD UNIQUE KEY `uq_laporan_periode` (`periode`),
  ADD KEY `fk_laporan_admin` (`id_admin`);

--
-- Indexes for table `notifikasi`
--
ALTER TABLE `notifikasi`
  ADD PRIMARY KEY (`id_notifikasi`),
  ADD KEY `fk_notifikasi_pembayaran` (`id_pembayaran`),
  ADD KEY `fk_notifikasi_admin` (`id_admin`),
  ADD KEY `idx_notifikasi_status_baca` (`status_baca`);

--
-- Indexes for table `paket_layanan`
--
ALTER TABLE `paket_layanan`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `pelanggan`
--
ALTER TABLE `pelanggan`
  ADD PRIMARY KEY (`id_pelanggan`),
  ADD UNIQUE KEY `uq_pelanggan_no_hp` (`no_hp`),
  ADD UNIQUE KEY `uq_pelanggan_pppoe` (`pppoe_username`),
  ADD UNIQUE KEY `uq_pelanggan_email` (`email`),
  ADD KEY `idx_pelanggan_no_hp` (`no_hp`),
  ADD KEY `idx_pelanggan_pppoe` (`pppoe_username`),
  ADD KEY `idx_pelanggan_status` (`status_tagihan`);

--
-- Indexes for table `pembayaran`
--
ALTER TABLE `pembayaran`
  ADD PRIMARY KEY (`id_pembayaran`),
  ADD KEY `fk_pembayaran_tagihan` (`id_tagihan`),
  ADD KEY `fk_pembayaran_admin` (`id_admin`),
  ADD KEY `idx_pembayaran_status` (`status`);

--
-- Indexes for table `pengaturan`
--
ALTER TABLE `pengaturan`
  ADD PRIMARY KEY (`kunci`);

--
-- Indexes for table `pengeluaran`
--
ALTER TABLE `pengeluaran`
  ADD PRIMARY KEY (`id_pengeluaran`),
  ADD KEY `fk_pengeluaran_admin` (`id_admin`),
  ADD KEY `idx_pengeluaran_tanggal` (`tanggal`),
  ADD KEY `idx_pengeluaran_tipe` (`tipe`);

--
-- Indexes for table `reminder_log`
--
ALTER TABLE `reminder_log`
  ADD PRIMARY KEY (`id_reminder`),
  ADD KEY `fk_reminder_pelanggan` (`id_pelanggan`),
  ADD KEY `idx_reminder_tanggal` (`tanggal_kirim`);

--
-- Indexes for table `tagihan`
--
ALTER TABLE `tagihan`
  ADD PRIMARY KEY (`id_tagihan`),
  ADD UNIQUE KEY `uq_tagihan_periode` (`id_pelanggan`,`periode`),
  ADD KEY `idx_tagihan_status` (`status`),
  ADD KEY `idx_tagihan_due_date` (`due_date`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admin`
--
ALTER TABLE `admin`
  MODIFY `id_admin` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `customer_otp`
--
ALTER TABLE `customer_otp`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=54;

--
-- AUTO_INCREMENT for table `laporan_bulanan`
--
ALTER TABLE `laporan_bulanan`
  MODIFY `id_laporan` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifikasi`
--
ALTER TABLE `notifikasi`
  MODIFY `id_notifikasi` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `paket_layanan`
--
ALTER TABLE `paket_layanan`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `pelanggan`
--
ALTER TABLE `pelanggan`
  MODIFY `id_pelanggan` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `pembayaran`
--
ALTER TABLE `pembayaran`
  MODIFY `id_pembayaran` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

--
-- AUTO_INCREMENT for table `pengeluaran`
--
ALTER TABLE `pengeluaran`
  MODIFY `id_pengeluaran` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `reminder_log`
--
ALTER TABLE `reminder_log`
  MODIFY `id_reminder` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

--
-- AUTO_INCREMENT for table `tagihan`
--
ALTER TABLE `tagihan`
  MODIFY `id_tagihan` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=68;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `laporan_bulanan`
--
ALTER TABLE `laporan_bulanan`
  ADD CONSTRAINT `fk_laporan_admin` FOREIGN KEY (`id_admin`) REFERENCES `admin` (`id_admin`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `notifikasi`
--
ALTER TABLE `notifikasi`
  ADD CONSTRAINT `fk_notifikasi_admin` FOREIGN KEY (`id_admin`) REFERENCES `admin` (`id_admin`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notifikasi_pembayaran` FOREIGN KEY (`id_pembayaran`) REFERENCES `pembayaran` (`id_pembayaran`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `pembayaran`
--
ALTER TABLE `pembayaran`
  ADD CONSTRAINT `fk_pembayaran_admin` FOREIGN KEY (`id_admin`) REFERENCES `admin` (`id_admin`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pembayaran_tagihan` FOREIGN KEY (`id_tagihan`) REFERENCES `tagihan` (`id_tagihan`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `pengeluaran`
--
ALTER TABLE `pengeluaran`
  ADD CONSTRAINT `fk_pengeluaran_admin` FOREIGN KEY (`id_admin`) REFERENCES `admin` (`id_admin`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `reminder_log`
--
ALTER TABLE `reminder_log`
  ADD CONSTRAINT `fk_reminder_pelanggan` FOREIGN KEY (`id_pelanggan`) REFERENCES `pelanggan` (`id_pelanggan`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `tagihan`
--
ALTER TABLE `tagihan`
  ADD CONSTRAINT `fk_tagihan_pelanggan` FOREIGN KEY (`id_pelanggan`) REFERENCES `pelanggan` (`id_pelanggan`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
