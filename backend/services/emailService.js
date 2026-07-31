var nodemailer = require('nodemailer');
var path = require('path');
var fs = require('fs');
var ConfigService = require('./configService');

// Publicly hosted logo URL on raw GitHub to ensure it renders instantly and reliably in Gmail
var LOGO_URL = 'https://raw.githubusercontent.com/rassyhvre/KpLintasDataMultimedia/main/backend/public/logo_ldm.png';

/**
 * Creates a Nodemailer transporter instance dynamically using ConfigService or custom options
 */
function getTransporter(customAuth) {
  var emailUser = (customAuth && customAuth.user) || ConfigService.get('EMAIL_USER', process.env.EMAIL_USER);
  var emailPass = (customAuth && customAuth.pass) || ConfigService.get('EMAIL_PASS', process.env.EMAIL_PASS);

  if (!emailUser || !emailPass) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });
}

var EmailService = {
  /**
   * Send a generic email
   * @param {string} toEmail - Recipient email address
   * @param {string} subject - Email subject
   * @param {string} htmlContent - HTML body content
   * @param {Array} attachments - Optional Nodemailer attachments array
   * @param {Object} customAuth - Optional custom SMTP credentials for testing
   */
  sendEmail: async function (toEmail, subject, htmlContent, attachments, customAuth) {
    var fromName = (customAuth && customAuth.from) || ConfigService.get('EMAIL_FROM', process.env.EMAIL_FROM) || 'ESP Lintas Data <24percobaan24@gmail.com>';
    var transporter = getTransporter(customAuth);

    console.log('[Email Service] Menyiapkan email ke ' + toEmail + ' | Subject: ' + subject);

    // Sandbox mode if credentials are missing
    if (!transporter) {
      console.log('========================================================');
      console.log('⚠️  EMAIL_USER/EMAIL_PASS tidak terkonfigurasi. Mode SANDBOX.');
      console.log('Tujuan: ' + toEmail);
      console.log('Subject: ' + subject);
      if (attachments && attachments.length) {
        console.log('Attachments: ' + attachments.map(function(a) { return a.filename; }).join(', '));
      }
      console.log('Body:\n' + htmlContent);
      console.log('========================================================');
      return { success: true, status: 'simulated', message: 'Simulated success (Sandbox mode: EMAIL_USER/EMAIL_PASS belum diisi)' };
    }

    try {
      var mailOptions = {
        from: fromName,
        to: toEmail,
        subject: subject,
        html: htmlContent
      };

      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments;
      }

      var info = await transporter.sendMail(mailOptions);

      console.log('[Email Service] Email berhasil dikirim ke ' + toEmail + ' | MessageId: ' + info.messageId);
      return { success: true, status: 'terkirim', messageId: info.messageId };
    } catch (err) {
      console.error('[Email Service] Gagal mengirim email ke ' + toEmail + ':', err.message);
      return { success: false, status: 'gagal', error: err.message };
    }
  },

  /**
   * Send OTP verification email for customer login
   */
  sendOtpEmail: async function (toEmail, data) {
    var subject = `[${data.otp}] Ini Adalah Kode Verifikasi Kamu`;
    var logoUrl = LOGO_URL;
    var otpImgSrc = 'https://raw.githubusercontent.com/rassyhvre/KpLintasDataMultimedia/main/backend/public/otp_illustration.png';

    var html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kode Verifikasi OTP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        
        <!-- Main Card Container -->
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; width: 100%; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 2px 10px rgba(0,0,0,0.03); overflow: hidden;">
          <tr>
            <td style="padding: 36px 36px 40px;">
              
              <!-- Logo (Top Left) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="left">
                    <a href="https://lintasdata.net.id" target="_blank" style="text-decoration: none; border: 0;">
                      <img src="${logoUrl}" alt="PT. Lintas Data Multimedia" width="130" style="display: block; height: auto; max-width: 130px; border: 0;">
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Custom Character Illustration Showing Phone with WiFi & LDM Logo -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <img src="${otpImgSrc}" alt="Verifikasi OTP LDM" width="180" style="display: block; height: auto; max-width: 180px; margin: 0 auto; border: 0; border-radius: 8px;">
                  </td>
                </tr>
              </table>

              <!-- Main Headline -->
              <h2 style="margin: 0 0 12px; font-size: 17px; font-weight: 700; color: #0f172a; text-align: left; line-height: 24px;">
                [${data.otp}] Ini Adalah Kode Verifikasi Kamu
              </h2>

              <!-- Subtitle Description -->
              <p style="margin: 0 0 28px; font-size: 14.5px; color: #475569; text-align: left; line-height: 22px;">
                Berikut adalah kode verifikasi yang dapat digunakan untuk login ke Portal Pelanggan LDM Connect:
              </p>

              <!-- Prominent Centered OTP Code -->
              <div style="text-align: center; margin: 32px 0;">
                <span style="font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 40px; font-weight: 800; letter-spacing: 10px; color: #0f172a; display: inline-block;">
                  ${data.otp}
                </span>
              </div>

              <!-- Expiry & Security Notice -->
              <p style="margin: 28px 0 16px; font-size: 13.5px; color: #475569; text-align: left; line-height: 20px;">
                Kode di atas hanya berlaku untuk <strong>5 Menit</strong>. Jangan memberitahukan kode tersebut ke siapapun, termasuk pihak PT Lintas Data Multimedia.
              </p>

              <!-- Support Note -->
              <p style="margin: 0; font-size: 13.5px; color: #475569; text-align: left; line-height: 20px;">
                Bila ada pertanyaan, silakan hubungi kami pada email <a href="mailto:cs@lintasdata.net.id" style="color: #006190; text-decoration: underline;">cs@lintasdata.net.id</a>.
              </p>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
    `;
    return await this.sendEmail(toEmail, subject, html);
  },

  /**
   * Send billing reminder email (cron/manual trigger) - Minimalist text style
   */
  sendReminderEmail: async function (toEmail, data, pdfBuffer) {
    var daysDiff = data.daysDiff !== undefined ? data.daysDiff : 1;
    var subject = 'Invoice Tagihan Internet ' + data.nama + ' ' + data.periode;
    var messageText = 'Berikut terlampir invoice tagihan internet Anda untuk periode <strong>' + data.periode + '</strong> sebesar <strong>Rp ' + data.nominal + '</strong>.';
    var dueText = 'Mohon dapat melakukan pembayaran sebelum tanggal jatuh tempo (<strong>' + data.dueDateString + '</strong>) melalui portal kami:';

    if (daysDiff < 0) {
      subject = '⚠️ Tagihan Terlambat ' + data.nama + ' ' + data.periode;
      dueText = 'Tagihan Anda telah <strong>melewati tanggal jatuh tempo</strong> (' + data.dueDateString + '). Mohon segera melakukan pembayaran melalui portal kami:';
    } else if (daysDiff === 0) {
      subject = '⏰ Tagihan Jatuh Tempo Hari Ini ' + data.nama + ' ' + data.periode;
      dueText = 'Tagihan Anda <strong>jatuh tempo pada hari ini</strong> (' + data.dueDateString + '). Mohon segera melakukan pembayaran melalui portal kami:';
    }

    var html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #222222; margin: 0; padding: 20px; }
    a { color: #006190; text-decoration: underline; }
    .btn { display: inline-block; padding: 10px 20px; background-color: #006190; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 12px 0; }
  </style>
</head>
<body>
  <p>👋 <strong>${data.nama}</strong>,</p>

  <p>${messageText}</p>

  <p>${dueText}</p>

  <p><a href="${data.paymentUrl}" class="btn">Bayar & Konfirmasi Sekarang &rarr;</a></p>

  <p>Terima kasih telah mempercayakan PT. Lintas Data Multimedia sebagai teman koneksi internet Anda.</p>

  <p>Bila ada pertanyaan, silakan hubungi kami pada email <a href="mailto:cs@lintasdata.net.id">cs@lintasdata.net.id</a> atau WhatsApp <strong>+62 822-9913-9449</strong>.</p>

  <p>Terima kasih,<br>
  <strong>PT Lintas Data Multimedia</strong></p>
</body>
</html>
    `;

    var attachments = null;
    if (pdfBuffer) {
      var cleanName = (data.nama || 'Pelanggan').replace(/[^a-zA-Z0-9]/g, '_');
      var cleanPeriode = (data.periode || 'tagihan').replace('-', '');
      attachments = [{
        filename: `Invoice_${cleanPeriode}_${cleanName}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }];
    }
    return await this.sendEmail(toEmail, subject, html, attachments);
  },

  /**
   * Send payment approved confirmation email - Minimalist text style
   */
  sendPaymentApprovedEmail: async function (toEmail, data, pdfBuffer) {
    var subject = 'Bukti Pembayaran Disetujui ' + data.nama + ' ' + data.periode;

    var html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #222222; margin: 0; padding: 20px; }
    a { color: #006190; text-decoration: underline; }
  </style>
</head>
<body>
  <p>👋 <strong>${data.nama}</strong>,</p>

  <p>Terima kasih, pembayaran tagihan internet Anda untuk periode <strong>${data.periode}</strong> sebesar <strong>Rp ${data.nominal}</strong> telah berhasil kami terima dan disetujui.</p>

  <p>Berikut terlampir bukti kwitansi/invoice lunas resmi Anda untuk tanggal <strong>${data.tanggalBayar || 'hari ini'}</strong>.</p>

  <p>Terima kasih telah mempercayakan PT. Lintas Data Multimedia sebagai penyedia layanan internet Anda.</p>

  <p>Bila ada pertanyaan, silakan hubungi kami pada email <a href="mailto:cs@lintasdata.net.id">cs@lintasdata.net.id</a> atau WhatsApp <strong>+62 822-9913-9449</strong>.</p>

  <p>Terima kasih,<br>
  <strong>PT Lintas Data Multimedia</strong></p>
</body>
</html>
    `;

    var attachments = null;
    if (pdfBuffer) {
      var cleanName = (data.nama || 'Pelanggan').replace(/[^a-zA-Z0-9]/g, '_');
      var cleanPeriode = (data.periode || 'tagihan').replace('-', '');
      attachments = [{
        filename: `Kwitansi_${cleanPeriode}_${cleanName}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }];
    }
    return await this.sendEmail(toEmail, subject, html, attachments);
  },

  /**
   * Send payment rejected notification email - Minimalist text style
   */
  sendPaymentRejectedEmail: async function (toEmail, data) {
    var subject = '❌ Pembayaran Ditolak - Periode ' + data.periode;

    var html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #222222; margin: 0; padding: 20px; }
    a { color: #006190; text-decoration: underline; }
  </style>
</head>
<body>
  <p>👋 <strong>${data.nama}</strong>,</p>

  <p>Pengajuan pembayaran Anda untuk periode <strong>${data.periode}</strong> sebesar <strong>Rp ${data.nominal}</strong> belum dapat disetujui oleh admin.</p>

  <p><strong>Alasan Penolakan:</strong> <em>"${data.alasan_tolak}"</em></p>

  <p>Silakan mengunggah ulang bukti pembayaran yang valid melalui link berikut:<br>
  <a href="${data.paymentUrl}">${data.paymentUrl}</a></p>

  <p>Bila ada pertanyaan, silakan hubungi kami pada email <a href="mailto:cs@lintasdata.net.id">cs@lintasdata.net.id</a> atau WhatsApp <strong>+62 822-9913-9449</strong>.</p>

  <p>Terima kasih,<br>
  <strong>PT Lintas Data Multimedia</strong></p>
</body>
</html>
    `;
    return await this.sendEmail(toEmail, subject, html);
  }
};

module.exports = EmailService;
