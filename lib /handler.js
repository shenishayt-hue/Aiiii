const { normalizeMessageContent, jidNormalizedUser } = require('@whiskeysockets/baileys');
const cfg = require('./config');
const store = require('./store');
const api = require('./api');

const getContent = m => normalizeMessageContent(m.message);
const getText = m => {
  const c = getContent(m); if (!c) return '';
  return c.conversation || c.extendedTextMessage?.text || c.imageMessage?.caption || c.videoMessage?.caption || '';
};
const getCtx = m => {
  const c = getContent(m) || {};
  return c.extendedTextMessage?.contextInfo || c.imageMessage?.contextInfo || c.videoMessage?.contextInfo || {};
};

const menu = (s, p) => `╭━━〔 🤖 *${s.botName || cfg.BOT_NAME}* 〕━━╮
┃ 💬 DM එකේ ඕනම message එකකට AI reply කරනවා
┃ 👥 Group එකේ mention / reply කරොත් පමණයි
╰━━━━━━━━━━━━━━━━━╯

*AI*
• ${p}ai <ප්‍රශ්නය>  – AI chat
• ${p}qwen / ${p}gpt / ${p}chatgpt <q> – model එක තෝරලා
• ${p}reset – memory clear

*Media*
• ${p}song <prompt> – AI song
• ${p}voice <text> – text → voice (si/en/ta/hi/ja)
• ${p}logo <name> | <keyword> | <prompt>

*Owner*
• ${p}auto on/off – DM auto-reply
• ${p}voicemode on/off – AI reply voice එකෙනුත්
• ${p}persona <text|reset> – bot personality
• ${p}botname <name>
• ${p}model qwen/openai/chatgpt
• ${p}logout

_Powered by ${cfg.OWNER_NAME}_`;

async function handleMessage(sock, m, number) {
  const chat = m.key.remoteJid;
  if (!m.message || !chat || chat === 'status@broadcast' || chat.endsWith('@newsletter')) return;
  const isGroup = chat.endsWith('@g.us');
  const fromMe = !!m.key.fromMe;
  const sender = fromMe ? sock.user.id : (m.key.participant || chat);
  const senderNum = jidNormalizedUser(sender).split('@')[0];
  const isOwner = fromMe || senderNum === number || cfg.OWNER.includes(senderNum);

  const s = store.get(number);
  const prefix = s.prefix || cfg.PREFIX;
  let text = getText(m).trim();
  if (!text) return;

  const reply = (t, extra = {}) => sock.sendMessage(chat, { text: t, ...extra }, { quoted: m });
  const typing = () => sock.sendPresenceUpdate('composing', chat).catch(() => {});
  const fail = () => reply('සමාවෙන්න, දැන් AI එක busy 😅 ටිකකින් නැවත try කරන්න 🙏');

  async function replyAI(a) {
    await reply(a);
    if (s.voice) {
      try {
        const buf = await api.tts(a.replace(/[*_~`]/g, ''), api.hasSinhala(a) ? 'si' : 'en');
        await sock.sendMessage(chat, { audio: buf, mimetype: 'audio/mpeg', ptt: false }, { quoted: m });
      } catch (e) { console.error('[voice]', e.message); }
    }
  }

  // ---------- commands ----------
  if (text.startsWith(prefix)) {
    const [c, ...rest] = text.slice(prefix.length).trim().split(/\s+/);
    const cmd = (c || '').toLowerCase();
    const args = rest.join(' ');
    const ownerOnly = () => { if (!isOwner) { reply('🔒 මේක owner ට පමණයි.'); return false; } return true; };
    const onoff = v => /^(on|true|1)$/i.test(v);

    try {
      switch (cmd) {
        case 'menu': case 'help': case 'start':
          return reply(menu(s, prefix));

        case 'ping':
          return reply('🏓 Pong! Bot online ✅');

        case 'ai': case 'ask': case 'bot': {
          if (!args) return reply(`ප්‍රශ්නයක් දාන්න. උදා: ${prefix}ai කොහොමද?`);
          await typing();
          return replyAI(await api.chat(chat, args, s));
        }
        case 'qwen': case 'gpt': case 'chatgpt': {
          if (!args) return reply('ප්‍රශ්නයක් දාන්න 🙂');
          await typing();
          const key = cmd === 'gpt' ? 'openai' : cmd;
          return reply(await api.ask(args, key));
        }
        case 'reset':
          api.resetMemory(chat);
          return reply('🧹 Memory clear කළා!');

        case 'song': case 'music': {
          if (!args) return reply(`උදා: ${prefix}song sad love song`);
          await reply('🎵 Song එක හදනවා... විනාඩි කිහිපයක් යයි ⏳');
          const r = await api.song(args);
          if (r.audio) {
            await sock.sendMessage(chat, { audio: { url: r.audio }, mimetype: 'audio/mpeg' }, { quoted: m });
            if (r.title) await reply('🎶 ' + r.title);
          } else await reply('Song result:\n' + r.raw);
          return;
        }
        case 'voice': case 'tts': case 'say': {
          if (!args) return reply(`උදා: ${prefix}voice ආයුබෝවන්`);
          let lang, txt = args;
          const first = args.split(/\s+/)[0].toLowerCase();
          if (/^(si|en|ta|hi|ja|id|ko|fr|de|es)$/.test(first) && args.split(/\s+/).length > 1) { lang = first; txt = args.slice(first.length).trim(); }
          else lang = api.hasSinhala(txt) ? 'si' : 'en';
          await sock.sendPresenceUpdate('recording', chat).catch(() => {});
          const buf = await api.tts(txt, lang);
          return sock.sendMessage(chat, { audio: buf, mimetype: 'audio/mpeg', ptt: false }, { quoted: m });
        }
        case 'logo': {
          if (!args) return reply(`උදා: ${prefix}logo Supun | Anime | soft bright colors anime style`);
          const [name, kw, pr] = args.split('|').map(x => x.trim());
          await reply('🎨 Logo හොයනවා...');
          const imgs = await api.logo(name, kw || 'Anime', pr || '');
          if (!imgs.length) return reply('Logo කිසිවක් හම්බුනේ නෑ 😕');
          for (const i of imgs) await sock.sendMessage(chat, { image: { url: i.url }, caption: '🎨 ' + i.name }, { quoted: m });
          return;
        }

        // ----- owner -----
        case 'auto':
          if (!ownerOnly()) return;
          store.set(number, { auto: onoff(args) });
          return reply(`💬 Auto reply: *${onoff(args) ? 'ON' : 'OFF'}*`);
        case 'voicemode':
          if (!ownerOnly()) return;
          store.set(number, { voice: onoff(args) });
          return reply(`🎙️ Voice mode: *${onoff(args) ? 'ON' : 'OFF'}*`);
        case 'persona':
          if (!ownerOnly()) return;
          if (!args) return reply('Persona text එකක් දාන්න, නැත්නම් `' + prefix + 'persona reset`');
          store.set(number, { persona: /^reset$/i.test(args) ? null : args });
          api.resetMemory(chat);
          return reply('✅ Persona update කළා!');
        case 'botname':
          if (!ownerOnly() || !args) return;
          store.set(number, { botName: args });
          return reply('✅ Bot name: ' + args);
        case 'model':
          if (!ownerOnly()) return;
          if (!api.models[args]) return reply('qwen / openai / chatgpt');
          store.set(number, { model: args });
          return reply('✅ Model: ' + args);
        case 'logout':
          if (!ownerOnly()) return;
          await reply('👋 Logout වෙනවා...');
          return sock.logout();
        default:
          return;
      }
    } catch (e) {
      console.error('[cmd]', cmd, e.message);
      return fail();
    }
  }

  // ---------- auto AI reply ----------
  if (fromMe) return;
  let trigger = !isGroup && s.auto;
  if (isGroup) {
    const ctx = getCtx(m);
    const ids = [sock.user.id, sock.user.lid].filter(Boolean).map(j => jidNormalizedUser(j));
    const mentioned = (ctx.mentionedJid || []).some(j => ids.includes(jidNormalizedUser(j)));
    const replied = ctx.participant && ids.includes(jidNormalizedUser(ctx.participant));
    trigger = mentioned || replied;
    text = text.replace(/@\d+/g, '').trim();
  }
  if (!trigger || !text) return;

  try {
    await typing();
    await replyAI(await api.chat(chat, text, s));
  } catch (e) {
    console.error('[auto]', e.message);
    await fail();
  }
}

module.exports = { handleMessage };
