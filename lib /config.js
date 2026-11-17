require('dotenv').config();
const path = require('path');
const root = path.join(__dirname, '..');
module.exports = {
  API_BASE: process.env.API_BASE || 'https://supunofc.site',
  API_KEY: process.env.API_KEY || '',
  BOT_NAME: process.env.BOT_NAME || 'Supun AI',
  OWNER_NAME: process.env.OWNER_NAME || 'Supun',
  OWNER: (process.env.OWNER_NUMBER || '').split(',').map(s => s.trim()).filter(Boolean),
  PREFIX: process.env.PREFIX || '.',
  DEFAULT_MODEL: process.env.DEFAULT_MODEL || 'qwen',
  PORT: process.env.PORT || 3000,
  SESSION_DIR: process.env.SESSION_DIR || path.join(root, 'sessions'),
  DATA_DIR: process.env.DATA_DIR || path.join(root, 'data'),
};
