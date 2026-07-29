import React, { useState, useEffect, useRef } from 'react';

function CustomerMap({ customers = [], pppoeSummary = {}, loading }) {
  var mapContainerRef = useRef(null);
  var mapInstanceRef = useRef(null);
  var markersRef = useRef([]);

  var [searchQuery, setSearchQuery] = useState('');
  var [filterStatus, setFilterStatus] = useState('all'); // all, online, warning, offline
  var [leafletLoaded, setLeafletLoaded] = useState(false);

  // Load Leaflet CSS & JS dynamically if not already loaded
  useEffect(function () {
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      var link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    if (!document.getElementById('leaflet-js')) {
      var script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = function () {
        setLeafletLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      var checkL = setInterval(function () {
        if (window.L) {
          setLeafletLoaded(true);
          clearInterval(checkL);
        }
      }, 200);
    }
  }, []);

  // Compute deterministic latitude & longitude around Surabaya / Saronggi for customers
  var getCoordinates = function (cust) {
    if (cust.latitude && cust.longitude) {
      return [parseFloat(cust.latitude), parseFloat(cust.longitude)];
    }

    var alamatLower = (cust.alamat || '').toLowerCase();
    if (alamatLower.includes('saronggi') || alamatLower.includes('sumenep')) {
      return [-7.0422, 113.8821];
    }

    // Base center: Surabaya, Jawa Timur (-7.2575, 112.7521)
    var baseLat = -7.2575;
    var baseLng = 112.7521;

    var seed = (cust.id_pelanggan || 1) * 37 + (cust.nama || '').length * 13;
    var latOffset = (((seed * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.045;
    var lngOffset = ((((seed + 17) * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.055;

    return [baseLat + latOffset, baseLng + lngOffset];
  };

  // Initialize Map
  useEffect(function () {
    if (!leafletLoaded || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      var L = window.L;
      var map = L.map(mapContainerRef.current, {
        center: [-7.2575, 112.7521],
        zoom: 11,
        zoomControl: true
      });

      // Add CartoDB Positron / OSM tiles for a modern slate map look
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    return function () {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [leafletLoaded]);

  // Update Markers when customers, searchQuery, or filterStatus changes
  useEffect(function () {
    if (!leafletLoaded || !mapInstanceRef.current) return;
    var L = window.L;
    var map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach(function (m) {
      map.removeLayer(m);
    });
    markersRef.current = [];

    // Filter customers
    var filtered = customers.filter(function (cust) {
      var isOnline = cust.pppoe_status === 'active';
      var isWarning = cust.status_tagihan === 'merah' || cust.status_tagihan === 'kuning';
      var isOffline = !isOnline;

      if (filterStatus === 'online' && !isOnline) return false;
      if (filterStatus === 'warning' && !isWarning) return false;
      if (filterStatus === 'offline' && !isOffline) return false;

      if (searchQuery.trim()) {
        var q = searchQuery.toLowerCase();
        var matchNama = (cust.nama || '').toLowerCase().includes(q);
        var matchPppoe = (cust.pppoe_username || '').toLowerCase().includes(q);
        var matchAlamat = (cust.alamat || '').toLowerCase().includes(q);
        var matchPaket = (cust.paket || '').toLowerCase().includes(q);
        if (!matchNama && !matchPppoe && !matchAlamat && !matchPaket) return false;
      }

      return true;
    });

    // Add markers for filtered customers
    filtered.forEach(function (cust) {
      var coords = getCoordinates(cust);
      var isOnline = cust.pppoe_status === 'active';
      var isOverdue = cust.status_tagihan === 'merah';

      var pinColor = isOverdue ? '#ef4444' : isOnline ? '#10b981' : '#64748b';
      var pulseClass = isOverdue ? 'pulse-red' : isOnline ? 'pulse-green' : '';

      var customIcon = L.divIcon({
        className: 'custom-wifi-marker',
        html: `
          <div style="
            position: relative;
            width: 38px;
            height: 38px;
            background: #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
            border: 2.5px solid ${pinColor};
            cursor: pointer;
            transition: transform 0.2s ease;
          ">
            <span class="material-symbols-outlined" style="font-size: 20px; color: ${pinColor};">
              ${isOnline ? 'wifi' : 'wifi_off'}
            </span>
            ${pulseClass ? `<span style="
              position: absolute;
              top: -2px;
              right: -2px;
              width: 10px;
              height: 10px;
              background-color: ${pinColor};
              border-radius: 50%;
              box-shadow: 0 0 8px ${pinColor};
            "></span>` : ''}
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        popupAnchor: [0, -20]
      });

      var marker = L.marker(coords, { icon: customIcon }).addTo(map);

      // Custom Popup HTML
      var popupContent = `
        <div style="font-family: 'Hanken Grotesk', -apple-system, sans-serif; width: 220px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="font-size: 0.95rem; color: #0f172a;">${cust.nama}</strong>
            <span style="
              font-size: 0.65rem;
              font-weight: 700;
              padding: 2px 6px;
              border-radius: 12px;
              background: ${isOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)'};
              color: ${isOnline ? '#10b981' : '#64748b'};
            ">
              ${isOnline ? '● Online' : '● Offline'}
            </span>
          </div>
          <div style="font-size: 0.76rem; color: #475569; margin-bottom: 4px;">
            🔑 <strong>PPPoE:</strong> ${cust.pppoe_username}
          </div>
          <div style="font-size: 0.76rem; color: #475569; margin-bottom: 4px;">
            📦 <strong>Paket:</strong> ${cust.paket || 'Standard'}
          </div>
          <div style="font-size: 0.76rem; color: #64748b; margin-bottom: 8px;">
            📍 <strong>Alamat:</strong> ${cust.alamat || 'Pringsewu'}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; pt-2; border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 6px;">
            <span style="font-size: 0.7rem; font-weight: 700; color: ${isOverdue ? '#ef4444' : '#10b981'};">
              ${isOverdue ? '⚠️ Tagihan Jatuh Tempo' : '✓ Tagihan Lunas'}
            </span>
            <a href="/dashboard/pelanggan" style="
              font-size: 0.72rem;
              color: #006876;
              font-weight: 700;
              text-decoration: none;
            ">
              Detail &rarr;
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      markersRef.current.push(marker);
    });

    // Fit bounds if markers exist
    if (markersRef.current.length > 0 && mapInstanceRef.current) {
      var group = L.featureGroup(markersRef.current);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.15));
    }
  }, [leafletLoaded, customers, searchQuery, filterStatus]);

  // Counts
  var totalCount = customers.length;
  var onlineCount = customers.filter(c => c.pppoe_status === 'active').length;
  var warningCount = customers.filter(c => c.status_tagihan === 'merah' || c.status_tagihan === 'kuning').length;
  var offlineCount = totalCount - onlineCount;

  return (
    <div className="card glass-card animate-fadeIn" style={{
      animationDelay: '0.1s',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '24px',
      minHeight: '440px'
    }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--primary-glow)',
              color: 'var(--primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>map</span>
            </span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', fontFamily: "'Hanken Grotesk', sans-serif" }}>
              Peta Lokasi Pelanggan WiFi
            </h3>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', fontFamily: "'Hanken Grotesk', sans-serif" }}>
            Pelacakan geografis lokasi pemasangan WiFi & status PPPoE terdaftar secara real-time.
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterStatus('all')}
            className="btn btn-sm"
            style={{
              background: filterStatus === 'all' ? 'var(--primary)' : 'var(--bg-tertiary)',
              color: filterStatus === 'all' ? '#ffffff' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              fontSize: '0.78rem',
              fontWeight: '700'
            }}
          >
            Semua ({totalCount})
          </button>
          <button
            onClick={() => setFilterStatus('online')}
            className="btn btn-sm"
            style={{
              background: filterStatus === 'online' ? 'var(--status-hijau)' : 'var(--bg-tertiary)',
              color: filterStatus === 'online' ? '#ffffff' : 'var(--status-hijau)',
              border: '1px solid var(--border-color)',
              fontSize: '0.78rem',
              fontWeight: '700'
            }}
          >
            ● Aktif ({onlineCount})
          </button>
          <button
            onClick={() => setFilterStatus('warning')}
            className="btn btn-sm"
            style={{
              background: filterStatus === 'warning' ? 'var(--status-merah)' : 'var(--bg-tertiary)',
              color: filterStatus === 'warning' ? '#ffffff' : 'var(--status-merah)',
              border: '1px solid var(--border-color)',
              fontSize: '0.78rem',
              fontWeight: '700'
            }}
          >
            ⚠️ Jatuh Tempo ({warningCount})
          </button>
          <button
            onClick={() => setFilterStatus('offline')}
            className="btn btn-sm"
            style={{
              background: filterStatus === 'offline' ? 'var(--status-abu)' : 'var(--bg-tertiary)',
              color: filterStatus === 'offline' ? '#ffffff' : 'var(--text-muted)',
              border: '1px solid var(--border-color)',
              fontSize: '0.78rem',
              fontWeight: '700'
            }}
          >
            Offline ({offlineCount})
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div style={{ position: 'relative' }}>
        <span className="material-symbols-outlined" style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
          fontSize: '1.1rem',
          pointerEvents: 'none'
        }}>
          search
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari pelanggan di peta (nama, PPPoE username, atau alamat)..."
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '8px 14px 8px 36px',
            fontSize: '0.82rem',
            color: 'var(--text-primary)',
            outline: 'none',
            width: '100%',
            transition: 'all 0.2s ease'
          }}
        />
      </div>

      {/* Map Canvas */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '360px',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {loading ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-muted)',
            fontSize: '0.88rem'
          }}>
            Memuat peta pelanggan...
          </div>
        ) : (
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />
        )}
      </div>
    </div>
  );
}

export default CustomerMap;
