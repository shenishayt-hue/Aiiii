const {
  default: makeWASocket, useMultiFileAuthState, DisconnectReason,
  fetchLatestBaileysVersion, Browsers, makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const { handleMessage } = require('./handler');

const logger = pino({ level: 'silent' });
const sessions = new Map(); // number -> { sock, status, stopped }
fs.mkdirSync(cfg.SESSION_DIR, { recursive: true });

async function startSession(number, wantCode = false) {
  const old = sessions.get(number);
  if (old?.status === 'open') return { status: 'open' };
  if (old && wantCode) { old.stopped = true; try { old.sock.ws.close(); } catch {} }

  const dir = path.join(cfg.SESSION_DIR, number);
  if (wantCode && old) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version, logger, printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    markOnlineOnConnect: false,
  });
  const entry = { sock, status: 'connecting', stopped: false };
  sessions.set(number, entry);

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') { entry.status = 'open'; console.log('[bot] connected', number); }
    if (connection === 'close') {
      entry.status = 'closed';
      if (entry.stopped) return;
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut || !state.creds.registered) {
        console.log('[bot] session ended', number);
        sessions.delete(number);
        fs.rmSync(dir, { recursive: true, force: true });
      } else setTimeout(() => startSession(number).catch(console.error), 3000);
    }
  });
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) handleMessage(sock, m, number).catch(e => console.error('[handler]', e.message));
  });

  let code = null;
  if (wantCode && !state.creds.registered) {
    await new Promise(r => setTimeout(r, 2500));
    code = await sock.requestPairingCode(number);
  }
  return { status: entry.status, code };
}

async function restoreAll() {
  for (const n of fs.readdirSync(cfg.SESSION_DIR)) {
    if (/^\d+$/.test(n)) startSession(n).catch(e => console.error('[restore]', n, e.message));
  }
}

const status = n => sessions.get(n)?.status || 'none';
module.exports = { startSession, restoreAll, status };
