# Supun AI WhatsApp Bot

Baileys + Express. Web page eken pair code ganna, bot eka ඔයාගේ number ekata connect wenawa.
AI = supunofc.site API (Qwen3 / OpenAI / ChatGPT), Song, Voice, Logo.

## Render deploy
1. Me folder eka GitHub repo ekakata push karanna (`.env` push karanna epa).
2. Render → New → Web Service → repo eka select.
3. Build: `npm install` | Start: `node index.js`
4. Environment variables:
   - `API_KEY` = ඔයාගේ supunofc key
   - `OWNER_NUMBER` = 94xxxxxxxxx (optional)
   - `BOT_NAME`, `OWNER_NAME` (optional)
5. Deploy → ඔයාගේ Render URL eka open karala number eka dala pair code ganna.

## Pair
WhatsApp → Linked devices → Link with phone number → code eka enter.

## Commands (prefix `.`)
.menu .ai .qwen .gpt .chatgpt .reset .song .voice .logo
Owner: .auto on/off  .voicemode on/off  .persona <text|reset>  .botname  .model  .logout

## Customise
- Persona / name: web form eken, nathnam `.persona` / `.botname`
- Default persona: `lib/api.js` → `defaultPersona()`
- Welcome/menu text: `lib/handler.js` → `menu()`
- Aluth command ekak: `lib/handler.js` switch ekata `case` ekak add karanna

## Notes
- Render free plan eke disk eka ephemeral: redeploy/restart unama session ayeth pair karanna wenawa.
  Persistent disk (paid) ekak add karala `SESSION_DIR=/data/sessions` `DATA_DIR=/data` set karanna.
- Free plan eka idle unama sleep wenawa (bot eka kelinma wena nisa paid / UptimeRobot ping use karanna).
- Unofficial WhatsApp library ekak nisa ban risk eka thiyenawa – main number ekata wada spare number ekak use karanna.
- API key eka kawruwath ekka share karanna epa.
