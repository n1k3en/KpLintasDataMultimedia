import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import TemplateIcon from '../components/TemplateIcon';

function ProfilPage() {
  var [admin, setAdmin] = useState(null);
  var [loading, setLoading] = useState(true);
  var [editNama, setEditNama] = useState('');
  var [isEditingNama, setIsEditingNama] = useState(false);
  var [savingNama, setSavingNama] = useState(false);
  var [successMsg, setSuccessMsg] = useState('');
  var [errorMsg, setErrorMsg] = useState('');

  // Password change state
  var [showPasswordForm, setShowPasswordForm] = useState(false);
  var [currentPassword, setCurrentPassword] = useState('');
  var [newPassword, setNewPassword] = useState('');
  var [confirmPassword, setConfirmPassword] = useState('');
  var [savingPassword, setSavingPassword] = useState(false);
  var [showCurrentPw, setShowCurrentPw] = useState(false);
  var [showNewPw, setShowNewPw] = useState(false);
  var [showConfirmPw, setShowConfirmPw] = useState(false);

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  useEffect(function () {
    fetchProfile();
  }, []);

  function fetchProfile() {
    setLoading(true);
    axios.get(API_BASE_URL + '/api/auth/me', { headers: headers })
      .then(function (res) {
        if (res.data.success) {
          setAdmin(res.data.data);
          setEditNama(res.data.data.nama || '');
        }
        setLoading(false);
      })
      .catch(function () {
        setLoading(false);
      });
  }

  function showSuccess(msg) {
    setSuccessMsg(msg);
    setErrorMsg('');
    setTimeout(function () { setSuccessMsg(''); }, 4000);
  }

  function showError(msg) {
    setErrorMsg(msg);
    setSuccessMsg('');
    setTimeout(function () { setErrorMsg(''); }, 5000);
  }

  function handleSaveNama() {
    if (!editNama.trim()) { showError('Nama tidak boleh kosong.'); return; }
    setSavingNama(true);
    axios.put(API_BASE_URL + '/api/auth/profile', { nama: editNama.trim() }, { headers: headers })
      .then(function (res) {
        setSavingNama(false);
        if (res.data.success) {
          setAdmin(res.data.data);
          setIsEditingNama(false);
          // Update localStorage
          var savedAdmin = localStorage.getItem('admin');
          if (savedAdmin) {
            var parsed = JSON.parse(savedAdmin);
            parsed.nama = res.data.data.nama;
            localStorage.setItem('admin', JSON.stringify(parsed));
          }
          showSuccess('Nama berhasil diperbarui!');
        }
      })
      .catch(function (err) {
        setSavingNama(false);
        var msg = (err.response && err.response.data && err.response.data.message) || 'Gagal memperbarui nama.';
        showError(msg);
      });
  }

  function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showError('Semua field password harus diisi.');
      return;
    }
    if (newPassword.length < 6) { showError('Password baru minimal 6 karakter.'); return; }
    if (newPassword !== confirmPassword) { showError('Konfirmasi password tidak cocok.'); return; }

    setSavingPassword(true);
    axios.put(API_BASE_URL + '/api/auth/password', {
      currentPassword: currentPassword,
      newPassword: newPassword
    }, { headers: headers })
      .then(function (res) {
        setSavingPassword(false);
        if (res.data.success) {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setShowPasswordForm(false);
          showSuccess('Password berhasil diubah!');
        }
      })
      .catch(function (err) {
        setSavingPassword(false);
        var msg = (err.response && err.response.data && err.response.data.message) || 'Gagal mengubah password.';
        showError(msg);
      });
  }

  function getInitials(nama) {
    if (!nama) return 'A';
    return nama.split(' ').map(function (n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    var months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  if (loading) {
    return (
      <div style={{ fontFamily: "'Hanken Grotesk', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <TemplateIcon name="loading" size={24} style={{ marginRight: '10px' }} /> Memuat profil...
      </div>
    );
  }

  var cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '28px',
    boxShadow: 'var(--shadow-sm)'
  };

  var inputStyle = {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid var(--border-color)',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontFamily: "'Hanken Grotesk', sans-serif",
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    transition: 'border-color 0.2s ease',
    outline: 'none',
    boxSizing: 'border-box'
  };

  return (
    <div style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
      <div className="page-header">
        <div>
          <h1>Profil Saya</h1>
          <p>Kelola informasi akun dan keamanan password administrator.</p>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="status-badge hijau animate-fadeIn" style={{
          width: '100%', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', boxShadow: 'var(--shadow-sm)'
        }}>
          <TemplateIcon name="check" size={16} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="status-badge merah animate-fadeIn" style={{
          width: '100%', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', boxShadow: 'var(--shadow-sm)'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>error</span> {errorMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start' }}>

        {/* Left Card: Avatar & Quick Info */}
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '90px', height: '90px', borderRadius: '50%', margin: '0 auto 16px',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: '2rem', fontWeight: '800',
              boxShadow: '0 6px 20px rgba(0,150,136,0.25)'
            }}>
              {getInitials(admin ? admin.nama : '')}
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '4px', color: 'var(--text-primary)' }}>
              {admin ? admin.nama : '-'}
            </h3>
            <span className="status-badge hijau" style={{ fontSize: '0.75rem', padding: '3px 12px' }}>
              {admin && admin.role === 'superadmin' ? 'Superadmin' : 'Administrator'}
            </span>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { icon: 'mail', label: 'Email', value: admin ? admin.email : '-' },
              { icon: 'shield_person', label: 'Role', value: admin && admin.role === 'superadmin' ? 'Superadmin' : 'Administrator' },
              { icon: 'calendar_today', label: 'Bergabung', value: formatDate(admin ? admin.created_at : null) }
            ].map(function (item, idx) {
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    background: 'var(--primary-glow)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>{item.icon}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600' }}>{item.label}</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>{item.value}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Edit Forms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Edit Nama Card */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>Informasi Profil</h3>
              {!isEditingNama && (
                <button type="button" className="btn btn-secondary btn-sm"
                  onClick={function () { setIsEditingNama(true); setEditNama(admin ? admin.nama : ''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>edit</span> Edit
                </button>
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '20px' }}>
              Perbarui nama tampilan akun administrator Anda.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Nama Lengkap
                </label>
                {isEditingNama ? (
                  <input type="text" value={editNama} onChange={function (e) { setEditNama(e.target.value); }}
                    style={inputStyle} placeholder="Masukkan nama lengkap" autoFocus
                  />
                ) : (
                  <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', border: '1.5px solid transparent' }}>
                    {admin ? admin.nama : '-'}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Email
                </label>
                <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)', border: '1.5px solid transparent', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {admin ? admin.email : '-'}
                  <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>lock</span>
                </div>
              </div>
            </div>

            {isEditingNama && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary btn-sm"
                  onClick={function () { setIsEditingNama(false); setEditNama(admin ? admin.nama : ''); }}
                  disabled={savingNama}
                >Batal</button>
                <button type="button" className="btn btn-primary btn-sm"
                  onClick={handleSaveNama} disabled={savingNama}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '120px', justifyContent: 'center' }}
                >
                  {savingNama ? (<><TemplateIcon name="loading" size={14} /> Menyimpan...</>) : 'Simpan Perubahan'}
                </button>
              </div>
            )}
          </div>

          {/* Password Card */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>Keamanan Password</h3>
              {!showPasswordForm && (
                <button type="button" className="btn btn-secondary btn-sm"
                  onClick={function () { setShowPasswordForm(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>key</span> Ubah Password
                </button>
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '20px' }}>
              Pastikan akun Anda menggunakan password yang kuat untuk keamanan optimal.
            </p>

            {!showPasswordForm ? (
              <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px'
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: 'var(--primary-glow)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>verified_user</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '700' }}>Password Terproteksi</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Password akun Anda dienkripsi dengan bcrypt hashing.
                  </div>
                </div>
              </div>
            ) : (
              <div className="animate-fadeIn">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Current Password */}
                  <div className="form-group">
                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Password Lama *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input type={showCurrentPw ? 'text' : 'password'} value={currentPassword}
                        onChange={function (e) { setCurrentPassword(e.target.value); }}
                        style={{ ...inputStyle, paddingRight: '42px' }} placeholder="Masukkan password lama"
                      />
                      <span className="material-symbols-outlined"
                        onClick={function () { setShowCurrentPw(!showCurrentPw); }}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.15rem', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >{showCurrentPw ? 'visibility_off' : 'visibility'}</span>
                    </div>
                  </div>
                  {/* New Password */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Password Baru *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input type={showNewPw ? 'text' : 'password'} value={newPassword}
                          onChange={function (e) { setNewPassword(e.target.value); }}
                          style={{ ...inputStyle, paddingRight: '42px' }} placeholder="Min. 6 karakter"
                        />
                        <span className="material-symbols-outlined"
                          onClick={function () { setShowNewPw(!showNewPw); }}
                          style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.15rem', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >{showNewPw ? 'visibility_off' : 'visibility'}</span>
                      </div>
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Konfirmasi Password Baru *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input type={showConfirmPw ? 'text' : 'password'} value={confirmPassword}
                          onChange={function (e) { setConfirmPassword(e.target.value); }}
                          style={{ ...inputStyle, paddingRight: '42px' }} placeholder="Ulangi password baru"
                        />
                        <span className="material-symbols-outlined"
                          onClick={function () { setShowConfirmPw(!showConfirmPw); }}
                          style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.15rem', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >{showConfirmPw ? 'visibility_off' : 'visibility'}</span>
                      </div>
                    </div>
                  </div>
                  {/* Password strength hint */}
                  {newPassword && (
                    <div style={{ fontSize: '0.76rem', color: newPassword.length >= 6 ? 'var(--status-hijau)' : 'var(--status-merah)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>
                        {newPassword.length >= 6 ? 'check_circle' : 'info'}
                      </span>
                      {newPassword.length >= 6 ? 'Panjang password memenuhi syarat' : 'Password minimal 6 karakter (' + newPassword.length + '/6)'}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary btn-sm"
                    onClick={function () { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                    disabled={savingPassword}
                  >Batal</button>
                  <button type="button" className="btn btn-primary btn-sm"
                    onClick={handleChangePassword} disabled={savingPassword}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '140px', justifyContent: 'center' }}
                  >
                    {savingPassword ? (<><TemplateIcon name="loading" size={14} /> Mengubah...</>) : 'Ubah Password'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Session Info Card */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '6px' }}>Informasi Sesi</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '20px' }}>
              Detail sesi login aktif saat ini.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {[
                { icon: 'token', label: 'Autentikasi', value: 'JWT Bearer Token', color: 'var(--primary)' },
                { icon: 'schedule', label: 'Masa Berlaku', value: '24 Jam', color: 'var(--status-kuning)' },
                { icon: 'lock', label: 'Enkripsi', value: 'Bcrypt Hash', color: 'var(--status-hijau)' }
              ].map(function (item, idx) {
                return (
                  <div key={idx} style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px'
                  }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px',
                      background: 'var(--primary-glow)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: item.color }}>{item.icon}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600' }}>{item.label}</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>{item.value}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilPage;
