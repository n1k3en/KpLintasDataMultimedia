import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import Modal from '../components/Modal';
import TemplateIcon from '../components/TemplateIcon';
import { API_BASE_URL } from '../config';

function PembayaranPage({ socket }) {
  var [pendingPayments, setPendingPayments] = useState([]);
  var [loading, setLoading] = useState(true);
  var location = useLocation();
  var queryType = new URLSearchParams(location.search).get('type') || 'manual'; // 'manual' or 'midtrans'

  // Modals state
  var [viewBukti, setViewBukti] = useState(null); // holds payment object
  var [rejectTarget, setRejectTarget] = useState(null); // holds payment object
  var [alasanTolak, setAlasanTolak] = useState('');
  var [actionLoading, setActionLoading] = useState(false);
  var [zoomScale, setZoomScale] = useState(1);
  var [successMsg, setSuccessMsg] = useState('');

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  useEffect(function () {
    fetchPending();

    // Listen for new payments uploaded in real-time
    if (socket) {
      socket.on('pembayaran_masuk', function (newPayment) {
        console.log('Ada pembayaran masuk baru:', newPayment);
        setSuccessMsg(`Notifikasi: Pembayaran baru masuk dari ${newPayment.nama_pelanggan}!`);
        fetchPending();

        // Clear toast after 5s
        setTimeout(function () {
          setSuccessMsg('');
        }, 5000);
      });
    }

    return function () {
      if (socket) {
        socket.off('pembayaran_masuk');
      }
    };
  }, [socket, queryType]);

  async function fetchPending() {
    setLoading(true);
    try {
      var url = queryType === 'midtrans'
        ? `${API_BASE_URL}/api/pembayaran/midtrans`
        : `${API_BASE_URL}/api/pembayaran/pending`;
      var response = await axios.get(url, { headers: headers });
      if (response.data.success) {
        setPendingPayments(response.data.data);
      }
    } catch (err) {
      console.error('Gagal mengambil pengajuan pembayaran:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id_pembayaran) {
    if (!window.confirm('Apakah Anda yakin ingin MENYETUJUI pembayaran ini? Akun internet pelanggan akan otomatis diaktifkan di Mikrotik.')) {
      return;
    }

    setActionLoading(true);
    try {
      var response = await axios.post(`${API_BASE_URL}/api/pembayaran/${id_pembayaran}/approve`, {}, { headers: headers });
      alert(response.data.message);
      setViewBukti(null);
      fetchPending();
    } catch (err) {
      alert('Gagal menyetujui pembayaran: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(e) {
    e.preventDefault();
    if (!alasanTolak) {
      alert('Silakan isi alasan penolakan terlebih dahulu.');
      return;
    }

    setActionLoading(true);
    try {
      var response = await axios.post(`${API_BASE_URL}/api/pembayaran/${rejectTarget.id_pembayaran}/reject`, {
        alasan_tolak: alasanTolak
      }, { headers: headers });

      alert(response.data.message);
      setRejectTarget(null);
      setAlasanTolak('');
      setViewBukti(null);
      fetchPending();
    } catch (err) {
      alert('Gagal menolak pembayaran: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  function parseMidtransBukti(buktiStr) {
    if (!buktiStr) return { gateway: 'Online', tipe: 'Online Gateway', status: 'Selesai' };
    var parts = buktiStr.split(' / ');
    var gateway = parts[0] || 'Online';
    var rawType = parts[1] || 'automatic';
    var rawStatus = parts[2] || 'success';

    var tipeMap = {
      'bank_transfer': 'Virtual Account (VA)',
      'qris': 'QRIS (Gopay/OVO/Dana/LinkAja)',
      'credit_card': 'Kartu Kredit',
      'gopay': 'GoPay',
      'shopeepay': 'ShopeePay',
      'cstore': 'Minimarket (Indomaret/Alfamart)'
    };

    var statusMap = {
      'settlement': 'Sukses (Settlement)',
      'capture': 'Sukses (Captured)',
      'success': 'Sukses',
      'pending': 'Tertunda (Pending)',
      'deny': 'Ditolak (Denied)',
      'expire': 'Kadaluarsa (Expired)',
      'cancel': 'Dibatalkan (Cancelled)'
    };

    return {
      gateway: gateway,
      tipe: gateway + ' (' + (tipeMap[rawType] || rawType.replace(/_/g, ' ').toUpperCase()) + ')',
      status: statusMap[rawStatus] || rawStatus.toUpperCase()
    };
  }

  function handleBuktiWheel(e) {
    e.preventDefault();
    setZoomScale(function (prev) {
      var nextScale = prev - e.deltaY * 0.0012;
      return Math.min(3, Math.max(1, nextScale));
    });
  }

  function resetBuktiZoom() {
    setZoomScale(1);
  }

  function formatTanggal(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{queryType === 'midtrans' ? 'Riwayat Pembayaran Online Instan' : 'Persetujuan Pembayaran'}</h1>
          <p>{queryType === 'midtrans' ? 'Daftar transaksi pembayaran tagihan otomatis via Midtrans & Duitku.' : 'Verifikasi bukti transfer dari pelanggan dan aktifkan kembali layanan internet mereka.'}</p>
        </div>
      </div>

      {successMsg && (
        <div className="status-badge hijau animate-fadeIn" style={{ width: '100%', padding: '12px 16px', borderRadius: '5px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
          <TemplateIcon name="bell" size={16} style={{ marginRight: '8px' }} /> {successMsg}
        </div>
      )}

      <div className="table-container animate-fadeIn">
        <div className="table-header">
          <h3>
            <TemplateIcon name="document" size={18} style={{ marginRight: '8px' }} />
            {queryType === 'midtrans' ? `Transaksi Sukses (${pendingPayments.length})` : `Antrean Verifikasi (${pendingPayments.length})`}
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '40px' }}>
            <div className="skeleton skeleton-text lg" style={{ width: '30%' }} />
            <div className="skeleton skeleton-text" style={{ width: '80%', marginTop: '16px' }} />
            <div className="skeleton skeleton-text" style={{ width: '60%', marginTop: '12px' }} />
          </div>
        ) : pendingPayments.length === 0 ? (
          <div className="table-empty">
            <div className="table-empty-icon"><TemplateIcon name="check" size={28} /></div>
            <p>{queryType === 'midtrans' ? 'Belum ada transaksi Midtrans.' : 'Tidak ada pengajuan pembayaran pending saat ini. Semua bersih!'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Pelanggan</th>
                <th>No HP</th>
                <th>Periode Tagihan</th>
                <th>Nominal</th>
                <th>{queryType === 'midtrans' ? 'Waktu Transaksi' : 'Waktu Upload'}</th>
                <th>{queryType === 'midtrans' ? 'Detail' : 'Bukti Transfer'}</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pendingPayments.map(function (item, idx) {
                var isOnlinePayment = item.bukti_file && (item.bukti_file.includes('Midtrans') || item.bukti_file.includes('Duitku'));
                return (
                  <tr key={item.id_pembayaran}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{item.nama}</td>
                    <td>{item.no_hp}</td>
                    <td><code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '5px' }}>{item.periode}</code></td>
                    <td style={{ fontWeight: 700, color: 'var(--primary-light)' }}>
                      Rp {Number(item.nominal).toLocaleString('id-ID')}
                    </td>
                    <td>{formatTanggal(item.tanggal_upload)}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={function () { setZoomScale(1); setViewBukti(item); }}
                      >
                        <TemplateIcon name={isOnlinePayment ? 'document' : 'camera'} size={14} style={{ marginRight: '6px' }} />
                        {isOnlinePayment ? 'Detail Transaksi' : 'Lihat Bukti'}
                      </button>
                    </td>
                    <td>
                      {isOnlinePayment ? (
                        <span className="status-badge hijau">Lunas (Otomatis)</span>
                      ) : (
                        <div className="table-actions">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={function () { handleApprove(item.id_pembayaran); }}
                            disabled={actionLoading}
                          >
                            <TemplateIcon name="check" size={14} style={{ marginRight: '6px' }} /> Terima
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={function () { setRejectTarget(item); }}
                            disabled={actionLoading}
                          >
                            <TemplateIcon name="close" size={14} style={{ marginRight: '6px' }} /> Tolak
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal View Bukti Transfer / Detail Transaksi */}
      {viewBukti && (
        <Modal
          isOpen={viewBukti !== null}
          onClose={function () { resetBuktiZoom(); setViewBukti(null); }}
          title={
            viewBukti.bukti_file && (viewBukti.bukti_file.includes('Midtrans') || viewBukti.bukti_file.includes('Duitku')) ? (
              <><TemplateIcon name="document" size={16} style={{ marginRight: '8px' }} /> Detail Transaksi Online - {viewBukti.nama}</>
            ) : (
              <><TemplateIcon name="camera" size={16} style={{ marginRight: '8px' }} /> Bukti Transfer - {viewBukti.nama}</>
            )
          }
          footer={
            viewBukti.bukti_file && (viewBukti.bukti_file.includes('Midtrans') || viewBukti.bukti_file.includes('Duitku')) ? (
              <button className="btn btn-primary btn-sm" onClick={function () { setViewBukti(null); }}>Tutup</button>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={function () { setViewBukti(null); }}>Batal</button>
                <button
                  className="btn btn-danger"
                  onClick={function () { setRejectTarget(viewBukti); }}
                  disabled={actionLoading}
                >
                  <TemplateIcon name="close" size={14} style={{ marginRight: '6px' }} /> Tolak
                </button>
                <button
                  className="btn btn-primary"
                  onClick={function () { handleApprove(viewBukti.id_pembayaran); }}
                  disabled={actionLoading}
                >
                  <TemplateIcon name="check" size={14} style={{ marginRight: '6px' }} /> Terima Pembayaran
                </button>
              </>
            )
          }
        >
          {viewBukti.bukti_file && (viewBukti.bukti_file.includes('Midtrans') || viewBukti.bukti_file.includes('Duitku')) ? (
            <div style={{ padding: '10px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Nama Pelanggan</span>
                  <span style={{ fontWeight: '700', fontSize: '0.88rem' }}>{viewBukti.nama}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No HP</span>
                  <span style={{ fontWeight: '600', fontSize: '0.88rem' }}>{viewBukti.no_hp}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Periode Tagihan</span>
                  <span style={{ fontWeight: '700', fontSize: '0.88rem' }}>{viewBukti.periode}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Nominal</span>
                  <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '0.88rem' }}>
                    Rp {Number(viewBukti.nominal).toLocaleString('id-ID')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Metode Pembayaran</span>
                  <span style={{ fontWeight: '600', fontSize: '0.88rem' }}>
                    {parseMidtransBukti(viewBukti.bukti_file).tipe}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Status Transaksi</span>
                  <span className="status-badge hijau" style={{ fontSize: '0.78rem' }}>
                    {parseMidtransBukti(viewBukti.bukti_file).status}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Waktu Transaksi</span>
                  <span style={{ fontSize: '0.88rem' }}>{formatTanggal(viewBukti.tanggal_upload)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>ID Pembayaran</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', fontFamily: 'monospace' }}>#{viewBukti.id_pembayaran}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '10px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '14px' }}>
                Tagihan: <strong>Rp {Number(viewBukti.nominal).toLocaleString('id-ID')}</strong> | Periode: <strong>{viewBukti.periode}</strong>
              </p>
              <div className="image-zoom-wrapper">
                <img
                  src={`${API_BASE_URL}${viewBukti.bukti_file}`}
                  alt="Bukti Transfer Pelanggan"
                  className={zoomScale > 1 ? 'image-zoom-image zoomed' : 'image-zoom-image'}
                  onWheel={handleBuktiWheel}
                  style={{ transform: `scale(${zoomScale})`, transformOrigin: 'center center' }}
                />
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Modal Tolak Pembayaran */}
      {rejectTarget && (
        <Modal
          isOpen={rejectTarget !== null}
          onClose={function () { setRejectTarget(null); setAlasanTolak(''); }}
          title={<><TemplateIcon name="close" size={16} style={{ marginRight: '8px' }} /> Tolak Pembayaran - {rejectTarget.nama}</>}
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={function () { setRejectTarget(null); setAlasanTolak(''); }}
              >
                Batal
              </button>
              <button
                className="btn btn-danger"
                onClick={handleReject}
                disabled={actionLoading || !alasanTolak}
              >
                {actionLoading ? <><TemplateIcon name="loading" size={16} style={{ marginRight: '6px' }} /> Mengirim...</> : <><TemplateIcon name="close" size={16} style={{ marginRight: '6px' }} /> Tolak Bukti Transfer</>}
              </button>
            </>
          }
        >
          <form onSubmit={handleReject} style={{ padding: '10px 0' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '14px' }}>
              Berikan alasan penolakan. Alasan ini akan otomatis dikirimkan ke Email pelanggan agar mereka bisa mengunggah bukti yang valid.
            </p>
            <div className="form-group">
              <label>Alasan Penolakan Bukti *</label>
              <textarea
                rows="4"
                placeholder="Contoh: Nominal transfer kurang, gambar bukti transfer buram/terpotong, atau bukti transfer bukan untuk transaksi ini."
                value={alasanTolak}
                onChange={function (e) { setAlasanTolak(e.target.value); }}
                required
                autoFocus
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default PembayaranPage;
