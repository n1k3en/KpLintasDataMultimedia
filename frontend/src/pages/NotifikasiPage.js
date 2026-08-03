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
    if (!buktiStr) return { tipe: 'Midtrans', status: 'Selesai' };
    var parts = buktiStr.split(' / ');
    var rawType = parts[1] || 'automatic';
    var rawStatus = parts[2] || 'settlement';

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
      'pending': 'Tertunda (Pending)',
      'deny': 'Ditolak (Denied)',
      'expire': 'Kadaluarsa (Expired)',
      'cancel': 'Dibatalkan (Cancelled)'
    };

    return {
      tipe: tipeMap[rawType] || rawType.replace(/_/g, ' ').toUpperCase(),
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
        setNotifs(function(prev) {
          return prev.map(function(n) {
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
        setNotifs(function(prev) {
          return prev.map(function(n) {
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
        <button className="btn btn-primary" onClick={handleMarkAllRead} disabled={notifs.filter(function(n) { return n.status_baca === 0; }).length === 0} style={{
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
                    <td>
                      <span 
                        onClick={function() { handleMarkRead(notif); }}
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
                              navigate('/dashboard/pembayaran');
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
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Status Midtrans</span>
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
