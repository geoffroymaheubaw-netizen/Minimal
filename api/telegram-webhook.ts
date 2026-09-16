import fs from 'fs';
import path from 'path';

const STATE_FILE = path.join('/tmp', 'curfew-state.json');
const CURFEW_SETTINGS_FILE = path.join(process.cwd(), 'curfew-settings.json');
const TELEGRAM_CONFIG_FILE = path.join(process.cwd(), 'telegram-config.json');

function loadJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {}
  return fallback;
}

function saveJsonSafe(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'Telegram Webhook active. Use POST from Telegram.' });
  }

  const config = loadJsonSafe<{ token?: string }>(TELEGRAM_CONFIG_FILE, {});
  const token = (process.env.TELEGRAM_BOT_TOKEN || config.token || '').trim();

  const update = req.body;
  if (!update) {
    return res.status(200).json({ ok: true });
  }

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // 1. Handle Button Clicks (Callback queries)
  if (update.callback_query) {
    const cb = update.callback_query;
    const dataStr = String(cb.data || '');
    const chatId = String(cb.message?.chat?.id || cb.from?.id);

    if (dataStr.startsWith('curfew_stop')) {
      const cycleKey = dataStr.split(':')[1] || todayKey;

      // Update state
      const state = loadJsonSafe<any>(STATE_FILE, {});
      state.userConfirmedNightCycle = cycleKey;
      state.confirmedAt = Date.now();
      saveJsonSafe(STATE_FILE, state);

      const settings = loadJsonSafe<any>(CURFEW_SETTINGS_FILE, {});
      settings.userConfirmedNightCycle = cycleKey;
      saveJsonSafe(CURFEW_SETTINGS_FILE, settings);

      if (token) {
        // Acknowledge tap
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: cb.id,
            text: 'Bravo ! Déconnexion confirmée 🌙',
          }),
        }).catch(() => {});

        // Edit message
        if (cb.message?.message_id) {
          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: cb.message.message_id,
              text: `✅ <b>Téléphone lâché !</b>\nDéconnexion confirmée. Les rappels de 5 min sont coupés pour ce soir. Bonne nuit ! 🛌`,
              parse_mode: 'HTML',
            }),
          }).catch(() => {});
        }

        // Send confirmation text
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✨ <b>Déconnexion validée !</b>\nBravo pour ce choix. Vos rappels sont éteints pour le reste de la nuit. Reposez-vous bien ! 🌙`,
            parse_mode: 'HTML',
          }),
        }).catch(() => {});
      }

      return res.status(200).json({ ok: true, action: 'confirmed', cycleKey });
    }
  }

  // 2. Handle Text Messages (/start, /stop, ok, lache)
  if (update.message?.text) {
    const text = update.message.text.trim().toLowerCase();
    const chatId = String(update.message.chat.id);
    const stopKeywords = ['stop', 'ok', 'lâché', 'lache', 'fait', 'bonne nuit', 'arrête', '/stop'];

    if (stopKeywords.some((k) => text === k || text.includes(k))) {
      const state = loadJsonSafe<any>(STATE_FILE, {});
      state.userConfirmedNightCycle = todayKey;
      saveJsonSafe(STATE_FILE, state);

      if (token) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ <b>Téléphone lâché noté !</b> Rappels suspendus pour ce soir. Reposez-vous bien ! 🌙`,
            parse_mode: 'HTML',
          }),
        }).catch(() => {});
      }
    }
  }

  return res.status(200).json({ ok: true });
}
