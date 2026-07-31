import React, { useState, useEffect } from 'react';
import axios from 'axios';
import StatusBadge from '../components/StatusBadge';
import TemplateIcon from '../components/TemplateIcon';
import { API_BASE_URL } from '../config';
import { Link } from 'react-router-dom';

function TagihanPage({ socket }) {
  var [pelanggan, setPelanggan] = useState([]);
  var [loading, setLoading] = useState(true);
  var [searchQuery, setSearchQuery] = useState('');
  var [filterStatus, setFilterStatus] = useState('semua'); // 'semua', 'kuning', 'merah'

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  useEffect(function () {
    fetchPelanggan();

    if (socket) {
      socket.on('pelanggan_updated', function () {
        fetchPelanggan();
      });
      socket.on('pembayaran_masuk', function () {
        fetchPelanggan();
      });
    }

    return function () {
      if (socket) {
        socket.off('pelanggan_updated');
        socket.off('pembayaran_masuk');
      }
    };
  }, [socket]);

  async function fetchPelanggan() {
    try {
      var response = await axios.get(API_BASE_URL + '/api/pelanggan', { headers: headers });
      if (response.data.success) {
        setPelanggan(response.data.data);
      }
    } catch (err) {
      console.error('Gagal fetch pelanggan:', err);
    } finally {
      setLoading(false);
    }
  }

  function hitungStatusDinamis(dueDate, pppoeStatus) {
    if (pppoeStatus === 'inactive' || pppoeStatus === 'offline' || pppoeStatus === false) {
      return 'abu_abu';
    }
    if (!dueDate) return 'abu_abu';

    var hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0);
    var tanggalJT = new Date(dueDate);
    tanggalJT.setHours(0, 0, 0, 0);
    var selisihHari = Math.ceil((tanggalJT.getTime() - hariIni.getTime()) / (1000 * 60 * 60 * 24));

    if (selisihHari < 0) return 'merah';
    if (selisihHari <= 3) return 'kuning';
    return 'hijau';
  }

  function hitungSelisihHari(dueDate) {
    if (!dueDate) return null;
    var hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0);
    var tanggalJT = new Date(dueDate);
    tanggalJT.setHours(0, 0, 0, 0);
    return Math.ceil((tanggalJT.getTime() - hariIni.getTime()) / (1000 * 60 * 60 * 24));
  }

  function formatTanggal(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatTanggalShort(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Filter hanya pelanggan yang status kuning (hampir jatuh tempo) atau merah (sudah lewat)
  var tagihanList = pelanggan.filter(function (item) {
    var status = hitungStatusDinamis(item.due_date, item.pppoe_status);
    return status === 'kuning' || status === 'merah';
  }).sort(function (a, b) {
    // Urutkan dari yang paling dekat/melewati jatuh tempo
    var dayA = hitungSelisihHari(a.due_date);
    var dayB = hitungSelisihHari(b.due_date);
    if (dayA === null) return 1;
    if (dayB === null) return -1;
    return dayA - dayB;
  });

  // Apply filter status
  var filteredByStatus = tagihanList.filter(function (item) {
    if (filterStatus === 'semua') return true;
    var status = hitungStatusDinamis(item.due_date, item.pppoe_status);
    return status === filterStatus;
  });

  // Apply search
  var filteredList = filteredByStatus.filter(function (item) {
    if (!searchQuery) return true;
    var q = searchQuery.toLowerCase();
    return (
      (item.nama && item.nama.toLowerCase().includes(q)) ||
      (item.no_hp && item.no_hp.includes(q)) ||
      (item.email && item.email.toLowerCase().includes(q)) ||
      (item.pppoe_username && item.pppoe_username.toLowerCase().includes(q)) ||
      (item.paket && item.paket.toLowerCase().includes(q))
    );
  });

  var countKuning = tagihanList.filter(function (item) {
    return hitungStatusDinamis(item.due_date, item.pppoe_status) === 'kuning';
  }).length;

  var countMerah = tagihanList.filter(function (item) {
    return hitungStatusDinamis(item.due_date, item.pppoe_status) === 'merah';
  }).length;

  return (
    <div style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
      <style>{`
        .tagihan-hero {
          background: #004e5a;
          border-radius: var(--radius-xl);
          margin-left: 0;
          margin-right: 0;
          margin-top: 0;
          padding: 28px 32px;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 24px;
          box-shadow: 0 10px 25px -5px rgba(0, 78, 90, 0.25);
          position: relative;
          overflow: hidden;
        }
        .tagihan-hero h1 {
          font-size: 1.75rem;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 6px;
          letter-spacing: -0.02em;
        }
        .tagihan-hero p {
          color: rgba(255, 255, 255, 0.82);
          max-width: 600px;
          line-height: 1.5;
          font-size: 0.95rem;
        }
        .tagihan-shell {
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin-top: 0;
          position: relative;
          z-index: 10;
        }
        .tagihan-stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .tagihan-stat-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 20px 24px;
          box-shadow: var(--shadow-sm);
          display: flex;
          align-items: center;
          gap: 16px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          cursor: pointer;
        }
        .tagihan-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        .tagihan-stat-card.active {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px var(--primary-glow);
        }
        .tagihan-stat-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .tagihan-stat-value {
          font-size: 1.8rem;
          font-weight: 800;
          letter-spacing: -1px;
          line-height: 1;
        }
        .tagihan-stat-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .tagihan-table-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }
        .tagihan-table-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .tagihan-table-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1rem;
          font-weight: 800;
          color: var(--text-primary);
        }
        .tagihan-countdown {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 0.72rem;
          font-weight: 700;
          white-space: nowrap;
        }
        .tagihan-countdown.warning {
          background: rgba(245, 158, 11, 0.1);
          color: #d97706;
        }
        .tagihan-countdown.danger {
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
        }
        .tagihan-empty {
          text-align: center;
          padding: 60px 20px;
        }
        .tagihan-empty-icon {
          width: 72px;
          height: 72px;
          background: rgba(15, 157, 91, 0.1);
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
      `}</style>

      {/* Hero Banner */}
      <section className="tagihan-hero animate-fadeIn">
        <div>
          <h1>Tagihan Pelanggan</h1>
          <p>Monitor tagihan pelanggan yang hampir jatuh tempo atau sudah melewati batas pembayaran. Ambil tindakan segera untuk meminimalkan tunggakan.</p>
        </div>
        <Link to="/dashboard/pelanggan" className="btn btn-primary" style={{
          background: 'var(--md-primary-fixed)',
          color: 'var(--md-on-primary-fixed-variant)',
          fontWeight: '700'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>group</span>
          Lihat Semua Pelanggan
        </Link>
      </section>

      {/* Main Content */}
      <div className="tagihan-shell">
        {/* Stats Cards */}
        <div className="tagihan-stats-row">
          <div
            className={'tagihan-stat-card' + (filterStatus === 'semua' ? ' active' : '')}
            onClick={function () { setFilterStatus('semua'); }}
          >
            <div className="tagihan-stat-icon" style={{ background: 'var(--primary-glow)', color: 'var(--primary)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>receipt_long</span>
            </div>
            <div>
              <div className="tagihan-stat-value" style={{ color: 'var(--primary)' }}>{tagihanList.length}</div>
              <div className="tagihan-stat-label">Total Perlu Perhatian</div>
            </div>
          </div>

          <div
            className={'tagihan-stat-card' + (filterStatus === 'kuning' ? ' active' : '')}
            onClick={function () { setFilterStatus(filterStatus === 'kuning' ? 'semua' : 'kuning'); }}
          >
            <div className="tagihan-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>schedule</span>
            </div>
            <div>
              <div className="tagihan-stat-value" style={{ color: '#d97706' }}>{countKuning}</div>
              <div className="tagihan-stat-label">Hampir Jatuh Tempo</div>
            </div>
          </div>

          <div
            className={'tagihan-stat-card' + (filterStatus === 'merah' ? ' active' : '')}
            onClick={function () { setFilterStatus(filterStatus === 'merah' ? 'semua' : 'merah'); }}
          >
            <div className="tagihan-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>warning</span>
            </div>
            <div>
              <div className="tagihan-stat-value" style={{ color: '#dc2626' }}>{countMerah}</div>
              <div className="tagihan-stat-label">Sudah Lewat Jatuh Tempo</div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="tagihan-table-card animate-fadeIn">
          <div className="tagihan-table-header">
            <div className="tagihan-table-title">
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--primary)' }}>receipt_long</span>
              Daftar Tagihan ({filteredList.length})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="text"
                placeholder="Cari nama, HP, PPPoE..."
                value={searchQuery}
                onChange={function (e) { setSearchQuery(e.target.value); }}
                style={{
                  width: '260px',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border-color)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  fontFamily: "'Hanken Grotesk', sans-serif"
                }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '40px 24px' }}>
              {[1, 2, 3, 4].map(function (i) {
                return (
                  <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    <div className="skeleton" style={{ width: '25%', height: '16px' }}></div>
                    <div className="skeleton" style={{ width: '20%', height: '16px' }}></div>
                    <div className="skeleton" style={{ width: '20%', height: '16px' }}></div>
                    <div className="skeleton" style={{ width: '15%', height: '16px' }}></div>
                    <div className="skeleton" style={{ width: '10%', height: '16px' }}></div>
                  </div>
                );
              })}
            </div>
          ) : filteredList.length === 0 ? (
            <div className="tagihan-empty">
              <div className="tagihan-empty-icon">
                <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--status-hijau)' }}>check_circle</span>
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
                {tagihanList.length === 0 ? 'Semua Tagihan Aman!' : 'Tidak Ada yang Cocok'}
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
                {tagihanList.length === 0
                  ? 'Tidak ada pelanggan yang mendekati atau melewati batas jatuh tempo saat ini.'
                  : 'Tidak ditemukan pelanggan yang cocok dengan pencarian atau filter Anda.'
                }
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Pelanggan</th>
                  <th>Kontak</th>
                  <th>Paket</th>
                  <th>Harga/Bulan</th>
                  <th>Jatuh Tempo</th>
                  <th>Sisa Waktu</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map(function (item, idx) {
                  var status = hitungStatusDinamis(item.due_date, item.pppoe_status);
                  var selisih = hitungSelisihHari(item.due_date);
                  var countdownText = '';
                  var countdownClass = '';

                  if (selisih !== null) {
                    if (selisih < 0) {
                      countdownText = 'Terlambat ' + Math.abs(selisih) + ' hari';
                      countdownClass = 'danger';
                    } else if (selisih === 0) {
                      countdownText = 'Hari ini!';
                      countdownClass = 'danger';
                    } else {
                      countdownText = 'H-' + selisih + ' hari';
                      countdownClass = 'warning';
                    }
                  }

                  return (
                    <tr key={item.id_pelanggan}>
                      <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{item.nama}</div>
                        {item.pppoe_username && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>router</span>
                            <code style={{ background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>{item.pppoe_username}</code>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>
                          <TemplateIcon name="router" size={13} style={{ marginRight: '4px' }} /> {item.no_hp}
                        </div>
                        {item.email && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            <TemplateIcon name="mail" size={12} style={{ marginRight: '4px' }} /> {item.email}
                          </div>
                        )}
                      </td>
                      <td>{item.paket || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                      <td>{item.harga ? 'Rp ' + Number(item.harga).toLocaleString('id-ID') : <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                      <td style={{ fontWeight: 600 }}>{formatTanggalShort(item.due_date)}</td>
                      <td>
                        <span className={'tagihan-countdown ' + countdownClass}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                            {countdownClass === 'danger' ? 'error' : 'schedule'}
                          </span>
                          {countdownText}
                        </span>
                      </td>
                      <td><StatusBadge status={status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default TagihanPage;
