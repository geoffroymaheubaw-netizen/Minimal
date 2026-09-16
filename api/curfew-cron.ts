import fs from 'fs';
import path from 'path';

/**
 * Autonomous Telegram Curfew Dispatcher (Vercel Serverless & External Cron Handler)
 * 
 * Schedule requirement:
 * - Lundi, Mardi, Mercredi, Vendredi : 17h10
 * - Jeudi : EXCLU (aucune notification)
 * - Fin de semaine (Samedi, Dimanche) : 19h40
 * - Répétition : toutes les 5 minutes jusqu'à ce que l'utilisateur confirme avoir lâché son téléphone.
 * 
 * Runs independently of the website:
 * - Can be called every 5 minutes by cron-job.org (free), Vercel Cron, GitHub Actions, or server loops.
 * - Auto-detects Telegram button clicks ("✅ J'ai lâché mon téléphone") directly via Telegram Bot API.
 */

interface CurfewState {
  userConfirmedNightCycle: string | null;
  lastPushTimestamp: number;
  lastPushCycle: string;
  confirmedAt?: number;
}

const STATE_FILE = path.join('/tmp', 'curfew-state.json');
const CURFEW_SETTINGS_FILE = path.join(process.cwd(), 'curfew-settings.json');
const TELEGRAM_CONFIG_FILE = path.join(process.cwd(), 'telegram-config.json');
const TELEGRAM_SUBS_FILE = path.join(process.cwd(), 'telegram-subscribers.json');

function loadJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return fallback;
}

function saveJsonSafe(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`[Cron] Could not save ${filePath}:`, err);
  }
}

export default async function handler(req: any, res: any) {
  // Allow CORS for easy testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Resolve Bot Token
  const config = loadJsonSafe<{ token?: string }>(TELEGRAM_CONFIG_FILE, {});
  const token = (process.env.TELEGRAM_BOT_TOKEN || config.token || '').trim();

  if (!token) {
    return res.status(200).json({
      success: false,
      error: 'TELEGRAM_BOT_TOKEN non configuré. Veuillez entrer le token dans les paramètres du launcher.',
    });
  }

  // 2. Resolve Subscribers (Chat IDs)
  const subscribersList = loadJsonSafe<Array<{ chatId: string; name?: string }>>(TELEGRAM_SUBS_FILE, []);
  const envChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  const chatIds = new Set<string>();

  if (envChatId) chatIds.add(envChatId);
  subscribersList.forEach((s) => {
    if (s.chatId) chatIds.add(String(s.chatId));
  });

  // Default fallback for Geoffroy if none registered yet
  if (chatIds.size === 0) {
    chatIds.add('7712575789');
  }

  // 3. Resolve Timezone & Local Clock
  const settings = loadJsonSafe<any>(CURFEW_SETTINGS_FILE, {
    timeZone: 'America/Montreal',
    timezoneOffset: 240,
    repeatIntervalMinutes: 5,
  });

  const timeZone = settings.timeZone || 'America/Montreal';
  const now = new Date();

  // Create date representation in user's timezone
  const userDateObj = new Date(now.toLocaleString('en-US', { timeZone }));
  const currentDay = userDateObj.getDay(); // 0 = Dimanche, 1 = Lundi, ..., 4 = Jeudi, 6 = Samedi
  const currentHour = userDateObj.getHours();
  const currentMinute = userDateObj.getMinutes();

  const formattedTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const currentDayName = dayNames[currentDay];

  // 4. Determine Current Cycle Key and Schedule Target
  // If currentHour < 5, it's late night continuation of yesterday's session
  let effectiveDay = currentDay;
  const cycleDateObj = new Date(userDateObj);
  if (currentHour < 5) {
    cycleDateObj.setDate(cycleDateObj.getDate() - 1);
    effectiveDay = (currentDay + 6) % 7;
  }
  const cycleKey = `${cycleDateObj.getFullYear()}-${String(cycleDateObj.getMonth() + 1).padStart(2, '0')}-${String(cycleDateObj.getDate()).padStart(2, '0')}`;

  // Check Schedule Rules:
  // - Lundi (1), Mardi (2), Mercredi (3), Vendredi (5) : 17h10
  // - Jeudi (4) : EXCLU (aucun rappel)
  // - Fin de semaine (Samedi 6, Dimanche 0) : 19h40
  let isDayEnabled = true;
  let targetTimeStr = '17:10';

  if (effectiveDay === 4) {
    // Jeudi
    isDayEnabled = false;
    targetTimeStr = '17:10';
  } else if (effectiveDay === 0 || effectiveDay === 6) {
    // Fin de semaine (Samedi / Dimanche)
    isDayEnabled = true;
    targetTimeStr = '19:40';
  } else {
    // Lundi, Mardi, Mercredi, Vendredi
    isDayEnabled = true;
    targetTimeStr = '17:10';
  }

  const [tHour, tMinute] = targetTimeStr.split(':').map(Number);
  const isCurfewWindow =
    currentHour < 5 ||
    currentHour > tHour ||
    (currentHour === tHour && currentMinute >= tMinute);

  const isForce = req.query?.force === 'true' || req.query?.test === 'true';

  // 5. Load State (/tmp/curfew-state.json and curfew-settings.json)
  let state = loadJsonSafe<CurfewState>(STATE_FILE, {
    userConfirmedNightCycle: settings.userConfirmedNightCycle || null,
    lastPushTimestamp: settings.lastPushTimestamp || 0,
    lastPushCycle: settings.lastPushCycle || '',
  });

  // 6. Check Telegram for User Acknowledgment ("J'ai lâché mon téléphone" click or /stop message)
  try {
    const updatesRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=50&offset=-50`);
    const updatesData = await updatesRes.json();
    if (updatesData.ok && Array.isArray(updatesData.result)) {
      for (const u of updatesData.result) {
        // A. Button click (callback query)
        if (u.callback_query) {
          const cb = u.callback_query;
          const dataStr = String(cb.data || '');
          const cbChatId = String(cb.message?.chat?.id || cb.from?.id);

          if (dataStr.startsWith('curfew_stop')) {
            const confirmedKey = dataStr.split(':')[1] || cycleKey;
            state.userConfirmedNightCycle = confirmedKey;
            state.confirmedAt = Date.now();
            saveJsonSafe(STATE_FILE, state);

            // Acknowledge callback in Telegram
            await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                callback_query_id: cb.id,
                text: 'Bravo ! Déconnexion confirmée 🌙',
              }),
            });

            // Send confirmation message
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: cbChatId,
                text:
                  `✨ <b>Bravo ! Téléphone lâché.</b>\n\n` +
                  `Votre déconnexion est bien enregistrée. Les rappels toutes les 5 minutes sont coupés pour ce soir.\n\n` +
                  `Passez une excellente soirée et une nuit reposante ! 🛌`,
                parse_mode: 'HTML',
              }),
            });

            // Edit previous reminder message to remove button and show confirmation
            if (cb.message?.message_id) {
              await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: cbChatId,
                  message_id: cb.message.message_id,
                  text: `✅ <b>Téléphone lâché !</b>\nDéconnexion confirmée. Les rappels sont arrêtés pour ce soir.`,
                  parse_mode: 'HTML',
                }),
              }).catch(() => {});
            }
          }
        }

        // B. Text message (e.g. "stop", "ok", "lâché", "pause", "/stop")
        if (u.message?.text) {
          const text = u.message.text.trim().toLowerCase();
          const msgChatId = String(u.message.chat.id);
          const stopKeywords = ['stop', 'ok', 'lâché', 'lache', 'fait', 'bonne nuit', 'arrête', 'arrete', '/stop'];
          if (stopKeywords.some((k) => text === k || text.includes(k))) {
            state.userConfirmedNightCycle = cycleKey;
            state.confirmedAt = Date.now();
            saveJsonSafe(STATE_FILE, state);

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: msgChatId,
                text: `✅ <b>C'est noté !</b> Vos rappels de déconnexion sont suspendus pour la nuit. Reposez-vous bien ! 🌙`,
                parse_mode: 'HTML',
              }),
            }).catch(() => {});
          }
        }
      }
    }
  } catch (tgErr) {
    console.warn('[Cron] Error checking Telegram updates:', tgErr);
  }

  // 7. Check if Curfew applies today
  if (!isForce) {
    if (!isDayEnabled && currentHour >= 5) {
      return res.status(200).json({
        success: true,
        delivered: false,
        status: 'JEUDI_EXCLUDED',
        timeZone,
        currentTime: formattedTime,
        day: currentDayName,
        message: 'Jeudi est exclu du couvre-feu : aucune notification programmée aujourd’hui.',
      });
    }

    if (!isCurfewWindow) {
      return res.status(200).json({
        success: true,
        delivered: false,
        status: 'WAITING_FOR_CURFEW',
        timeZone,
        currentTime: formattedTime,
        day: currentDayName,
        scheduledTime: targetTimeStr,
        message: `En attente du couvre-feu (${currentDayName} prévu à ${targetTimeStr}). Il est actuellement ${formattedTime}.`,
      });
    }
  }

  // 8. Check if Already Confirmed by User for this night cycle
  if (state.userConfirmedNightCycle === cycleKey && !isForce) {
    return res.status(200).json({
      success: true,
      delivered: false,
      status: 'ALREADY_CONFIRMED',
      timeZone,
      currentTime: formattedTime,
      cycleKey,
      message: `Couvre-feu déjà validé par l'utilisateur pour la nuit (${cycleKey}). Les rappels sont arrêtés.`,
    });
  }

  // 9. Check 5-Minute Repetition Interval
  const intervalMinutes = Number(settings.repeatIntervalMinutes) || 5;
  const intervalMs = intervalMinutes * 60 * 1000;
  const isSameCycle = state.lastPushCycle === cycleKey;
  const timeSinceLastPush = Date.now() - (state.lastPushTimestamp || 0);

  if (isSameCycle && timeSinceLastPush < intervalMs && !isForce) {
    const remainingSec = Math.ceil((intervalMs - timeSinceLastPush) / 1000);
    return res.status(200).json({
      success: true,
      delivered: false,
      status: 'WAITING_INTERVAL',
      timeZone,
      currentTime: formattedTime,
      cycleKey,
      repeatIntervalMinutes: intervalMinutes,
      remainingSeconds: remainingSec,
      message: `Rappel déjà envoyé récemment. Prochain rappel dans ~${Math.ceil(remainingSec / 60)} min si non coché.`,
    });
  }

  // 10. Dispatch Telegram Notification to All Registered Subscribers
  let sentCount = 0;
  const results: any[] = [];
  const reminderNumber = isSameCycle && state.lastPushTimestamp > 0 ? 'Rappel' : 'Premier signal';

  const tgMessage =
    `🌙 <b>Il est l'heure de lâcher votre téléphone !</b>\n\n` +
    `Il est <b>${formattedTime}</b> (${currentDayName}). ` +
    `Offrez à vos yeux et votre esprit un repos bien mérité.\n\n` +
    `<i>⚠️ Ce rappel continuera de sonner toutes les 5 minutes jusqu'à ce que vous confirmiez ci-dessous avoir posé votre appareil.</i>`;

  for (const chatId of Array.from(chatIds)) {
    try {
      const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: tgMessage,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ J'ai lâché mon téléphone",
                  callback_data: `curfew_stop:${cycleKey}`,
                },
              ],
            ],
          },
        }),
      });

      const sendData = await sendRes.json();
      if (sendData.ok) {
        sentCount++;
      }
      results.push({ chatId, ok: sendData.ok, description: sendData.description });
    } catch (err: any) {
      results.push({ chatId, ok: false, error: err?.message || 'Erreur réseau' });
    }
  }

  // Update last push state
  state.lastPushTimestamp = Date.now();
  state.lastPushCycle = cycleKey;
  saveJsonSafe(STATE_FILE, state);

  // Also update curfew-settings.json if writable
  try {
    settings.lastPushTimestamp = state.lastPushTimestamp;
    settings.lastPushCycle = state.lastPushCycle;
    saveJsonSafe(CURFEW_SETTINGS_FILE, settings);
  } catch {}

  return res.status(200).json({
    success: sentCount > 0,
    delivered: sentCount > 0,
    status: 'SENT_ALERT',
    timeZone,
    currentTime: formattedTime,
    day: currentDayName,
    cycleKey,
    sentCount,
    totalRecipients: chatIds.size,
    repeatIntervalMinutes: intervalMinutes,
    results,
    message: `Alerte Telegram envoyée avec succès à ${sentCount} appareil(s). Répétition programmée toutes les ${intervalMinutes} min jusqu'à confirmation.`,
  });
}
