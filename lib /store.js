const fs = require('fs');
const path = require('path');
const cfg = require('./config');
fs.mkdirSync(cfg.DATA_DIR, { recursive: true });
const file = path.join(cfg.DATA_DIR, 'settings.json');
let db = {};
try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
const defaults = { auto: true, voice: false, model: cfg.DEFAULT_MODEL };
module.exports = {
  get: n => ({ ...defaults, ...(db[n] || {}) }),
  set(n, patch) {
    db[n] = { ...(db[n] || {}), ...patch };
    fs.writeFileSync(file, JSON.stringify(db, null, 2));
  },
};
