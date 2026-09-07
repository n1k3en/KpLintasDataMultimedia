var express = require('express');
var router = express.Router();
var db = require('../config/db');
var Pengeluaran = require('../models/Pengeluaran');
var verifyToken = require('../middleware/auth');
var ExcelJS = require('exceljs');
var path = require('path'); // Wajib ditambahkan untuk memanggil path template

// Protect all report routes with JWT authentication (accessible by operational Admin only, not Super Admin)
router.use(verifyToken);
router.use(verifyToken.requireAdminOnly);

/* GET /api/reports/summary - Get financial summary for a period */
router.get('/summary', function(req, res) {
  var { periode } = req.query;
  if (!periode) {
    var today = new Date();
    var y = today.getFullYear();
    var m = today.getMonth() + 1;
    periode = y + '-' + (m < 10 ? '0' + m : m);
  }

  var incomeSql = `
    SELECT COALESCE(SUM(nominal), 0) as total_pemasukan 
    FROM tagihan 
    WHERE status = 'lunas' AND periode = ?
  `;

  var expenseSql = `
    SELECT COALESCE(SUM(nominal), 0) as total_pengeluaran 
    FROM pengeluaran 
    WHERE DATE_FORMAT(tanggal, '%Y-%m') = ?
  `;

  db.query(incomeSql, [periode], function(err, incomeRes) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil data pemasukan.' });
    }

    db.query(expenseSql, [periode], function(err, expenseRes) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Gagal mengambil data pengeluaran.' });
      }

      var pemasukan = parseFloat(incomeRes[0].total_pemasukan);
      var pengeluaran = parseFloat(expenseRes[0].total_pengeluaran);
      var profit = pemasukan - pengeluaran;

      res.json({
        success: true,
        data: {
          periode: periode,
          total_pemasukan: pemasukan,
          total_pengeluaran: pengeluaran,
          laba_bersih: profit
        }
      });
    });
  });
});

/* GET /api/reports/details - Get financial transactions detail lists */
router.get('/details', function(req, res) {
  var { periode } = req.query;
  if (!periode) {
    var today = new Date();
    var y = today.getFullYear();
    var m = today.getMonth() + 1;
    periode = y + '-' + (m < 10 ? '0' + m : m);
  }

  var incomeSql = `
    SELECT t.*, p.nama, p.no_hp 
    FROM tagihan t 
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
    WHERE t.status = 'lunas' AND t.periode = ?
    ORDER BY t.updated_at DESC
  `;

  db.query(incomeSql, [periode], function(err, incomes) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil detail pemasukan.' });
    }

    Pengeluaran.getAll(periode, function(err, expenses) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Gagal mengambil detail pengeluaran.' });
      }

      res.json({
        success: true,
        data: {
          pemasukan_list: incomes,
          pengeluaran_list: expenses
        }
      });
    });
  });
});

/* GET /api/reports/export-excel - EXPORT 12 SHEET BULANAN (SHEET 1 JANUARI S/D SHEET 12 DESEMBER) */
router.get('/export-excel', function (req, res) {
  var { periode, year } = req.query;
  var selectedYear;
  if (year) {
    selectedYear = year.toString();
  } else if (periode) {
    selectedYear = periode.split('-')[0];
  } else {
    selectedYear = new Date().getFullYear().toString();
  }

  // 1. Ambil seluruh data pemasukan (tagihan lunas) untuk tahun yang dipilih
  var incomeSql = `
    SELECT 
      t.*, 
      p.nama, p.email, p.no_hp, p.alamat, p.pppoe_username,
      pk.nama_paket, pk.harga,
      SUBSTRING(t.periode, 6, 2) as bulan_periode
    FROM tagihan t 
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
    LEFT JOIN paket_layanan pk ON p.paket = pk.nama_paket
    WHERE t.status = 'lunas' AND t.periode LIKE ?
    ORDER BY t.updated_at DESC
  `;

  // 2. Ambil seluruh data pengeluaran untuk tahun yang dipilih
  var expenseSql = `
    SELECT 
      p.*, 
      a.nama as nama_admin,
      DATE_FORMAT(p.tanggal, '%m') as bulan_pengeluaran
    FROM pengeluaran p 
    LEFT JOIN admin a ON p.id_admin = a.id_admin 
    WHERE DATE_FORMAT(p.tanggal, '%Y') = ?
    ORDER BY p.tanggal DESC, p.created_at DESC
  `;

  db.query(incomeSql, [selectedYear + '-%'], function (err, allIncomes) {
    if (err) {
      console.error("Error SQL Pemasukan:", err);
      return res.status(500).send('Gagal mengambil data pemasukan tahunan.');
    }

    db.query(expenseSql, [selectedYear], async function (expErr, allExpenses) {
      if (expErr) {
        console.error("Error SQL Pengeluaran:", expErr);
        return res.status(500).send('Gagal mengambil data pengeluaran tahunan.');
      }

      try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'PT. Lintas Data Multimedia';
        workbook.lastModifiedBy = 'Sistem ESP Lintas Data';
        workbook.created = new Date();
        workbook.modified = new Date();

        var monthNames = [
          "Januari", "Februari", "Maret", "April", "Mei", "Juni",
          "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ];

        var borderThin = {
          top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
        };

        var alignCenter = { vertical: 'middle', horizontal: 'center', wrapText: true };
        var alignLeft = { vertical: 'middle', horizontal: 'left', wrapText: true };
        var alignRight = { vertical: 'middle', horizontal: 'right', wrapText: false };

        var fontHeader = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        var fontData = { name: 'Calibri', size: 10 };
        var fontDataBold = { name: 'Calibri', size: 10, bold: true };

        // Group data by month index 1..12
        var incomesByMonth = {};
        var expensesByMonth = {};
        for (var m = 1; m <= 12; m++) {
          incomesByMonth[m] = [];
          expensesByMonth[m] = [];
        }

        (allIncomes || []).forEach(function (inc) {
          var mIdx = parseInt(inc.bulan_periode, 10);
          if (mIdx >= 1 && mIdx <= 12) {
            incomesByMonth[mIdx].push(inc);
          }
        });

        (allExpenses || []).forEach(function (exp) {
          var mIdx = parseInt(exp.bulan_pengeluaran, 10);
          if (mIdx >= 1 && mIdx <= 12) {
            expensesByMonth[mIdx].push(exp);
          }
        });

        // Generate Sheet 1 (Januari) s/d Sheet 12 (Desember)
        monthNames.forEach(function (monthName, idx) {
          var monthNum = idx + 1;
          var sheetName = monthNum + '. ' + monthName;
          var sheet = workbook.addWorksheet(sheetName, {
            views: [{ showGridLines: true }]
          });

          // Set column widths
          sheet.columns = [
            { width: 3 },   // Col A: Margin
            { width: 6 },   // Col B: No
            { width: 14 },  // Col C: Tanggal
            { width: 24 },  // Col D: Nama / Kategori
            { width: 32 },  // Col E: Alamat / Keterangan
            { width: 24 },  // Col F: Email / Petugas
            { width: 16 },  // Col G: No. HP / Tipe
            { width: 22 },  // Col H: Paket
            { width: 18 },  // Col I: PPPoE
            { width: 18 }   // Col J: Nominal
          ];

          var monthIncomes = incomesByMonth[monthNum] || [];
          var monthExpenses = expensesByMonth[monthNum] || [];

          var totalPemasukan = monthIncomes.reduce(function (sum, item) { return sum + parseFloat(item.nominal || 0); }, 0);
          var totalPengeluaran = monthExpenses.reduce(function (sum, item) { return sum + parseFloat(item.nominal || 0); }, 0);
          var labaBersih = totalPemasukan - totalPengeluaran;

          // ==========================================
          // Header Dokumen
          // ==========================================
          sheet.mergeCells('B2:J2');
          var titleCell = sheet.getCell('B2');
          titleCell.value = 'LAPORAN KEUANGAN BULAN ' + monthName.toUpperCase() + ' ' + selectedYear;
          titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1F4E78' } };
          titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

          sheet.mergeCells('B3:J3');
          var subTitleCell = sheet.getCell('B3');
          subTitleCell.value = 'PT. Lintas Data Multimedia | Internet Service Provider (ESP Platform)';
          subTitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF595959' } };
          subTitleCell.alignment = { vertical: 'middle', horizontal: 'left' };

          sheet.mergeCells('B4:J4');
          var infoCell = sheet.getCell('B4');
          infoCell.value = 'Sheet ' + monthNum + ' dari 12 | Periode Transaksi: 01 ' + monthName + ' ' + selectedYear + ' s/d akhir bulan';
          infoCell.font = { name: 'Calibri', size: 9, color: { argb: 'FF7F7F7F' } };
          infoCell.alignment = { vertical: 'middle', horizontal: 'left' };

          // ==========================================
          // KPI Summary Cards (Row 6 - 7)
          // ==========================================
          // Box 1: Total Pemasukan
          sheet.mergeCells('B6:D6');
          var kpiTitle1 = sheet.getCell('B6');
          kpiTitle1.value = 'TOTAL PEMASUKAN';
          kpiTitle1.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
          kpiTitle1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
          kpiTitle1.alignment = alignCenter;

          sheet.mergeCells('B7:D7');
          var kpiVal1 = sheet.getCell('B7');
          kpiVal1.value = totalPemasukan;
          kpiVal1.numFormat = '"Rp"#,##0';
          kpiVal1.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1F4E78' } };
          kpiVal1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF1F5' } };
          kpiVal1.alignment = alignCenter;

          // Box 2: Total Pengeluaran
          sheet.mergeCells('E6:G6');
          var kpiTitle2 = sheet.getCell('E6');
          kpiTitle2.value = 'TOTAL PENGELUARAN';
          kpiTitle2.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
          kpiTitle2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC65911' } };
          kpiTitle2.alignment = alignCenter;

          sheet.mergeCells('E7:G7');
          var kpiVal2 = sheet.getCell('E7');
          kpiVal2.value = totalPengeluaran;
          kpiVal2.numFormat = '"Rp"#,##0';
          kpiVal2.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFC65911' } };
          kpiVal2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
          kpiVal2.alignment = alignCenter;

          // Box 3: Laba Bersih
          sheet.mergeCells('H6:J6');
          var kpiTitle3 = sheet.getCell('H6');
          kpiTitle3.value = 'LABA BERSIH (PROFIT)';
          kpiTitle3.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
          kpiTitle3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006876' } };
          kpiTitle3.alignment = alignCenter;

          sheet.mergeCells('H7:J7');
          var kpiVal3 = sheet.getCell('H7');
          kpiVal3.value = labaBersih;
          kpiVal3.numFormat = '"Rp"#,##0';
          kpiVal3.font = { name: 'Calibri', size: 13, bold: true, color: { argb: labaBersih >= 0 ? 'FF006876' : 'FFC00000' } };
          kpiVal3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
          kpiVal3.alignment = alignCenter;

          // Border for summary boxes
          ['B6','C6','D6','B7','C7','D7','E6','F6','G6','E7','F7','G7','H6','I6','J6','H7','I7','J7'].forEach(function (addr) {
            sheet.getCell(addr).border = borderThin;
          });

          // ==========================================
          // 1. TABEL DETAIL PEMASUKAN (TAGIHAN LUNAS)
          // ==========================================
          var currentRow = 10;
          sheet.getCell('B' + currentRow).value = 'A. DETAIL PEMASUKAN (TAGIHAN LUNAS ' + monthName.toUpperCase() + ')';
          sheet.getCell('B' + currentRow).font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF1F4E78' } };
          currentRow++;

          var incomeHeaders = [
            'No', 'Tanggal Bayar', 'Nama Pelanggan', 'Alamat',
            'Email', 'No. WhatsApp', 'Paket Layanan', 'Username PPPoE', 'Nominal'
          ];

          incomeHeaders.forEach(function (h, hIdx) {
            var cell = sheet.getCell(currentRow, hIdx + 2);
            cell.value = h;
            cell.font = fontHeader;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
            cell.border = borderThin;
            cell.alignment = alignCenter;
          });
          currentRow++;

          if (monthIncomes.length === 0) {
            sheet.mergeCells('B' + currentRow + ':J' + currentRow);
            var emptyIncCell = sheet.getCell('B' + currentRow);
            emptyIncCell.value = '(Tidak ada transaksi penerimaan tagihan lunas pada bulan ' + monthName + ')';
            emptyIncCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF888888' } };
            emptyIncCell.alignment = alignCenter;
            for (var c = 2; c <= 10; c++) {
              sheet.getCell(currentRow, c).border = borderThin;
            }
            currentRow++;
          } else {
            monthIncomes.forEach(function (item, index) {
              var row = sheet.getRow(currentRow);
              row.getCell(2).value = index + 1;
              row.getCell(3).value = item.updated_at ? new Date(item.updated_at).toLocaleDateString('id-ID') : '-';
              row.getCell(4).value = item.nama || '-';
              row.getCell(5).value = item.alamat || '-';
              row.getCell(6).value = item.email || '-';
              row.getCell(7).value = item.no_hp || '-';
              row.getCell(8).value = item.nama_paket ? item.nama_paket + ' (Rp ' + Number(item.harga || 0).toLocaleString('id-ID') + ')' : '-';
              row.getCell(9).value = item.pppoe_username || '-';

              var nominalCell = row.getCell(10);
              nominalCell.value = parseFloat(item.nominal || 0);
              nominalCell.numFormat = '"Rp"#,##0';

              var isEven = index % 2 === 1;
              for (var col = 2; col <= 10; col++) {
                var cCell = row.getCell(col);
                cCell.border = borderThin;
                cCell.font = fontData;
                if (isEven) {
                  cCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FBFD' } };
                }
                if (col === 2 || col === 3 || col === 7 || col === 9) {
                  cCell.alignment = alignCenter;
                } else if (col === 10) {
                  cCell.alignment = alignRight;
                } else {
                  cCell.alignment = alignLeft;
                }
              }
              currentRow++;
            });
          }

          // Subtotal Pemasukan Row
          sheet.mergeCells('B' + currentRow + ':I' + currentRow);
          var subIncLabel = sheet.getCell('B' + currentRow);
          subIncLabel.value = 'TOTAL PEMASUKAN ' + monthName.toUpperCase() + ':';
          subIncLabel.font = fontDataBold;
          subIncLabel.alignment = alignRight;

          var subIncVal = sheet.getCell('J' + currentRow);
          subIncVal.value = totalPemasukan;
          subIncVal.numFormat = '"Rp"#,##0';
          subIncVal.font = fontDataBold;
          subIncVal.alignment = alignRight;

          for (var sc = 2; sc <= 10; sc++) {
            var subCell = sheet.getCell(currentRow, sc);
            subCell.border = borderThin;
            subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF1F5' } };
          }
          currentRow += 2; // spasi antar tabel

          // ==========================================
          // 2. TABEL DETAIL PENGELUARAN OPERASIONAL
          // ==========================================
          sheet.getCell('B' + currentRow).value = 'B. DETAIL PENGELUARAN OPERASIONAL (' + monthName.toUpperCase() + ')';
          sheet.getCell('B' + currentRow).font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFC65911' } };
          currentRow++;

          // Header Pengeluaran: Kolom B (No), C (Tanggal), D (Kategori), E (Keterangan), F (Petugas), G-I Merged (Tipe), J (Nominal)
          var expRow = sheet.getRow(currentRow);
          expRow.getCell(2).value = 'No';
          expRow.getCell(3).value = 'Tanggal';
          expRow.getCell(4).value = 'Kategori Pengeluaran';
          expRow.getCell(5).value = 'Keterangan / Rincian';
          expRow.getCell(6).value = 'Petugas / Admin';
          expRow.getCell(7).value = 'Tipe Beban';
          expRow.getCell(8).value = '';
          expRow.getCell(9).value = '';
          expRow.getCell(10).value = 'Nominal Pengeluaran';

          sheet.mergeCells('G' + currentRow + ':I' + currentRow);

          for (var ec = 2; ec <= 10; ec++) {
            var ehCell = sheet.getCell(currentRow, ec);
            ehCell.font = fontHeader;
            ehCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC65911' } };
            ehCell.border = borderThin;
            ehCell.alignment = alignCenter;
          }
          currentRow++;

          if (monthExpenses.length === 0) {
            sheet.mergeCells('B' + currentRow + ':J' + currentRow);
            var emptyExpCell = sheet.getCell('B' + currentRow);
            emptyExpCell.value = '(Tidak ada catatan pengeluaran operasional pada bulan ' + monthName + ')';
            emptyExpCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF888888' } };
            emptyExpCell.alignment = alignCenter;
            for (var c2 = 2; c2 <= 10; c2++) {
              sheet.getCell(currentRow, c2).border = borderThin;
            }
            currentRow++;
          } else {
            monthExpenses.forEach(function (item, index) {
              var r = sheet.getRow(currentRow);
              r.getCell(2).value = index + 1;
              r.getCell(3).value = item.tanggal ? new Date(item.tanggal).toLocaleDateString('id-ID') : '-';
              r.getCell(4).value = item.kategori || '-';
              r.getCell(5).value = item.keterangan || '-';
              r.getCell(6).value = item.nama_admin || '-';
              r.getCell(7).value = item.tipe === 'fix' ? 'Beban Tetap (Fix)' : 'Beban Variabel';
              
              sheet.mergeCells('G' + currentRow + ':I' + currentRow);

              var expNominalCell = r.getCell(10);
              expNominalCell.value = parseFloat(item.nominal || 0);
              expNominalCell.numFormat = '"Rp"#,##0';

              var isEven2 = index % 2 === 1;
              for (var c3 = 2; c3 <= 10; c3++) {
                var dCell = r.getCell(c3);
                dCell.border = borderThin;
                dCell.font = fontData;
                if (isEven2) {
                  dCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF8F5' } };
                }
                if (c3 === 2 || c3 === 3 || c3 === 7) {
                  dCell.alignment = alignCenter;
                } else if (c3 === 10) {
                  dCell.alignment = alignRight;
                } else {
                  dCell.alignment = alignLeft;
                }
              }
              currentRow++;
            });
          }

          // Subtotal Pengeluaran Row
          sheet.mergeCells('B' + currentRow + ':I' + currentRow);
          var subExpLabel = sheet.getCell('B' + currentRow);
          subExpLabel.value = 'TOTAL PENGELUARAN ' + monthName.toUpperCase() + ':';
          subExpLabel.font = fontDataBold;
          subExpLabel.alignment = alignRight;

          var subExpVal = sheet.getCell('J' + currentRow);
          subExpVal.value = totalPengeluaran;
          subExpVal.numFormat = '"Rp"#,##0';
          subExpVal.font = fontDataBold;
          subExpVal.alignment = alignRight;

          for (var sec = 2; sec <= 10; sec++) {
            var subExpCell = sheet.getCell(currentRow, sec);
            subExpCell.border = borderThin;
            subExpCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
          }
        });

        // Set response headers
        var downloadFilename = 'Laporan_Keuangan_Tahunan_' + selectedYear + '_(Januari-Desember).xlsx';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="' + downloadFilename + '"');

        await workbook.xlsx.write(res);
        res.end();

      } catch (error) {
        console.error('Error saat membuat 12 sheet Excel:', error);
        res.status(500).send('Gagal mengekspor laporan: ' + error.message);
      }
    });
  });
});

/* GET /api/reports/yearly-chart - Get 12 months of financial data for line chart */
router.get('/yearly-chart', function(req, res) {
  var year = req.query.year;
  if (!year) {
    year = new Date().getFullYear();
  }
  year = parseInt(year, 10);

  var incomeSql = `
    SELECT 
      CAST(SUBSTRING(periode, 6, 2) AS UNSIGNED) as bulan,
      COALESCE(SUM(nominal), 0) as total
    FROM tagihan
    WHERE status = 'lunas' AND LEFT(periode, 4) = ?
    GROUP BY bulan
    ORDER BY bulan
  `;

  var expenseSql = `
    SELECT 
      MONTH(tanggal) as bulan,
      COALESCE(SUM(nominal), 0) as total
    FROM pengeluaran
    WHERE YEAR(tanggal) = ?
    GROUP BY bulan
    ORDER BY bulan
  `;

  db.query(incomeSql, [year], function(err, incomeRows) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil data pemasukan tahunan.' });
    }

    db.query(expenseSql, [year], function(err, expenseRows) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Gagal mengambil data pengeluaran tahunan.' });
      }

      // Build a map for quick lookup
      var incomeMap = {};
      incomeRows.forEach(function(r) { incomeMap[r.bulan] = parseFloat(r.total); });

      var expenseMap = {};
      expenseRows.forEach(function(r) { expenseMap[r.bulan] = parseFloat(r.total); });

      // Build 12-month array
      var months = [];
      for (var m = 1; m <= 12; m++) {
        var pemasukan = incomeMap[m] || 0;
        var pengeluaran = expenseMap[m] || 0;
        months.push({
          bulan: m,
          pemasukan: pemasukan,
          pengeluaran: pengeluaran,
          laba_bersih: pemasukan - pengeluaran
        });
      }

      res.json({
        success: true,
        data: {
          year: year,
          months: months
        }
      });
    });
  });
});

/* GET /api/reports/daily-trend - Get daily bill issuance and payment collections for a month */
router.get('/daily-trend', function(req, res) {
  var { periode } = req.query;
  if (!periode) {
    var today = new Date();
    var y = today.getFullYear();
    var m = today.getMonth() + 1;
    periode = y + '-' + (m < 10 ? '0' + m : m);
  }

  var parts = periode.split('-');
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10);
  var daysInMonth = new Date(year, month, 0).getDate();

  var issuedSql = `
    SELECT 
      DAY(created_at) as hari,
      COALESCE(SUM(nominal), 0) as total
    FROM tagihan
    WHERE DATE_FORMAT(created_at, '%Y-%m') = ?
    GROUP BY hari
  `;

  var collectedSql = `
    SELECT 
      DAY(updated_at) as hari,
      COALESCE(SUM(nominal), 0) as total
    FROM tagihan
    WHERE status = 'lunas' AND DATE_FORMAT(updated_at, '%Y-%m') = ?
    GROUP BY hari
  `;

  db.query(issuedSql, [periode], function(err, issuedRows) {
    if (err) {
      console.error('[Daily Trend API] Error fetching issued bills:', err.message);
      return res.status(500).json({ success: false, message: 'Gagal mengambil data tagihan terbit harian.' });
    }

    db.query(collectedSql, [periode], function(err2, collectedRows) {
      if (err2) {
        console.error('[Daily Trend API] Error fetching collected payments:', err2.message);
        return res.status(500).json({ success: false, message: 'Gagal mengambil data pembayaran masuk harian.' });
      }

      var issuedMap = {};
      issuedRows.forEach(function(r) { issuedMap[r.hari] = parseFloat(r.total); });

      var collectedMap = {};
      collectedRows.forEach(function(r) { collectedMap[r.hari] = parseFloat(r.total); });

      var dailyData = [];
      for (var d = 1; d <= daysInMonth; d++) {
        dailyData.push({
          day: d,
          tagihan: issuedMap[d] || 0,
          pembayaran: collectedMap[d] || 0
        });
      }

      res.json({
        success: true,
        data: {
          periode: periode,
          days: dailyData
        }
      });
    });
  });
});

module.exports = router;