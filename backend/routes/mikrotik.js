var express = require('express');
var router = express.Router();
var MikrotikService = require('../services/mikrotik');
var verifyToken = require('../middleware/auth');
var Pelanggan = require('../models/Pelanggan');

// Protect all mikrotik routes with JWT
router.use(verifyToken);

/* GET /api/mikrotik/status - Check connection to Mikrotik */
router.get('/status', async function(req, res) {
  var status = await MikrotikService.ping();
  res.json({
    success: true,
    data: status
  });
});

/* GET /api/mikrotik/secrets - List all PPPoE secrets (for onboarding dropdown) */
router.get('/secrets', async function(req, res) {
  try {
    var secrets = await MikrotikService.getSecrets();
    res.json({
      success: true,
      data: secrets
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil PPPoE secrets dari Mikrotik',
      error: err.message
    });
  }
});

/* GET /api/mikrotik/active - List active connections */
router.get('/active', async function(req, res) {
  try {
    var active = await MikrotikService.getActiveConnections();
    res.json({
      success: true,
      data: active
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil active connections dari Mikrotik',
      error: err.message
    });
  }
});

/* GET /api/mikrotik/unregistered - List active PPPoE not registered in DB */
router.get('/unregistered', async function(req, res) {
  try {
    var activeConns = await MikrotikService.getActiveConnections();
    
    Pelanggan.getAll(function(err, customers) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Database error',
          error: err.message
        });
      }

      var registeredUsernames = new Set(
        customers
          .map(function(c) { return c.pppoe_username; })
          .filter(Boolean)
      );

      var unregistered = activeConns.filter(function(conn) {
        return !registeredUsernames.has(conn.name);
      });

      res.json({
        success: true,
        data: unregistered
      });
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal memproses data Mikrotik',
      error: err.message
    });
  }
});

/* GET /api/mikrotik/resources - Telemetri hardware RouterOS */
router.get('/resources', async function(req, res) {
  try {
    var resources = await MikrotikService.getResources();
    res.json({
      success: true,
      data: resources
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data resource Mikrotik',
      error: err.message
    });
  }
});

/* GET /api/mikrotik/interfaces - Status dan traffic interface fisik & virtual */
router.get('/interfaces', async function(req, res) {
  try {
    var ifaces = await MikrotikService.getInterfaces();
    res.json({
      success: true,
      data: ifaces
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data interface Mikrotik',
      error: err.message
    });
  }
});

/* GET /api/mikrotik/logs - Syslog dan event log RouterOS */
router.get('/logs', async function(req, res) {
  try {
    var logs = await MikrotikService.getLogs();
    res.json({
      success: true,
      data: logs
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil log Mikrotik',
      error: err.message
    });
  }
});

/* GET /api/mikrotik/server-health - Status kesehatan server backend & DB */
router.get('/server-health', async function(req, res) {
  try {
    var health = await MikrotikService.getServerHealth();
    res.json({
      success: true,
      data: health
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil status server health',
      error: err.message
    });
  }
});

/* POST /api/mikrotik/sync - Trigger paksa background sync */
router.post('/sync', async function(req, res) {
  try {
    var syncService = require('../services/syncService');
    await syncService.sync();
    res.json({
      success: true,
      message: 'Sinkronisasi data Mikrotik berhasil dijalankan.'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal memicu sinkronisasi',
      error: err.message
    });
  }
});

/* POST /api/mikrotik/kick-session - Putus sesi PPPoE aktif secara instan */
router.post('/kick-session', async function(req, res) {
  try {
    var username = req.body.username;
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username PPPoE harus disertakan'
      });
    }

    var result = await MikrotikService.disconnectSession(username);
    res.json({
      success: true,
      message: result ? `Sesi untuk ${username} berhasil diputus.` : `Tidak ada sesi aktif ditemukan untuk ${username}.`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal memutus sesi PPPoE',
      error: err.message
    });
  }
});

module.exports = router;

