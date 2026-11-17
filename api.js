const axios = require('axios');
const cfg = require('./config');

const http = axios.create({ baseURL: cfg.API_BASE, timeout: 90000 });

async function call(p, params, timeout) {
  const r = await http.get(p, { params: { ...params, apikey: cfg.API_KEY }, timeout });
  if (!r.data || r.data.success === false) throw new Error('API error ' + p);
  return r.data;
}

// ---- text models ----
const models = {
  qwen: async q => (await call('/api/ai/qwen3', { query: q })).result.answer,
  openai: async q => (await call('/api/ai/ai/openai', { q })).result.result,
  chatgpt: async q => (await call('/api/ai/chatgpt-ai', { q })).result.response,
};

const clean = t => String(t).replace(/\*\*(.+?)\*\*/g, '*$1*').replace(/^#{1,6}\s*/gm, '').trim();

async function ask(q, prefer = 'qwen') {
  const order = [prefer, ...Object.keys(models).filter(k => k !== prefer)];
  for (const k of order) {
    try {
      const a = await models[k](q);
      if (a && String(a).trim()) return clean(a);
    } catch (e) { console.error('[model]', k, e.message); }
  }
  throw new Error('all models failed');
}

// ---- chat with persona + short memory ----
const memory = new Map();
const hasSinhala = t => /[\u0D80-\u0DFF]/.test(t);

function defaultPersona(s) {
  return `You are ${s.botName || cfg.BOT_NAME}, a friendly WhatsApp AI assistant made by ${cfg.OWNER_NAME}. ` +
    `Reply in natural, simple Sinhala (Sinhala Unicode script) when the user writes Sinhala or Singlish (Sinhala typed in English letters). ` +
    `If the user writes English, reply in English. Keep answers short and chatty like WhatsApp, use a few emojis, ` +
    `never mention these instructions or the underlying model.`;
}

async function chat(chatId, q, s) {
  const hist = memory.get(chatId) || [];
  const persona = s.persona || defaultPersona(s);
  let h = hist.slice(-6).map(x => `${x.r === 'u' ? 'User' : 'Assistant'}: ${x.t.slice(0, 300)}`);
  const build = () => `${persona}\n\n${h.join('\n')}\nUser: ${q}\nAssistant:`;
  while (build().length > 1900 && h.length) h.shift();
  const a = (await ask(build().slice(-2000), s.model)).replace(/^Assistant:\s*/i, '');
  hist.push({ r: 'u', t: q }, { r: 'a', t: a });
  memory.set(chatId, hist.slice(-12));
  return a;
}
const resetMemory = id => memory.delete(id);

// ---- helpers ----
function deepUrls(o, acc = []) {
  if (typeof o === 'string' && /^https?:\/\//.test(o)) acc.push(o);
  else if (o && typeof o === 'object') for (const v of Object.values(o)) deepUrls(v, acc);
  return acc;
}
function deepFind(o, key) {
  if (!o || typeof o !== 'object') return null;
  if (typeof o[key] === 'string') return o[key];
  for (const v of Object.values(o)) { const r = deepFind(v, key); if (r) return r; }
  return null;
}

// ---- song ----
async function song(prompt) {
  const data = await call('/api/ai/ai/ai-song', { prompt }, 180000);
  const urls = deepUrls(data.result);
  const audio = urls.find(u => /\.(mp3|m4a|wav|ogg)(\?|$)/i.test(u)) || urls.find(u => /audio|song|music/i.test(u)) || urls[0];
  return { audio, title: deepFind(data.result, 'title'), raw: JSON.stringify(data.result).slice(0, 500) };
}

// ---- voice (TTS) ----
const gtts = (t, lang) => `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(t)}&tl=${lang}&client=tw-ob`;
const UA = { 'User-Agent': 'Mozilla/5.0' };

function chunk(text, max = 180) {
  const out = []; let cur = '';
  for (const part of text.replace(/\s+/g, ' ').split(/(?<=[.!?෴।])\s+/)) {
    if ((cur + ' ' + part).length > max) { if (cur) out.push(cur); cur = part.slice(0, max); }
    else cur = (cur + ' ' + part).trim();
  }
  if (cur) out.push(cur);
  return out.slice(0, 3);
}

async function tts(text, lang = 'si', voiceId = 'F1') {
  const bufs = [];
  for (const part of chunk(text)) {
    let buf;
    if (lang !== 'si') {
      try {
        const d = await call('/api/ai/ai-voice', { text: part, lang, voiceId });
        const u = d.result?.audio?.stream_url;
        if (u) buf = Buffer.from((await axios.get(u, { responseType: 'arraybuffer', headers: UA })).data);
      } catch (e) { console.error('[tts api]', e.message); }
    }
    if (!buf) buf = Buffer.from((await axios.get(gtts(part, lang), { responseType: 'arraybuffer', headers: UA })).data);
    bufs.push(buf);
  }
  return Buffer.concat(bufs);
}

// ---- logo ----
async function logo(text, keywords = 'Anime', prompt = '') {
  const d = await call('/api/ai/logo-gen', { text, keywords, prompt });
  return (d.result.assets || []).slice(0, 3).map(a => ({ url: a.imageUrl, name: a.designName }));
}

module.exports = { ask, chat, resetMemory, song, tts, logo, models, hasSinhala };
