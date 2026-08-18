import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Modal from '../components/Modal';
import TemplateIcon from '../components/TemplateIcon';
import { API_BASE_URL } from '../config';

function NotifikasiPage({ socket }) {
  var [notifs, setNotifs] = useState([]);
  var [loading, setLoading] = useState(true);
  var [searchQuery, setSearchQuery] = useState('');
  var [filterStatus, setFilterStatus] = useState('all'); // 'all', 'unread', 'read', 'manual', 'midtrans'
  var [viewMidtransDetail, setViewMidtransDetail] = useState(null);
  var [viewNotif, setViewNotif] = useState(null); // for manual payment modal
  var [actionLoading, setActionLoading] = useState(false);
  var navigate = useNavigate();
  var location = useLocation();

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  async function fetchNotifications() {
    try {
      setLoading(true);
      var response = await axios.get(`${API_BASE_URL}/api/notifikasi`, { headers: headers });
      if (response.data.success) {
        setNotifs(response.data.data);
      }
    } catch (err) {
      console.error('Gagal mengambil notifikasi:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(function () {
    fetchNotifications();
  }, []);

  // Auto open modal if notifId param exists in URL query string
  useEffect(function () {
    var searchParams = new URLSearchParams(location.search);
    var notifIdParam = searchParams.get('notifId');
    if (notifIdParam && notifs.length > 0) {
      var found = notifs.find(function (n) {
        return String(n.id_notifikasi) === notifIdParam;
      });
      if (found) {
        setViewMidtransDetail(found);
        handleMarkRead(found);
      }
    }
  }, [location.search, notifs]);

  function parseMidtransBukti(buktiStr) {
    if (!buktiStr) return { gateway: 'Online', tipe: 'Online Gateway', bank: '-', status: 'Selesai' };
    var parts = buktiStr.split(' / ');
    var gateway = (parts[0] || 'Online').trim();
    var rawType = (parts[1] || 'automatic').trim();
    var rawStatus = (parts[2] || 'settlement').trim();

    var channelInfoMap = {
      // Duitku Virtual Account Codes
      'BC': { label: 'Virtual Account', bank: 'Bank BCA (Virtual Account)' },
      'M2': { label: 'Virtual Account', bank: 'Bank Mandiri (Virtual Account H2H)' },
      'BR': { label: 'Virtual Account', bank: 'Bank BRI (Virtual Account)' },
      'I1': { label: 'Virtual Account', bank: 'Bank BNI (Virtual Account)' },
      'BV': { label: 'Virtual Account', bank: 'Bank BSI (Bank Syariah Indonesia VA)' },
      'NC': { label: 'Virtual Account', bank: 'Bank Neo Commerce (BNC VA)' },
      'AG': { label: 'Virtual Account', bank: 'Bank Artha Graha (Virtual Account)' },
      'SP': { label: 'Virtual Account / E-Wallet', bank: 'Bank Sahabat Sampoerna / ShopeePay' },

      // Duitku QRIS & E-Wallets
      'LQ': { label: 'QRIS Real-Time', bank: 'QRIS (Semua Bank & E-Wallet)' },
      'OV': { label: 'E-Wallet', bank: 'OVO' },
      'DA': { label: 'E-Wallet', bank: 'DANA' },
      'LA': { label: 'E-Wallet', bank: 'LinkAja' },

      // Duitku Retail & Card
      'IR': { label: 'Minimarket', bank: 'Indomaret' },
      'FT': { label: 'Gerai Retail', bank: 'Retail / Alfamart / Pos Indonesia' },
      'VC': { label: 'Kartu Kredit / Debit', bank: 'Kartu Kredit / Debit Online' },

      // Midtrans Types
      'bank_transfer': { label: 'Virtual Account', bank: 'Virtual Account (Transfer Bank)' },
      'echannel': { label: 'Virtual Account', bank: 'Bank Mandiri (Bill Payment / VA)' },
      'bca': { label: 'Virtual Account', bank: 'Bank BCA (Virtual Account)' },
      'bni': { label: 'Virtual Account', bank: 'Bank BNI (Virtual Account)' },
      'bri': { label: 'Virtual Account', bank: 'Bank BRI (Virtual Account)' },
      'permata': { label: 'Virtual Account', bank: 'Bank Permata (Virtual Account)' },
      'cimb': { label: 'Virtual Account', bank: 'Bank CIMB Niaga (Virtual Account)' },
      'qris': { label: 'QRIS Real-Time', bank: 'QRIS (Gopay/OVO/Dana/LinkAja/Semua Bank)' },
      'gopay': { label: 'E-Wallet', bank: 'GoPay / GoPay Later' },
      'shopeepay': { label: 'E-Wallet', bank: 'ShopeePay / SPayLater' },
      'cstore': { label: 'Minimarket', bank: 'Minimarket (Indomaret / Alfamart)' },
      'credit_card': { label: 'Kartu Kredit', bank: 'Kartu Kredit (Visa / Mastercard / JCB)' }
    };

    var matched = channelInfoMap[rawType] || channelInfoMap[rawType.toLowerCase()] || {
      label: rawType.replace(/_/g, ' ').toUpperCase(),
      bank: rawType.replace(/_/g, ' ').toUpperCase()
    };

    var statusMap = {
      '00': 'Sukses (00)',
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
      tipe: gateway + ' (' + matched.label + ')',
      bank: matched.bank,
      status: statusMap[rawStatus] || rawStatus.toUpperCase()
    };
  }

  // Listen to WebSocket triggers for real-time update
  useEffect(function () {
    if (socket) {
      socket.on('pembayaran_masuk', function () {
        fetchNotifications();
      });
      return function () {
        socket.off('pembayaran_masuk');
      };
    }
  }, [socket]);

  async function handleMarkRead(notif) {
    if (notif.status_baca === 1) return;
    try {
      var response = await axios.put(`${API_BASE_URL}/api/notifikasi/${notif.id_notifikasi}/read`, {}, { headers: headers });
      if (response.data.success) {
        // Update local state directly for speed
        setNotifs(function (prev) {
          return prev.map(function (n) {
            if (n.id_notifikasi === notif.id_notifikasi) {
              return { ...n, status_baca: 1 };
            }
            return n;
          });
        });
      }
    } catch (err) {
      console.error('Gagal menandai dibaca:', err);
    }
  }

  async function handleMarkAllRead() {
    var unreadCount = notifs.filter(function (n) { return n.status_baca === 0; }).length;
    if (unreadCount === 0) return;
    try {
      var response = await axios.put(`${API_BASE_URL}/api/notifikasi/read-all`, {}, { headers: headers });
      if (response.data.success) {
        setNotifs(function (prev) {
          return prev.map(function (n) {
            return { ...n, status_baca: 1 };
          });
        });
      }
    } catch (err) {
      console.error('Gagal menandai semua dibaca:', err);
    }
  }

  // Filter & Search Logic
  var filteredNotifs = notifs.filter(function (n) {
    // Search filter
    var matchesSearch = true;
    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      matchesSearch = (n.nama_pelanggan && n.nama_pelanggan.toLowerCase().includes(q)) ||
        (n.periode && n.periode.toLowerCase().includes(q));
    }

    if (!matchesSearch) return false;

    // Status / Type filter
    var isOnline = n.bukti_file && (n.bukti_file.includes('Midtrans') || n.bukti_file.includes('Duitku'));
    if (filterStatus === 'unread') {
      return n.status_baca === 0;
    } else if (filterStatus === 'read') {
      return n.status_baca === 1;
    } else if (filterStatus === 'manual') {
      return !isOnline;
    } else if (filterStatus === 'midtrans') {
      return isOnline;
    }

    return true;
  });

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
          <h1>Notifikasi Pembayaran</h1>
          <p>Daftar seluruh notifikasi pembayaran masuk dari pelanggan via transfer manual maupun otomatis Midtrans.</p>
        </div>
        <button className="btn btn-primary" onClick={handleMarkAllRead} disabled={notifs.filter(function (n) { return n.status_baca === 0; }).length === 0} style={{
          background: 'var(--md-primary-fixed)',
          color: 'var(--md-on-primary-fixed-variant)',
          fontWeight: '700'
        }}>
          <TemplateIcon name="check" size={16} style={{ marginRight: '6px' }} /> Tandai Semua Dibaca
        </button>
      </div>

      {/* Tabs Filter */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '10px'
      }}>
        {[
          { id: 'all', label: 'Semua Notifikasi' },
          { id: 'unread', label: 'Belum Dibaca' },
          { id: 'read', label: 'Sudah Dibaca' },
          { id: 'manual', label: 'Transfer Manual' },
          { id: 'midtrans', label: 'Otomatis Online' }
        ].map(function (tab) {
          var isActive = filterStatus === tab.id;
          return (
            <button
              key={tab.id}
              onClick={function () { setFilterStatus(tab.id); }}
              style={{
                background: isActive ? 'var(--primary-glow)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="table-container animate-fadeIn">
        <div className="table-header">
          <h3>
            <TemplateIcon name="bell" size={18} style={{ marginRight: '8px' }} />
            Notifikasi Masuk ({filteredNotifs.length})
          </h3>
          <div className="table-header-actions">
            <input
              type="text"
              placeholder="Cari pelanggan atau periode..."
              value={searchQuery}
              onChange={function (e) { setSearchQuery(e.target.value); }}
              style={{ width: '280px' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px' }}>
            {[1, 2, 3].map(function (i) {
              return (
                <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div className="skeleton" style={{ width: '10%', height: '16px' }}></div>
                  <div className="skeleton" style={{ width: '30%', height: '16px' }}></div>
                  <div className="skeleton" style={{ width: '25%', height: '16px' }}></div>
                  <div className="skeleton" style={{ width: '20%', height: '16px' }}></div>
                  <div className="skeleton" style={{ width: '15%', height: '16px' }}></div>
                </div>
              );
            })}
          </div>
        ) : filteredNotifs.length === 0 ? (
          <div className="table-empty">
            <div className="table-empty-icon"><TemplateIcon name="bell" size={28} /></div>
            <p>Tidak ada notifikasi pembayaran.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>No</th>
                <th>Metode</th>
                <th>Nama Pelanggan</th>
                <th>Periode</th>
                <th>Nominal</th>
                <th>Waktu Masuk</th>
                {filterStatus !== 'midtrans' && <th>Detail</th>}
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotifs.map(function (notif, idx) {
                var isUnread = notif.status_baca === 0;
                var isMidtrans = notif.bukti_file && notif.bukti_file.includes('Midtrans');
                return (
                  <tr
                    key={notif.id_notifikasi}
                    style={{
                      background: isUnread ? 'rgba(0, 104, 118, 0.02)' : 'transparent',
                      fontWeight: isUnread ? '600' : 'normal'
                    }}
                  >
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td>
                      <span className={'status-badge ' + (isMidtrans ? 'hijau' : 'kuning')}>
                        {isMidtrans ? 'Midtrans' : 'Manual Transfer'}
                      </span>
                    </td>
                    <td>{notif.nama_pelanggan || 'Pelanggan Dihapus'}</td>
                    <td>{notif.periode}</td>
                    <td>Rp {Number(notif.nominal).toLocaleString('id-ID')}</td>
                    <td>{formatTanggal(notif.tanggal)}</td>
                    {filterStatus !== 'midtrans' && (
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={function () { handleMarkRead(notif); setViewNotif(notif); }}
                        >
                          <TemplateIcon name="camera" size={14} style={{ marginRight: '6px' }} /> Lihat Bukti
                        </button>
                      </td>
                    )}
                    <td>
                      <span
                        onClick={function () { handleMarkRead(notif); }}
                        style={{
                          cursor: isUnread ? 'pointer' : 'default',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        className={'status-badge ' + (isUnread ? 'merah' : 'abu')}
                      >
                        {isUnread ? 'Belum Dibaca' : 'Sudah Dibaca'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {isUnread && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={function () { handleMarkRead(notif); }}
                          >
                            Tandai Dibaca
                          </button>
                        )}
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={function () {
                            handleMarkRead(notif);
                            if (isMidtrans) {
                              setViewMidtransDetail(notif);
                            } else {
                              // open manual payment modal for verify
                              setViewNotif(notif);
                            }
                          }}
                        >
                          Lihat Detail
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal for manual payment proof and verification */}
      {viewNotif && (
        <Modal
          isOpen={viewNotif !== null}
          onClose={function () { setViewNotif(null); }}
          title={<><TemplateIcon name="camera" size={16} style={{ marginRight: '8px' }} /> Bukti Transfer - {viewNotif.nama_pelanggan || 'Pelanggan'}</>}
          footer={(
            <>
              <button className="btn btn-secondary" onClick={function () { setViewNotif(null); }}>Batal</button>
              <button
                className="btn btn-danger"
                onClick={async function () {
                  var alasan = window.prompt('Alasan penolakan (wajib):');
                  if (!alasan) return alert('Alasan penolakan diperlukan.');
                  setActionLoading(true);
                  try {
                    var resp = await axios.post(`${API_BASE_URL}/api/pembayaran/${viewNotif.id_pembayaran}/reject`, { alasan_tolak: alasan }, { headers: headers });
                    alert(resp.data.message || 'Pembayaran ditolak.');
                    setViewNotif(null);
                    fetchNotifications();
                  } catch (err) {
                    alert('Gagal menolak pembayaran: ' + (err.response?.data?.message || err.message));
                  } finally { setActionLoading(false); }
                }}
                disabled={actionLoading}
              >
                Tolak
              </button>
              <button
                className="btn btn-primary"
                onClick={async function () {
                  if (!window.confirm('Setujui pembayaran ini?')) return;
                  setActionLoading(true);
                  try {
                    var r = await axios.post(`${API_BASE_URL}/api/pembayaran/${viewNotif.id_pembayaran}/approve`, {}, { headers: headers });
                    alert(r.data.message || 'Pembayaran disetujui.');
                    setViewNotif(null);
                    fetchNotifications();
                  } catch (err) {
                    alert('Gagal menyetujui pembayaran: ' + (err.response?.data?.message || err.message));
                  } finally { setActionLoading(false); }
                }}
                disabled={actionLoading}
              >
                Terima Pembayaran
              </button>
            </>
          )}
        >
          <div style={{ textAlign: 'center', padding: '10px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '8px' }}>
              Tagihan: <strong>Rp {Number(viewNotif.nominal).toLocaleString('id-ID')}</strong> | Periode: <strong>{viewNotif.periode}</strong>
            </p>
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              <img src={`${API_BASE_URL}${viewNotif.bukti_file}`} alt="Bukti Transfer Pelanggan" style={{ maxWidth: '100%', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal for viewing Midtrans Transaction Details */}
      {viewMidtransDetail && (
        <Modal
          isOpen={viewMidtransDetail !== null}
          onClose={function () { setViewMidtransDetail(null); }}
          title={<><TemplateIcon name="document" size={16} style={{ marginRight: '8px' }} /> Detail Transaksi Midtrans</>}
          footer={
            <button className="btn btn-primary btn-sm" onClick={function () { setViewMidtransDetail(null); }}>Tutup</button>
          }
        >
          <div style={{ padding: '10px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Nama Pelanggan</span>
                <span style={{ fontWeight: '700', fontSize: '0.88rem' }}>{viewMidtransDetail.nama_pelanggan}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Periode Tagihan</span>
                <span style={{ fontWeight: '700', fontSize: '0.88rem' }}>{viewMidtransDetail.periode}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Nominal</span>
                <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '0.88rem' }}>
                  Rp {Number(viewMidtransDetail.nominal).toLocaleString('id-ID')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Metode Pembayaran</span>
                <span style={{ fontWeight: '600', fontSize: '0.88rem' }}>
                  {parseMidtransBukti(viewMidtransDetail.bukti_file).tipe}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Bank / Saluran Pembayaran</span>
                <span style={{ fontWeight: '700', color: 'var(--md-primary, #006876)', fontSize: '0.88rem' }}>
                  {parseMidtransBukti(viewMidtransDetail.bukti_file).bank}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Status Transaksi</span>
                <span className="status-badge hijau" style={{ fontSize: '0.78rem' }}>
                  {parseMidtransBukti(viewMidtransDetail.bukti_file).status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Waktu Transaksi</span>
                <span style={{ fontSize: '0.88rem' }}>{formatTanggal(viewMidtransDetail.tanggal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>ID Pembayaran</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', fontFamily: 'monospace' }}>#{viewMidtransDetail.id_pembayaran}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default NotifikasiPage;
