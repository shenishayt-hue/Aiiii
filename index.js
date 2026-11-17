const express = require('express');
const path = require('path');
const axios = require('axios');
const cfg = require('./lib/config');
const store = require('./lib/store');
const { startSession, restoreAll, status } = require('./lib/bot');

if (!cfg.API_KEY) console.warn('⚠️  API_KEY set කරලා නෑ (.env / Render env)');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const hits = new Map();
const limited = ip => {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  list.push(now); hits.set(ip, list);
  return list.length > 6;
};

app.post('/api/pair', async (req, res) => {
  const number = String(req.body.number || '').replace(/\D/g, '');
  if (number.length < 8 || number.length > 15)
    return res.status(400).json({ error: 'Number එක වැරදියි. Country code එක්ක දාන්න (e.g. 94771234567)' });
  if (limited(req.ip)) return res.status(429).json({ error: 'වැඩි උත්සාහයන්. විනාඩි 10කින් try කරන්න.' });

  const botName = String(req.body.botName || '').slice(0, 40);
  const persona = String(req.body.persona || '').slice(0, 800);
  if (botName || persona) store.set(number, { ...(botName && { botName }), ...(persona && { persona }) });

  try {
    const r = await startSession(number, true);
    if (r.status === 'open') return res.json({ linked: true });
    if (!r.code) return res.status(409).json({ error: 'Session එක දැනටමත් තියෙනවා. ටිකක් ඉඳලා නැවත try කරන්න.' });
    res.json({ code: r.code.match(/.{1,4}/g).join('-') });
  } catch (e) {
    console.error('[pair]', e.message);
    res.status(500).json({ error: 'Pair code එක ගන්න බැරි වුනා. නැවත try කරන්න.' });
  }
});

app.get('/api/status/:n', (req, res) => res.json({ status: status(req.params.n.replace(/\D/g, '')) }));
app.get('/health', (_, res) => res.send('ok'));

app.listen(cfg.PORT, () => {
  console.log('🌐 Web on port', cfg.PORT);
  restoreAll();
  const self = process.env.RENDER_EXTERNAL_URL;
  if (self) setInterval(() => axios.get(self + '/health').catch(() => {}), 10 * 60 * 1000);
});
