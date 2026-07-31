var PDFDocument = require('pdfkit');
var path = require('path');
var fs = require('fs');

/**
 * Format currency to Indonesian Rupiah (e.g. Rp 150.000)
 */
function formatRupiah(num) {
  var val = Number(num) || 0;
  return 'Rp ' + val.toLocaleString('id-ID');
}

/**
 * Format date string to ID standard (e.g. 31/08/2026)
 */
function formatDateShort(dateInput) {
  if (!dateInput) return '-';
  var d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  var day = String(d.getDate()).padStart(2, '0');
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format date string to ID long standard (e.g. 31 Aug, 2026)
 */
function formatDateLong(dateInput) {
  if (!dateInput) return '-';
  var d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

var PdfService = {
  /**
   * Generate Invoice PDF as a Buffer
   * @param {Object} data - Contains tagihan & pelanggan details
   * @param {boolean} isPaid - Status of invoice (true = Lunas, false = Belum Bayar / Terlambat)
   * @returns {Promise<Buffer>}
   */
  generateInvoicePdf: function (data, isPaid) {
    return new Promise((resolve, reject) => {
      try {
        var doc = new PDFDocument({
          size: 'A4',
          margin: 40
        });

        var buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          var pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', (err) => reject(err));

        // Data extraction with safe fallbacks
        var idTagihan = data.id_tagihan || data.id || '0000';
        var periode = data.periode || '2026-07';
        var invNumber = `INV/${periode.replace('-', '')}/${String(idTagihan).padStart(4, '0')}`;
        
        var tanggalTagihan = formatDateShort(data.created_at || data.tanggal_upload || new Date());
        var tanggalJatuhTempo = formatDateShort(data.due_date);
        var namaPelanggan = data.nama || data.nama_pelanggan || 'Pelanggan';
        var emailPelanggan = data.email || '-';
        var hpPelanggan = data.no_hp || '-';
        var alamatPelanggan = (data.alamat && data.alamat.trim() !== '' && data.alamat.trim() !== '-')
          ? data.alamat.trim()
          : 'Alamat tidak terdaftar';
        var paketName = data.paket || data.nama_paket || 'Paket Internet LDM';
        var nominal = Number(data.nominal || 0);

        // ----------------------------------------------------
        // 1. HEADER SECTION (Logo & Title)
        // ----------------------------------------------------
        var logoPath = path.join(__dirname, '../public/logo_ldm.png');
        
        // Check for uploaded custom logo first
        var customLogoDir = path.join(__dirname, '../public/uploads/logo');
        if (fs.existsSync(customLogoDir)) {
          var uploadedFiles = fs.readdirSync(customLogoDir).filter(f => f.startsWith('company_logo'));
          if (uploadedFiles.length > 0) {
            logoPath = path.join(customLogoDir, uploadedFiles[0]);
          }
        }

        // Draw Logo if exists
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 40, 35, { fit: [130, 60] });
        } else {
          // Text logo fallback
          doc.fillColor('#006190')
             .fontSize(18)
             .font('Helvetica-Bold')
             .text('LINTAS DATA', 40, 45)
             .fontSize(10)
             .text('MULTIMEDIA', 40, 68);
        }

        // Invoice Header Title (Top Right)
        doc.fillColor('#006190')
           .fontSize(24)
           .font('Helvetica-Bold')
           .text('Invoice', 350, 35, { align: 'right', width: 205 });

        // Invoice Metadata Right-aligned
        var metaY = 70;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569');
        
        doc.text('Referensi', 330, metaY, { width: 100, align: 'right' });
        doc.font('Helvetica').fillColor('#0F172A').text(invNumber, 440, metaY, { width: 115, align: 'right' });

        metaY += 14;
        doc.font('Helvetica-Bold').fillColor('#475569').text('Tanggal', 330, metaY, { width: 100, align: 'right' });
        doc.font('Helvetica').fillColor('#0F172A').text(tanggalTagihan, 440, metaY, { width: 115, align: 'right' });

        metaY += 14;
        doc.font('Helvetica-Bold').fillColor('#475569').text('Tgl. Jatuh Tempo', 330, metaY, { width: 100, align: 'right' });
        doc.font('Helvetica').fillColor('#0F172A').text(tanggalJatuhTempo, 440, metaY, { width: 115, align: 'right' });

        metaY += 14;
        doc.font('Helvetica-Bold').fillColor('#475569').text('No. NPWP', 330, metaY, { width: 100, align: 'right' });
        doc.font('Helvetica').fillColor('#0F172A').text('80.942.488.0-436.000', 440, metaY, { width: 115, align: 'right' });

        // Horizontal Line Separator
        doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, 140).lineTo(555, 140).stroke();

        // ----------------------------------------------------
        // 2. TWO-COLUMN ADDRESS SECTION
        // ----------------------------------------------------
        var sectionY = 150;

        // Left Column: Info Perusahaan (Surabaya Intiland Tower)
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E293B')
           .text('Info Perusahaan', 40, sectionY);
        doc.strokeColor('#006190').lineWidth(1.5).moveTo(40, sectionY + 14).lineTo(250, sectionY + 14).stroke();

        var compY = sectionY + 22;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#006190').text('PT. LINTAS DATA MULTIMEDIA', 40, compY);
        compY += 14;
        doc.fontSize(9).font('Helvetica').fillColor('#475569');
        doc.text('Intiland Tower Lt. 11 Unit 3A', 40, compY); compY += 12;
        doc.text('Jl. Panglima Sudirman No. 101-103', 40, compY); compY += 12;
        doc.text('Surabaya, Jawa Timur 60271', 40, compY); compY += 12;
        doc.text('Telp: (031) 33030088 / 0822-9913-9449', 40, compY); compY += 12;
        doc.text('Email: cs@lintasdata.net.id', 40, compY);

        // Right Column: Tagihan Untuk (Detail Pelanggan)
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E293B')
           .text('Tagihan Untuk', 310, sectionY);
        doc.strokeColor('#006190').lineWidth(1.5).moveTo(310, sectionY + 14).lineTo(555, sectionY + 14).stroke();

        var custY = sectionY + 22;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#006190').text(namaPelanggan.toUpperCase(), 310, custY);
        custY += 14;
        doc.fontSize(9).font('Helvetica').fillColor('#475569');
        
        doc.text(alamatPelanggan, 310, custY, { width: 245 });
        var alamatHeight = doc.heightOfString(alamatPelanggan, { width: 245 });
        custY += Math.max(alamatHeight + 4, 16);

        doc.text('Telp: ' + hpPelanggan, 310, custY); custY += 12;
        doc.text('Email: ' + emailPelanggan, 310, custY);

        // ----------------------------------------------------
        // 3. TABLE OF ITEMS
        // ----------------------------------------------------
        var tableY = 250;
        var tableHeaderHeight = 22;
        
        // Header background (Dark Navy #1F2D3D)
        doc.rect(40, tableY, 515, tableHeaderHeight).fill('#1F2D3D');

        // Header Text
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
        doc.text('Produk', 48, tableY + 6, { width: 120 });
        doc.text('Deskripsi', 170, tableY + 6, { width: 130 });
        doc.text('Qty', 305, tableY + 6, { width: 35, align: 'center' });
        doc.text('Harga', 345, tableY + 6, { width: 75, align: 'right' });
        doc.text('Disc', 425, tableY + 6, { width: 35, align: 'center' });
        doc.text('Pajak', 465, tableY + 6, { width: 35, align: 'center' });
        doc.text('Jumlah', 500, tableY + 6, { width: 50, align: 'right' });

        // Item Row 1
        var rowY = tableY + tableHeaderHeight;
        var rowHeight = 35;

        // Subtle background fill for item row
        doc.rect(40, rowY, 515, rowHeight).fill('#F8FAFC');

        doc.fontSize(9).font('Helvetica').fillColor('#1E293B');
        doc.text(paketName, 48, rowY + 10, { width: 120 });
        doc.text(`Layanan Internet Periode ${periode}`, 170, rowY + 10, { width: 130 });
        doc.text('1', 305, rowY + 10, { width: 35, align: 'center' });
        doc.text((nominal).toLocaleString('id-ID'), 345, rowY + 10, { width: 75, align: 'right' });
        doc.text('0%', 425, rowY + 10, { width: 35, align: 'center' });
        doc.text('-', 465, rowY + 10, { width: 35, align: 'center' });
        doc.text((nominal).toLocaleString('id-ID'), 500, rowY + 10, { width: 50, align: 'right' });

        // Table Bottom Border
        doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, rowY + rowHeight).lineTo(555, rowY + rowHeight).stroke();

        // ----------------------------------------------------
        // 4. SUMMARY & NOTES SECTION
        // ----------------------------------------------------
        var summaryY = rowY + rowHeight + 25;

        // Left Side: Keterangan & Syarat Ketentuan
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1E293B').text('Keterangan', 40, summaryY);
        doc.strokeColor('#94A3B8').lineWidth(1).moveTo(40, summaryY + 12).lineTo(250, summaryY + 12).stroke();
        
        doc.fontSize(8.5).font('Helvetica').fillColor('#475569')
           .text('Pembayaran tagihan internet tepat waktu menjaga kelancaran koneksi Anda. Mohon sertakan ID/Nomor Referensi saat transfer.', 40, summaryY + 18, { width: 210, lineGap: 3 });

        var termY = summaryY + 65;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1E293B').text('Syarat & Ketentuan', 40, termY);
        doc.strokeColor('#94A3B8').lineWidth(1).moveTo(40, termY + 12).lineTo(250, termY + 12).stroke();
        
        doc.fontSize(8.5).font('Helvetica').fillColor('#475569')
           .text('1. Pembayaran dapat dilakukan via Transfer Bank atau Portal Pembayaran LDM.\n2. Layanan akan terisolir otomatis jika pembayaran melewati tanggal jatuh tempo.', 40, termY + 18, { width: 210, lineGap: 3 });

        // Right Side: Amount Calculations
        var calcY = summaryY;
        var calcXLabel = 320;
        var calcXVal = 440;
        var calcWidthVal = 115;

        function addCalcRow(label, valueStr, isBold = false) {
          doc.fontSize(9)
             .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
             .fillColor('#334155')
             .text(label, calcXLabel, calcY, { width: 110, align: 'right' });

          doc.fontSize(9)
             .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
             .fillColor('#0F172A')
             .text(valueStr, calcXVal, calcY, { width: calcWidthVal, align: 'right' });
          calcY += 15;
        }

        addCalcRow('Subtotal', formatRupiah(nominal));
        addCalcRow('Total Diskon', 'Rp 0');
        addCalcRow('Diskon Tambahan', 'Rp 0');
        addCalcRow('Pajak', 'Rp 0');
        addCalcRow('Total', formatRupiah(nominal), true);

        var terbayar = isPaid ? nominal : 0;
        addCalcRow('Lunas', formatRupiah(terbayar));

        calcY += 5;

        // Highlight Box: Pembayaran Lunas (jika sudah lunas) atau Jumlah Tertagih (jika belum bayar)
        var highlightLabel = isPaid ? 'Pembayaran Lunas:' : 'Jumlah Tertagih:';
        var highlightAmount = isPaid ? nominal : nominal;
        var amountColor = isPaid ? '#16A34A' : '#DC2626';

        doc.rect(310, calcY, 245, 32).fill('#E2E8F0');
        
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E293B')
           .text(highlightLabel, 320, calcY + 10);
        
        doc.fontSize(11).font('Helvetica-Bold').fillColor(amountColor)
           .text(formatRupiah(highlightAmount), 430, calcY + 10, { width: 115, align: 'right' });

        // ----------------------------------------------------
        // 5. FOOTER & SIGNATURE
        // ----------------------------------------------------
        var footerY = 710;

        doc.fontSize(9).font('Helvetica').fillColor('#475569')
           .text(formatDateLong(data.created_at || new Date()), 400, footerY, { width: 155, align: 'center' });

        footerY += 15;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#006190')
           .text('PT. LINTAS DATA MULTIMEDIA', 350, footerY, { width: 205, align: 'center' });

        footerY += 35;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1E293B')
           .text('Finance Department', 350, footerY, { width: 205, align: 'center' });

        // End document stream
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
};

module.exports = PdfService;
