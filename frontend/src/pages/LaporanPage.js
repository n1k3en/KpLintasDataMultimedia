import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from '../components/Modal';
import TemplateIcon from '../components/TemplateIcon';
import { API_BASE_URL } from '../config';

function LaporanPage() {
  var today = new Date();
  var defaultPeriode = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');

  var [periode, setPeriode] = useState(defaultPeriode);
  var [summary, setSummary] = useState({ total_pemasukan: 0, total_pengeluaran: 0, laba_bersih: 0 });
  var [incomes, setIncomes] = useState([]);
  var [expenses, setExpenses] = useState([]);
  var [chartData, setChartData] = useState([]);
  var [chartLoading, setChartLoading] = useState(true);
  var [hoveredIdx, setHoveredIdx] = useState(null);
  var [expensePage, setExpensePage] = useState(1);
  var [incomePage, setIncomePage] = useState(1);
  var [loading, setLoading] = useState(true);

  // Modals state for CRUD Expenses
  var [showAddModal, setShowAddModal] = useState(false);
  var [showEditModal, setShowEditModal] = useState(false);
  var [editTarget, setEditTarget] = useState(null);

  // Form fields
  var [kategori, setKategori] = useState('');
  var [nominal, setNominal] = useState('');
  var [tipe, setTipe] = useState('tidak_fix');
  var [tanggal, setTanggal] = useState(today.toISOString().split('T')[0]);
  var [keterangan, setKeterangan] = useState('');

  var [actionLoading, setActionLoading] = useState(false);

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  useEffect(function () {
    fetchData();
    setExpensePage(1);
    setIncomePage(1);
  }, [periode]);

  useEffect(function () {
    var query = new URLSearchParams(window.location.search);
    if (query.get('action') === 'pengeluaran') {
      resetForm();
      setShowAddModal(true);
    }
  }, []);

  async function fetchData() {
    setLoading(true);
    setChartLoading(true);
    var selectedYear = periode.split('-')[0] || new Date().getFullYear();
    try {
      var summaryRes = await axios.get(`${API_BASE_URL}/api/reports/summary?periode=${periode}`, { headers: headers });
      var detailsRes = await axios.get(`${API_BASE_URL}/api/reports/details?periode=${periode}`, { headers: headers });
      var chartRes = await axios.get(`${API_BASE_URL}/api/reports/yearly-chart?year=${selectedYear}`, { headers: headers });

      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data);
      }
      if (detailsRes.data.success) {
        setIncomes(detailsRes.data.data.pemasukan_list);
        setExpenses(detailsRes.data.data.pengeluaran_list);
      }
      if (chartRes.data.success) {
        setChartData(chartRes.data.data.months);
      }
    } catch (err) {
      console.error('Gagal memuat data laporan keuangan:', err);
    } finally {
      setLoading(false);
      setChartLoading(false);
    }
  }

  async function handleAddExpense(e) {
    e.preventDefault();
    setActionLoading(true);
    try {
      var response = await axios.post(`${API_BASE_URL}/api/pengeluaran`, {
        kategori: kategori,
        nominal: Number(nominal),
        tipe: tipe,
        tanggal: tanggal,
        keterangan: keterangan
      }, { headers: headers });

      alert(response.data.message);
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      alert('Gagal mencatat pengeluaran: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEditExpense(e) {
    e.preventDefault();
    setActionLoading(true);
    try {
      var response = await axios.put(`${API_BASE_URL}/api/pengeluaran/${editTarget.id_pengeluaran}`, {
        kategori: kategori,
        nominal: Number(nominal),
        tipe: tipe,
        tanggal: tanggal,
        keterangan: keterangan
      }, { headers: headers });

      alert(response.data.message);
      setShowEditModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      alert('Gagal mengupdate pengeluaran: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteExpense(id) {
    if (!window.confirm('Apakah Anda yakin ingin MENGHAPUS pengeluaran ini?')) {
      return;
    }
    try {
      var response = await axios.delete(`${API_BASE_URL}/api/pengeluaran/${id}`, { headers: headers });
      alert(response.data.message);
      fetchData();
    } catch (err) {
      alert('Gagal menghapus pengeluaran: ' + (err.response?.data?.message || err.message));
    }
  }

  function handleOpenEdit(item) {
    setEditTarget(item);
    setKategori(item.kategori);
    setNominal(item.nominal);
    setTipe(item.tipe);
    setTanggal(item.tanggal.split('T')[0]);
    setKeterangan(item.keterangan || '');
    setShowEditModal(true);
  }

  function resetForm() {
    setKategori('');
    setNominal('');
    setTipe('tidak_fix');
    setTanggal(today.toISOString().split('T')[0]);
    setKeterangan('');
    setEditTarget(null);
  }

  async function handleExportExcel() {
    try {
      var response = await axios.get(`${API_BASE_URL}/api/reports/export-excel?periode=${periode}`, {
        headers: headers,
        responseType: 'blob'
      });

      var blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Laporan_Keuangan_ESP_${periode}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Gagal mendownload laporan: ' + err.message);
    }
  }

  function formatUang(value) {
    return 'Rp ' + Number(value).toLocaleString('id-ID');
  }

  var totalExpensesPages = Math.ceil(expenses.length / 10) || 1;
  var currentExpenses = expenses.slice((expensePage - 1) * 10, expensePage * 10);

  var totalIncomesPages = Math.ceil(incomes.length / 10) || 1;
  var currentIncomes = incomes.slice((incomePage - 1) * 10, incomePage * 10);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1>Laporan Keuangan</h1>
          <p>Monitor pemasukan lunas, catat pengeluaran operasional, dan unduh laporan Excel.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Period Picker */}
          <input
            type="month"
            value={periode}
            onChange={function (e) { setPeriode(e.target.value); }}
            style={{ width: '160px', padding: '10px', fontSize: '0.9rem', borderRadius: '5px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
          <button className="btn btn-primary" onClick={handleExportExcel} disabled={loading} style={{
            background: 'var(--md-primary-fixed)',
            color: 'var(--md-on-primary-fixed-variant)',
            fontWeight: '700'
          }}>
            <TemplateIcon name="document" size={16} style={{ marginRight: '6px' }} /> Export Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon hijau"><TemplateIcon name="chart-up" size={20} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Pemasukan</span>
            <h3>{loading ? '...' : formatUang(summary.total_pemasukan)}</h3>
            <span className="stat-desc" style={{ color: 'var(--success)' }}>Dari tagihan lunas</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon merah"><TemplateIcon name="chart-down" size={20} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Pengeluaran</span>
            <h3>{loading ? '...' : formatUang(summary.total_pengeluaran)}</h3>
            <span className="stat-desc" style={{ color: 'var(--danger)' }}>Operasional & Fix</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--primary-light)' }}><TemplateIcon name="money" size={20} /></div>
          <div className="stat-info">
            <span className="stat-label">Laba Bersih (Profit)</span>
            <h3 style={{ color: summary.laba_bersih >= 0 ? 'var(--primary-light)' : 'var(--danger)' }}>
              {loading ? '...' : formatUang(summary.laba_bersih)}
            </h3>
            <span className="stat-desc">Keuntungan bulan berjalan</span>
          </div>
        </div>
      </div>

      {/* Grafik Keuangan Bulanan */}
      <div className="chart-container-card animate-fadeIn" style={{ animationDelay: '0.05s' }}>
        <div className="chart-header">
          <div className="chart-title-wrap">
            <h3><TemplateIcon name="chart-up" size={18} style={{ color: 'var(--primary)' }} /> Tren Keuangan Bulanan - Tahun {periode.split('-')[0]}</h3>
            <p>Grafik perbandingan pemasukan lunas dan pengeluaran operasional.</p>
          </div>
          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-color pemasukan"></span>
              <span>Pemasukan</span>
            </div>
            <div className="legend-item">
              <span className="legend-color pengeluaran"></span>
              <span>Pengeluaran</span>
            </div>
          </div>
        </div>

        {chartLoading ? (
          <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <TemplateIcon name="loading" size={24} style={{ marginRight: '8px' }} /> Memuat data grafik...
          </div>
        ) : chartData.length === 0 ? (
          <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Tidak ada data grafik untuk tahun ini.
          </div>
        ) : (
          <div className="chart-svg-wrap" style={{ position: 'relative' }}>
            {/* Custom SVG Line Chart */}
            {(() => {
              var svgWidth = 800;
              var svgHeight = 280;
              var paddingLeft = 85;
              var paddingRight = 20;
              var paddingTop = 25;
              var paddingBottom = 35;
              var chartWidth = svgWidth - paddingLeft - paddingRight;
              var chartHeight = svgHeight - paddingTop - paddingBottom;

              var maxVal = 1000000;
              var maxIncom = Math.max(...chartData.map(d => d.pemasukan));
              var maxExp = Math.max(...chartData.map(d => d.pengeluaran));
              var actualMax = Math.max(maxIncom, maxExp, 1000000);
              var magnitude = Math.pow(10, Math.floor(Math.log10(actualMax)));
              if (magnitude === 0) magnitude = 1;
              var normalized = actualMax / magnitude;
              var rounded = Math.ceil(normalized * 2) / 2;
              maxVal = rounded * magnitude;

              var gridLines = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];
              var namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
              var selectedMonthIdx = parseInt(periode.split('-')[1], 10) - 1;

              // Generate path points
              var getPoints = (key) => chartData.map((d, i) => {
                var x = paddingLeft + (i / 11) * chartWidth;
                var y = paddingTop + chartHeight - (d[key] / maxVal) * chartHeight;
                return { x, y, val: d[key], index: i };
              });

              var pemasukanPoints = getPoints('pemasukan');
              var pengeluaranPoints = getPoints('pengeluaran');

              var pemasukanPath = pemasukanPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              var pengeluaranPath = pengeluaranPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

              var pemasukanAreaPath = pemasukanPoints.length ? `${pemasukanPath} L ${pemasukanPoints[11].x} ${paddingTop + chartHeight} L ${pemasukanPoints[0].x} ${paddingTop + chartHeight} Z` : '';
              var pengeluaranAreaPath = pengeluaranPoints.length ? `${pengeluaranPath} L ${pengeluaranPoints[11].x} ${paddingTop + chartHeight} L ${pengeluaranPoints[0].x} ${paddingTop + chartHeight} Z` : '';

              function formatKependekan(val) {
                if (val >= 1000000000) return 'Rp ' + (val / 1000000000).toFixed(1).replace('.0', '') + 'M';
                if (val >= 1000000) return 'Rp ' + (val / 1000000).toFixed(1).replace('.0', '') + 'Jt';
                if (val >= 1000) return 'Rp ' + (val / 1000).toFixed(0) + 'Rb';
                return 'Rp ' + val;
              }

              return (
                <>
                  <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height={svgHeight} style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="grad-pemasukan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.00" />
                      </linearGradient>
                      <linearGradient id="grad-pengeluaran" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--status-merah)" stopOpacity="0.16" />
                        <stop offset="100%" stopColor="var(--status-merah)" stopOpacity="0.00" />
                      </linearGradient>
                    </defs>

                    {/* Background Highlight for Selected Month */}
                    {selectedMonthIdx >= 0 && selectedMonthIdx <= 11 && (
                      <rect
                        x={paddingLeft + (selectedMonthIdx / 11) * chartWidth - (chartWidth / 22)}
                        y={paddingTop - 10}
                        width={chartWidth / 11}
                        height={chartHeight + 20}
                        fill="var(--primary-glow)"
                        rx="6"
                      />
                    )}

                    {/* Horizontal Grid Lines & Y Labels */}
                    {gridLines.map((v, idx) => {
                      var y = paddingTop + chartHeight - (v / maxVal) * chartHeight;
                      return (
                        <g key={idx}>
                          <line
                            x1={paddingLeft}
                            y1={y}
                            x2={svgWidth - paddingRight}
                            y2={y}
                            stroke="var(--border-color)"
                            strokeDasharray="4 4"
                            strokeWidth="0.8"
                          />
                          <text
                            x={paddingLeft - 12}
                            y={y + 4}
                            fill="var(--text-muted)"
                            fontSize="0.75rem"
                            textAnchor="end"
                            fontFamily="Inter, sans-serif"
                          >
                            {formatKependekan(v)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Vertical Grid Lines & X Labels */}
                    {namaBulan.map((name, i) => {
                      var x = paddingLeft + (i / 11) * chartWidth;
                      var isCurrent = selectedMonthIdx === i;
                      return (
                        <g key={i}>
                          <line
                            x1={x}
                            y1={paddingTop}
                            x2={x}
                            y2={paddingTop + chartHeight}
                            stroke="var(--border-color)"
                            strokeWidth="0.5"
                            opacity="0.3"
                          />
                          <text
                            x={x}
                            y={paddingTop + chartHeight + 18}
                            fill={isCurrent ? 'var(--primary)' : 'var(--text-muted)'}
                            fontSize="0.78rem"
                            fontWeight={isCurrent ? '700' : '500'}
                            textAnchor="middle"
                            fontFamily="Inter, sans-serif"
                          >
                            {name}
                          </text>
                        </g>
                      );
                    })}

                    {/* Area Fills */}
                    <path d={pemasukanAreaPath} fill="url(#grad-pemasukan)" />
                    <path d={pengeluaranAreaPath} fill="url(#grad-pengeluaran)" />

                    {/* Line Paths */}
                    <path
                      d={pemasukanPath}
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={pengeluaranPath}
                      fill="none"
                      stroke="var(--status-merah)"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Interactive Vertical Guide Line */}
                    {hoveredIdx !== null && (
                      <line
                        x1={paddingLeft + (hoveredIdx / 11) * chartWidth}
                        y1={paddingTop}
                        x2={paddingLeft + (hoveredIdx / 11) * chartWidth}
                        y2={paddingTop + chartHeight}
                        stroke="var(--primary-light)"
                        strokeWidth="1.2"
                        strokeDasharray="3 3"
                        opacity="0.8"
                      />
                    )}

                    {/* Hover Points */}
                    {hoveredIdx !== null && (
                      <>
                        <circle
                          cx={pemasukanPoints[hoveredIdx].x}
                          cy={pemasukanPoints[hoveredIdx].y}
                          r="5"
                          fill="var(--primary)"
                          stroke="white"
                          strokeWidth="2"
                        />
                        <circle
                          cx={pengeluaranPoints[hoveredIdx].x}
                          cy={pengeluaranPoints[hoveredIdx].y}
                          r="5"
                          fill="var(--status-merah)"
                          stroke="white"
                          strokeWidth="2"
                        />
                      </>
                    )}

                    {/* Invisible Rectangles for Hover Interactions */}
                    {chartData.map((d, i) => {
                      var x = paddingLeft + (i / 11) * chartWidth;
                      return (
                        <rect
                          key={i}
                          x={x - (chartWidth / 22)}
                          y={paddingTop}
                          width={chartWidth / 11}
                          height={chartHeight}
                          fill="transparent"
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHoveredIdx(i)}
                          onMouseLeave={() => setHoveredIdx(null)}
                        />
                      );
                    })}
                  </svg>

                  {/* Tooltip */}
                  {hoveredIdx !== null && chartData[hoveredIdx] && (
                    <div
                      className="chart-tooltip"
                      style={{
                        left: `calc(${((paddingLeft + (hoveredIdx / 11) * chartWidth) / svgWidth) * 100}% - 85px)`,
                        top: '15px',
                        position: 'absolute'
                      }}
                    >
                      <div className="tooltip-month">{namaBulan[hoveredIdx]} {periode.split('-')[0]}</div>
                      <div className="tooltip-row">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%' }} /> Pemasukan:
                        </span>
                        <span className="tooltip-val" style={{ color: 'var(--primary-light)' }}>
                          Rp {chartData[hoveredIdx].pemasukan.toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="tooltip-row">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: '8px', height: '8px', background: 'var(--status-merah)', borderRadius: '50%' }} /> Pengeluaran:
                        </span>
                        <span className="tooltip-val" style={{ color: 'var(--status-merah)' }}>
                          Rp {chartData[hoveredIdx].pengeluaran.toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="tooltip-row" style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: '8px', height: '8px', background: 'var(--status-hijau)', borderRadius: '50%' }} /> Laba:
                        </span>
                        <span className="tooltip-val" style={{ color: chartData[hoveredIdx].laba_bersih >= 0 ? 'var(--status-hijau)' : 'var(--status-merah)' }}>
                          Rp {chartData[hoveredIdx].laba_bersih.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Grid: Pemasukan & Pengeluaran */}
      <div className="reports-tables-grid" style={{ display: 'grid', gap: '24px', width: '100%', marginBottom: '24px' }}>

        {/* Section Pengeluaran (CRUD) */}
        <div className="table-container animate-fadeIn">
          <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3><TemplateIcon name="money" size={18} style={{ marginRight: '8px' }} /> Pengeluaran Operasional ({expenses.length})</h3>
            <button className="btn btn-primary btn-sm" onClick={function () { resetForm(); setShowAddModal(true); }}>
              <TemplateIcon name="plus" size={16} style={{ marginRight: '6px' }} /> Catat Pengeluaran
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '30px' }}><div className="skeleton skeleton-text" /></div>
          ) : expenses.length === 0 ? (
            <div className="table-empty">
              <div className="table-empty-icon"><TemplateIcon name="money" size={28} /></div>
              <p>Belum ada pengeluaran operasional yang dicatat pada bulan ini.</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table className="data-table" style={{ minWidth: '750px' }}>
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Kategori</th>
                      <th>Tipe</th>
                      <th>Nominal</th>
                      <th>Tanggal</th>
                      <th>Keterangan</th>
                      <th>Petugas</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentExpenses.map(function (item, idx) {
                      return (
                        <tr key={item.id_pengeluaran}>
                          <td style={{ color: 'var(--text-muted)' }}>{(expensePage - 1) * 10 + idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{item.kategori}</td>
                          <td>
                            <span className={`status-badge ${item.tipe === 'fix' ? 'hijau' : 'abu_abu'}`}>
                              {item.tipe === 'fix' ? 'Fix (Bulanan)' : 'Tidak Fix'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{formatUang(item.nominal)}</td>
                          <td>{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.keterangan || '-'}
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>{item.nama_admin || '-'}</td>
                          <td>
                            <div className="table-actions">
                              <button className="btn btn-secondary btn-sm" onClick={function () { handleOpenEdit(item); }}><TemplateIcon name="edit" size={14} style={{ marginRight: '6px' }} /> Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={function () { handleDeleteExpense(item.id_pengeluaran); }}><TemplateIcon name="trash" size={14} style={{ marginRight: '6px' }} /> Hapus</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls for expenses */}
              {totalExpensesPages > 1 && (
                <div className="table-pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '12px 16px', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Menampilkan {Math.min((expensePage - 1) * 10 + 1, expenses.length)} - {Math.min(expensePage * 10, expenses.length)} dari {expenses.length} data
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={expensePage === 1}
                      onClick={function () { setExpensePage(function (p) { return p - 1; }); }}
                      style={{ padding: '4px 8px' }}
                    >
                      Sebelumnya
                    </button>
                    {Array.from({ length: totalExpensesPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        className={'btn btn-sm ' + (expensePage === p ? 'btn-primary' : 'btn-secondary')}
                        onClick={function () { setExpensePage(p); }}
                        style={{ minWidth: '30px', padding: '4px 6px', fontWeight: 'bold' }}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={expensePage === totalExpensesPages}
                      onClick={function () { setExpensePage(function (p) { return p + 1; }); }}
                      style={{ padding: '4px 8px' }}
                    >
                      Selanjutnya
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Section Pemasukan */}
        <div className="table-container animate-fadeIn" style={{ animationDelay: '0.1s' }}>
          <div className="table-header">
            <h3><TemplateIcon name="chart-up" size={18} style={{ marginRight: '8px' }} /> Pemasukan Real-Time ({incomes.length})</h3>
          </div>

          {loading ? (
            <div style={{ padding: '30px' }}><div className="skeleton skeleton-text" /></div>
          ) : incomes.length === 0 ? (
            <div className="table-empty">
              <div className="table-empty-icon"><TemplateIcon name="chart-up" size={28} /></div>
              <p>Belum ada tagihan lunas yang tercatat pada bulan ini.</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table className="data-table" style={{ minWidth: '600px' }}>
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Nama Pelanggan</th>
                      <th>Nomor HP</th>
                      <th>Periode</th>
                      <th>Nominal Pemasukan</th>
                      <th>Tanggal Bayar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentIncomes.map(function (item, idx) {
                      return (
                        <tr key={item.id_tagihan}>
                          <td style={{ color: 'var(--text-muted)' }}>{(incomePage - 1) * 10 + idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{item.nama}</td>
                          <td>{item.no_hp}</td>
                          <td><code>{item.periode}</code></td>
                          <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatUang(item.nominal)}</td>
                          <td>{new Date(item.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls for incomes */}
              {totalIncomesPages > 1 && (
                <div className="table-pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '12px 16px', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Menampilkan {Math.min((incomePage - 1) * 10 + 1, incomes.length)} - {Math.min(incomePage * 10, incomes.length)} dari {incomes.length} data
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={incomePage === 1}
                      onClick={function () { setIncomePage(function (p) { return p - 1; }); }}
                      style={{ padding: '4px 8px' }}
                    >
                      Sebelumnya
                    </button>
                    {Array.from({ length: totalIncomesPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        className={'btn btn-sm ' + (incomePage === p ? 'btn-primary' : 'btn-secondary')}
                        onClick={function () { setIncomePage(p); }}
                        style={{ minWidth: '30px', padding: '4px 6px', fontWeight: 'bold' }}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={incomePage === totalIncomesPages}
                      onClick={function () { setIncomePage(function (p) { return p + 1; }); }}
                      style={{ padding: '4px 8px' }}
                    >
                      Selanjutnya
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* Modal Tambah Pengeluaran */}
      {showAddModal && (
        <Modal
          isOpen={showAddModal}
          onClose={function () { setShowAddModal(false); resetForm(); }}
          title={<><TemplateIcon name="plus" size={16} style={{ marginRight: '8px' }} /> Catat Pengeluaran Baru</>}
          footer={
            <>
              <button className="btn btn-secondary" onClick={function () { setShowAddModal(false); resetForm(); }} disabled={actionLoading}>Batal</button>
              <button className="btn btn-primary" onClick={handleAddExpense} disabled={actionLoading || !kategori || !nominal || !tanggal}>
                {actionLoading ? <><TemplateIcon name="loading" size={16} style={{ marginRight: '6px' }} /> Menyimpan...</> : <><TemplateIcon name="check" size={16} style={{ marginRight: '6px' }} /> Simpan Pengeluaran</>}
              </button>
            </>
          }
        >
          <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label>Kategori Pengeluaran *</label>
              <input
                type="text"
                placeholder="Contoh: Sewa Bandwidth, Listrik PLN, Bensin Operasional"
                value={kategori}
                onChange={function (e) { setKategori(e.target.value); }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Nominal (Rp) *</label>
                <input
                  type="number"
                  placeholder="0"
                  value={nominal}
                  onChange={function (e) { setNominal(e.target.value); }}
                  required
                />
              </div>
              <div className="form-group">
                <label>Tipe Pengeluaran *</label>
                <select value={tipe} onChange={function (e) { setTipe(e.target.value); }} required>
                  <option value="tidak_fix">Tambahan (Tidak Fix)</option>
                  <option value="fix">Berkala (Fix Bulanan)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Tanggal Pengeluaran *</label>
              <input
                type="date"
                value={tanggal}
                onChange={function (e) { setTanggal(e.target.value); }}
                required
              />
            </div>

            <div className="form-group">
              <label>Keterangan Tambahan</label>
              <textarea
                rows="3"
                placeholder="Tulis rincian pengeluaran di sini (opsional)..."
                value={keterangan}
                onChange={function (e) { setKeterangan(e.target.value); }}
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Edit Pengeluaran */}
      {showEditModal && (
        <Modal
          isOpen={showEditModal}
          onClose={function () { setShowEditModal(false); resetForm(); }}
          title={<><TemplateIcon name="edit" size={16} style={{ marginRight: '8px' }} /> Edit Data Pengeluaran</>}
          footer={
            <>
              <button className="btn btn-secondary" onClick={function () { setShowEditModal(false); resetForm(); }} disabled={actionLoading}>Batal</button>
              <button className="btn btn-primary" onClick={handleEditExpense} disabled={actionLoading || !kategori || !nominal || !tanggal}>
                {actionLoading ? <><TemplateIcon name="loading" size={16} style={{ marginRight: '6px' }} /> Menyimpan...</> : <><TemplateIcon name="check" size={16} style={{ marginRight: '6px' }} /> Simpan Perubahan</>}
              </button>
            </>
          }
        >
          <form onSubmit={handleEditExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label>Kategori Pengeluaran *</label>
              <input
                type="text"
                value={kategori}
                onChange={function (e) { setKategori(e.target.value); }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Nominal (Rp) *</label>
                <input
                  type="number"
                  value={nominal}
                  onChange={function (e) { setNominal(e.target.value); }}
                  required
                />
              </div>
              <div className="form-group">
                <label>Tipe Pengeluaran *</label>
                <select value={tipe} onChange={function (e) { setTipe(e.target.value); }} required>
                  <option value="tidak_fix">Tambahan (Tidak Fix)</option>
                  <option value="fix">Berkala (Fix Bulanan)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Tanggal Pengeluaran *</label>
              <input
                type="date"
                value={tanggal}
                onChange={function (e) { setTanggal(e.target.value); }}
                required
              />
            </div>

            <div className="form-group">
              <label>Keterangan Tambahan</label>
              <textarea
                rows="3"
                value={keterangan}
                onChange={function (e) { setKeterangan(e.target.value); }}
              />
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}

export default LaporanPage;
