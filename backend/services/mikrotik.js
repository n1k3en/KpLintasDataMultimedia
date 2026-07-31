var RouterOSAPI = require('node-routeros').RouterOSAPI;
var ConfigService = require('./configService');

// Helper function to establish connection, write command, close connection, and return data
async function executeCommand(command, params, customConfig) {
  var host = (customConfig && customConfig.host) || ConfigService.get('MIKROTIK_HOST', process.env.MIKROTIK_HOST);
  var user = (customConfig && customConfig.user) || ConfigService.get('MIKROTIK_USER', process.env.MIKROTIK_USER);
  var pass = (customConfig && customConfig.pass) || ConfigService.get('MIKROTIK_PASS', process.env.MIKROTIK_PASS);
  var port = parseInt((customConfig && customConfig.port) || ConfigService.get('MIKROTIK_PORT', process.env.MIKROTIK_PORT) || '8728', 10);

  if (!host || !user || !pass) {
    throw new Error('Kredensial Mikrotik belum dikonfigurasi.');
  }

  var conn = new RouterOSAPI({
    host: host,
    user: user,
    password: pass,
    port: port,
    timeout: 5
  });

  try {
    await conn.connect();
    var data = params ? await conn.write(command, params) : await conn.write(command);
    await conn.close();
    return data;
  } catch (err) {
    try {
      await conn.close();
    } catch (e) {}
    throw err;
  }
}

var MikrotikService = {
  // Check if router is reachable (ping)
  ping: async function(customConfig) {
    try {
      var data = await executeCommand('/system/resource/print', null, customConfig);
      if (data && data.length > 0) {
        return {
          online: true,
          version: data[0].version || 'Unknown',
          board: data[0]['board-name'] || 'Mikrotik'
        };
      }
      return { online: false, error: 'Respon router kosong' };
    } catch (err) {
      if (err.message && err.message.includes('belum dikonfigurasi')) {
        console.log('[Mikrotik] Kredensial Mikrotik belum dikonfigurasi.');
      } else {
        console.error('Mikrotik Connection Error detail:', err);
      }
      return {
        online: false,
        error: err.message
      };
    }
  },

  // Get all PPPoE Secrets (/ppp/secret)
  getSecrets: async function() {
    try {
      var data = await executeCommand('/ppp/secret/print');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Error fetching PPPoE secrets:', err.message);
      throw new Error('Gagal terhubung ke Mikrotik: ' + err.message);
    }
  },

  // Get all active PPPoE connections (/ppp/active)
  getActiveConnections: async function() {
    try {
      var data = await executeCommand('/ppp/active/print');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Error fetching active connections:', err.message);
      throw new Error('Gagal terhubung ke Mikrotik: ' + err.message);
    }
  },

  // Check if secret exists
  validateSecret: async function(username) {
    try {
      var secrets = await this.getSecrets();
      return secrets.some(function(secret) {
        return secret.name === username;
      });
    } catch (err) {
      return false;
    }
  },

  // Enable PPPoE Secret
  enableSecret: async function(username) {
    if (!username) return;
    try {
      console.log(`[Mikrotik] Enabling PPPoE secret: ${username}`);
      // Find secret first to get its .id (required for set commands)
      var secrets = await executeCommand('/ppp/secret/print', ['?name=' + username]);
      if (secrets && secrets.length > 0) {
        var secretId = secrets[0]['.id'];
        await executeCommand('/ppp/secret/set', [
          '=.id=' + secretId,
          '=disabled=no'
        ]);
        console.log(`[Mikrotik] PPPoE secret ${username} enabled successfully.`);
        return true;
      }
      console.warn(`[Mikrotik] Secret ${username} not found, cannot enable.`);
      return false;
    } catch (err) {
      console.error(`[Mikrotik] Failed to enable secret ${username}:`, err.message);
      throw err;
    }
  },

  // Disable PPPoE Secret
  disableSecret: async function(username) {
    if (!username) return;
    try {
      console.log(`[Mikrotik] Disabling PPPoE secret: ${username}`);
      // Find secret first to get its .id
      var secrets = await executeCommand('/ppp/secret/print', ['?name=' + username]);
      if (secrets && secrets.length > 0) {
        var secretId = secrets[0]['.id'];
        await executeCommand('/ppp/secret/set', [
          '=.id=' + secretId,
          '=disabled=yes'
        ]);
        console.log(`[Mikrotik] PPPoE secret ${username} disabled successfully.`);
        
        // Also disconnect their active session immediately (kick them off)
        await this.disconnectSession(username);
        return true;
      }
      console.warn(`[Mikrotik] Secret ${username} not found, cannot disable.`);
      return false;
    } catch (err) {
      console.error(`[Mikrotik] Failed to disable secret ${username}:`, err.message);
      throw err;
    }
  },

  // Disconnect active PPPoE session
  disconnectSession: async function(username) {
    if (!username) return;
    try {
      console.log(`[Mikrotik] Checking for active session to disconnect: ${username}`);
      // Find active connection ID
      var activeConns = await executeCommand('/ppp/active/print', ['?name=' + username]);
      if (activeConns && activeConns.length > 0) {
        var connId = activeConns[0]['.id'];
        await executeCommand('/ppp/active/remove', [
          '=.id=' + connId
        ]);
        console.log(`[Mikrotik] Kicked active session for user ${username}.`);
        return true;
      }
      console.log(`[Mikrotik] No active session found for user ${username} to disconnect.`);
      return false;
    } catch (err) {
      console.error(`[Mikrotik] Failed to disconnect session for ${username}:`, err.message);
      throw err;
    }
  }
};

module.exports = MikrotikService;
