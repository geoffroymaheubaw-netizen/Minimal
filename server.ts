import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  isTelegramConfigured,
  getBotInfo,
  getTelegramSubscribers,
  pollTelegramUpdates,
  sendTelegramMessage,
  sendTestTelegramAlert,
  setBotToken,
  removeBotToken,
  addOrUpdateSubscriber,
} from './server/telegram.js';

const PORT = 3000;
const HOST = '0.0.0.0';

// -----------------------------------------------------------------------------
// Curfew Settings Storage (Dedicated for Telegram Reminders)
// -----------------------------------------------------------------------------
export interface CurfewSettings {
  enabled: boolean;
  time?: string;
  weekdayTime?: string;
  weekendTime?: string;
  scheduleMode?: 'unified' | 'weekdays_weekend' | 'custom_days';
  dayTimes?: Record<number, { enabled: boolean; time: string }>;
  days: number[];
  repeatIntervalMinutes?: number;
  customMessage?: string;
  timezoneOffset: number; // in minutes (e.g. -120 for UTC+2 Paris)
  userConfirmedNightCycle?: string | null;
  lastPushTimestamp?: number;
  lastPushCycle?: string;
}

const CURFEW_FILE = path.join(process.cwd(), 'curfew-settings.json');
let globalCurfewSettings: CurfewSettings = {
  enabled: true,
  time: '17:10',
  weekdayTime: '17:10',
  weekendTime: '19:40',
  scheduleMode: 'custom_days',
  days: [1, 2, 3, 5, 6, 0], // Lun, Mar, Mer, Ven, Sam, Dim (Jeudi exclu)
  repeatIntervalMinutes: 5,
  customMessage: "Il est l'heure de lâcher votre téléphone et de reposer votre esprit.",
  timezoneOffset: 240, // Default to America/Montreal (UTC-4 EDT)
  userConfirmedNightCycle: null,
  lastPushTimestamp: 0,
  lastPushCycle: '',
  dayTimes: {
    1: { enabled: true, time: '17:10' }, // Lundi
    2: { enabled: true, time: '17:10' }, // Mardi
    3: { enabled: true, time: '17:10' }, // Mercredi
    4: { enabled: false, time: '17:10' }, // Jeudi (Désactivé)
    5: { enabled: true, time: '17:10' }, // Vendredi
    6: { enabled: true, time: '19:40' }, // Samedi
    0: { enabled: true, time: '19:40' }, // Dimanche
  },
};

function loadCurfewSettings() {
  try {
    if (fs.existsSync(CURFEW_FILE)) {
      const data = JSON.parse(fs.readFileSync(CURFEW_FILE, 'utf-8'));
      globalCurfewSettings = { ...globalCurfewSettings, ...data };
      console.log('[Curfew] Loaded global curfew settings from disk');
    }
  } catch (err) {
    console.warn('Could not read curfew-settings.json:', err);
  }
}

function saveCurfewSettings() {
  try {
    fs.writeFileSync(CURFEW_FILE, JSON.stringify(globalCurfewSettings, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not save curfew-settings.json:', err);
  }
}

loadCurfewSettings();

// -----------------------------------------------------------------------------
// Curfew Evaluation Logic
// -----------------------------------------------------------------------------
function resolveScheduledTimeForUser(
  settings: CurfewSettings,
  userDayIndex: number
): { enabled: boolean; time: string } {
  const mode = settings.scheduleMode || 'weekdays_weekend';

  if (mode === 'custom_days' && settings.dayTimes && settings.dayTimes[userDayIndex]) {
    return {
      enabled: settings.dayTimes[userDayIndex].enabled,
      time: settings.dayTimes[userDayIndex].time || settings.time || '21:30',
    };
  }

  if (mode === 'weekdays_weekend') {
    const isWeekend = userDayIndex === 0 || userDayIndex === 6;
    const isDayActive = settings.days.includes(userDayIndex);
    const targetTime = isWeekend
      ? settings.weekendTime || '23:00'
      : settings.weekdayTime || '21:30';
    return {
      enabled: isDayActive,
      time: targetTime,
    };
  }

  return {
    enabled: settings.days.includes(userDayIndex),
    time: settings.time || '21:30',
  };
}

function computeCycleKey(userDate: Date, targetTimeStr: string): string {
  const d = new Date(userDate);
  const [h] = (targetTimeStr || '21:30').split(':').map(Number);
  if (h >= 12 && d.getUTCHours() < 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function evaluateSubscriberCurfew(
  settings: CurfewSettings,
  now: Date
): {
  isCurfewActive: boolean;
  cycleKey: string;
  scheduledTime: string;
  minutesElapsed: number;
} {
  // Convert UTC server time to user's local time using timezoneOffset in minutes
  const offset = typeof settings.timezoneOffset === 'number' ? settings.timezoneOffset : -120;
  const userLocalMs = now.getTime() - offset * 60000;
  const userLocalDate = new Date(userLocalMs);

  const todayIndex = userLocalDate.getUTCDay();
  const currentHour = userLocalDate.getUTCHours();

  // 1. Check early morning continuation (< 06:00) of yesterday's curfew
  if (currentHour < 6) {
    const yesterdayIndex = (todayIndex + 6) % 7;
    const yesterdaySchedule = resolveScheduledTimeForUser(settings, yesterdayIndex);
    if (yesterdaySchedule.enabled) {
      const [yH, yM] = yesterdaySchedule.time.split(':').map(Number);
      if (yH >= 12) {
        const yDate = new Date(userLocalDate);
        yDate.setUTCDate(yDate.getUTCDate() - 1);
        yDate.setUTCHours(yH, yM, 0, 0);

        const diffYMs = userLocalMs - yDate.getTime();
        const yMinutesElapsed = Math.floor(diffYMs / 60000);
        if (diffYMs >= 0 && diffYMs <= 10 * 3600 * 1000) {
          const cycleKey = computeCycleKey(userLocalDate, yesterdaySchedule.time);
          return {
            isCurfewActive: settings.enabled,
            cycleKey,
            scheduledTime: yesterdaySchedule.time,
            minutesElapsed: yMinutesElapsed,
          };
        }
      }
    }
  }

  // 2. Today's schedule
  const todaySchedule = resolveScheduledTimeForUser(settings, todayIndex);
  const cycleKey = computeCycleKey(userLocalDate, todaySchedule.time);

  if (!settings.enabled || !todaySchedule.enabled) {
    return {
      isCurfewActive: false,
      cycleKey,
      scheduledTime: todaySchedule.time,
      minutesElapsed: 0,
    };
  }

  const [tH, tM] = todaySchedule.time.split(':').map(Number);
  const targetDate = new Date(userLocalDate);
  targetDate.setUTCHours(tH, tM, 0, 0);

  const diffMs = userLocalMs - targetDate.getTime();
  const minutesElapsed = Math.floor(diffMs / 60000);
  const isCurfewActive = diffMs >= 0 && diffMs <= 10 * 3600 * 1000;

  return {
    isCurfewActive,
    cycleKey,
    scheduledTime: todaySchedule.time,
    minutesElapsed,
  };
}

/**
 * Evaluates the curfew conditions and dispatches Telegram notification if active.
 * Safe to be called continuously in a background loop or triggered via cron endpoint.
 */
export async function evaluateAndSendCurfewAlerts(now: Date = new Date()): Promise<{
  isCurfewActive: boolean;
  sent: boolean;
  message?: string;
  details?: any;
}> {
  const telegramSubscribers = getTelegramSubscribers();
  if (!isTelegramConfigured() || telegramSubscribers.length === 0 || !globalCurfewSettings.enabled) {
    return {
      isCurfewActive: false,
      sent: false,
      message: !isTelegramConfigured()
        ? 'Bot Telegram non configuré'
        : telegramSubscribers.length === 0
        ? 'Aucun abonné Telegram actif'
        : 'Couvre-feu désactivé',
    };
  }

  const tgEvaluation = evaluateSubscriberCurfew(globalCurfewSettings, now);
  if (!tgEvaluation.isCurfewActive) {
    return {
      isCurfewActive: false,
      sent: false,
      message: `En attente du couvre-feu (${tgEvaluation.scheduledTime}).`,
      details: tgEvaluation,
    };
  }

  const { cycleKey, minutesElapsed } = tgEvaluation;
  if (globalCurfewSettings.userConfirmedNightCycle === cycleKey) {
    return {
      isCurfewActive: true,
      sent: false,
      message: `Couvre-feu déjà confirmé pour la nuit (${cycleKey})`,
      details: tgEvaluation,
    };
  }

  const hasTriggeredInCycle =
    globalCurfewSettings.lastPushCycle === cycleKey &&
    typeof globalCurfewSettings.lastPushTimestamp === 'number' &&
    globalCurfewSettings.lastPushTimestamp > 0;

  const intervalMinutes = globalCurfewSettings.repeatIntervalMinutes || 10;
  const intervalMs = intervalMinutes * 60 * 1000;

  let shouldSendTelegram = false;
  let tgText = '';

  if (!hasTriggeredInCycle) {
    shouldSendTelegram = true;
    tgText =
      `🌙 <b>Il est l'heure de lâcher votre téléphone !</b>\n\n` +
      (globalCurfewSettings.customMessage || "Prenez ce temps pour vous déconnecter et reposer votre esprit.") +
      (minutesElapsed > 0 ? `\n\n<i>Couvre-feu actif depuis ${minutesElapsed} min.</i>` : '') +
      `\n\n<i>⚠️ Ce rappel sonnera toutes les ${intervalMinutes} minutes jusqu'à ce que vous confirmiez ci-dessous :</i>`;
  } else {
    const elapsed = Date.now() - (globalCurfewSettings.lastPushTimestamp || 0);
    if (elapsed >= intervalMs) {
      shouldSendTelegram = true;
      tgText =
        `🌙 <b>Rappel (+${minutesElapsed}m) : Lâchez votre téléphone !</b>\n\n` +
        `Votre écran est toujours sollicité. Posez votre appareil pour reposer vos yeux et votre esprit !\n\n` +
        `<i>⚠️ Rappel toutes les ${intervalMinutes} minutes tant que vous n'avez pas confirmé ci-dessous :</i>`;
    }
  }

  if (shouldSendTelegram) {
    console.log(`[Telegram Curfew] Delivering reminder to ${telegramSubscribers.length} subscriber(s)`);
    let sentCount = 0;
    for (const tgSub of telegramSubscribers) {
      const res = await sendTelegramMessage(tgSub.chatId, tgText, {
        withStopButton: true,
        cycleKey,
      });
      if (res.success) sentCount++;
    }
    globalCurfewSettings.lastPushTimestamp = Date.now();
    globalCurfewSettings.lastPushCycle = cycleKey;
    saveCurfewSettings();
    return {
      isCurfewActive: true,
      sent: true,
      message: `Alerte Telegram envoyée à ${sentCount} destinataire(s)`,
      details: tgEvaluation,
    };
  }

  return {
    isCurfewActive: true,
    sent: false,
    message: 'Alerte déjà envoyée récemment pour ce cycle',
    details: tgEvaluation,
  };
}

// -----------------------------------------------------------------------------
// Background Loop (Runs 24/7 on Node.js container)
// -----------------------------------------------------------------------------
setInterval(async () => {
  const now = new Date();

  // 1. Poll Telegram updates (process /start and "J'arrête mon téléphone" button taps)
  if (isTelegramConfigured()) {
    await pollTelegramUpdates((confirmedCycleKey) => {
      const cycle =
        confirmedCycleKey ||
        globalCurfewSettings.lastPushCycle ||
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      globalCurfewSettings.userConfirmedNightCycle = cycle;
      saveCurfewSettings();
      console.log(`[Telegram Curfew] Night cycle ${cycle} confirmed via Telegram button`);
    });
  }

  // 2. Evaluate Curfew notifications
  await evaluateAndSendCurfewAlerts(now);
}, 20000);

// -----------------------------------------------------------------------------
// Express Server Setup
// -----------------------------------------------------------------------------
async function startServer() {
  const app = express();

  app.use(express.json());

  // CORS middleware
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // 1. Curfew Settings API
  app.get('/api/curfew/settings', (_req, res) => {
    res.json({ success: true, settings: globalCurfewSettings });
  });

  app.post('/api/curfew/settings', (req, res) => {
    const { settings } = req.body;
    if (settings) {
      globalCurfewSettings = {
        ...globalCurfewSettings,
        ...settings,
        timezoneOffset:
          typeof settings.timezoneOffset === 'number'
            ? settings.timezoneOffset
            : globalCurfewSettings.timezoneOffset,
      };
      saveCurfewSettings();
      console.log('[Curfew] Synchronized schedule settings with client');
    }
    res.json({ success: true, settings: globalCurfewSettings });
  });

  // 2. Night shutdown confirmation
  app.post('/api/curfew/confirm-night', (req, res) => {
    const { cycleKey } = req.body;
    let targetCycle = cycleKey;
    if (!targetCycle) {
      const now = new Date();
      targetCycle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    globalCurfewSettings.userConfirmedNightCycle = targetCycle;
    saveCurfewSettings();
    console.log(`[Curfew] Night cycle ${targetCycle} confirmed by user`);
    res.json({ success: true, confirmedCycle: targetCycle });
  });

  // 3. Trigger / evaluate curfew manually or via Cron
  const curfewCheckHandler = async (_req: express.Request, res: express.Response) => {
    try {
      const result = await evaluateAndSendCurfewAlerts(new Date());
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Erreur vérification couvre-feu' });
    }
  };
  app.get('/api/curfew/check', curfewCheckHandler);
  app.post('/api/curfew/check', curfewCheckHandler);
  app.get('/api/curfew/cron', curfewCheckHandler);

  // 4. Delayed Test: sends a Telegram notification after delaySeconds (e.g. 10s)
  // This allows the user to lock their screen or close the browser and verify receipt!
  app.post('/api/curfew/delayed-test', (req, res) => {
    const { delaySeconds = 10, chatId } = req.body;
    const subs = getTelegramSubscribers();
    const targetChatId = chatId || (subs.length > 0 ? subs[0].chatId : undefined);

    if (!targetChatId) {
      return res.status(400).json({
        success: false,
        error: 'Aucun Chat ID Telegram disponible. Veuillez valider votre bot d’abord.',
      });
    }

    res.json({
      success: true,
      message: `Alerte programmée dans ${delaySeconds} secondes. Verrouillez votre écran dès maintenant !`,
      delaySeconds,
    });

    setTimeout(async () => {
      console.log(`[Telegram Test] Delivering delayed test notification to ${targetChatId}`);
      await sendTelegramMessage(
        targetChatId,
        `🔔 <b>Test écran verrouillé & site fermé réussi !</b>\n\n` +
          `Ce message Telegram vous prouve que vos rappels fonctionnent parfaitement même lorsque le site est fermé et votre téléphone en veille.\n\n` +
          `À l'heure de votre couvre-feu, votre bot vous préviendra de la même manière.`,
        { withStopButton: true, cycleKey: 'test-cycle' }
      );
    }, Math.max(1, delaySeconds) * 1000);
  });

  // 5. Telegram Subscribers enrollment
  app.post('/api/telegram/subscribers', (req, res) => {
    try {
      const { chatId, name, username } = req.body;
      if (!chatId) {
        return res.status(400).json({ success: false, error: 'Chat ID requis' });
      }
      const subscriber = addOrUpdateSubscriber(String(chatId), name, username);
      console.log(`[Telegram] Enrolled subscriber from client: ${subscriber.name} (${subscriber.chatId})`);
      res.json({ success: true, subscriber });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Erreur enregistrement abonné' });
    }
  });

  // 6. Telegram Bot API endpoints
  app.get('/api/telegram/status', async (_req, res) => {
    try {
      const botInfo = await getBotInfo();
      const subs = getTelegramSubscribers();
      res.json({
        configured: isTelegramConfigured(),
        botUsername: botInfo.username,
        botFirstName: botInfo.firstName,
        subscribersCount: subs.length,
        subscribers: subs.map((s) => ({
          chatId: s.chatId,
          name: s.name,
          username: s.username,
          registeredAt: s.registeredAt,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erreur statut Telegram' });
    }
  });

  app.post('/api/telegram/sync', async (_req, res) => {
    try {
      const result = await pollTelegramUpdates((confirmedCycleKey) => {
        const cycle =
          confirmedCycleKey ||
          globalCurfewSettings.lastPushCycle ||
          `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
        globalCurfewSettings.userConfirmedNightCycle = cycle;
        saveCurfewSettings();
      });
      const botInfo = await getBotInfo();
      const subs = getTelegramSubscribers();
      res.json({
        success: true,
        newSubscribers: result.newSubscribers,
        totalSubscribers: result.totalSubscribers,
        botUsername: botInfo.username,
        botFirstName: botInfo.firstName,
        subscribers: subs.map((s) => ({
          chatId: s.chatId,
          name: s.name,
          username: s.username,
          registeredAt: s.registeredAt,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erreur synchronisation Telegram' });
    }
  });

  app.post('/api/telegram/test', async (req, res) => {
    try {
      const { chatId } = req.body;
      const result = await sendTestTelegramAlert(chatId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Erreur lors du test' });
    }
  });

  app.post('/api/telegram/token', async (req, res) => {
    try {
      const { token } = req.body;
      const result = await setBotToken(token);
      if (result.success) {
        res.json({
          success: true,
          configured: true,
          botUsername: result.botUsername,
          botFirstName: result.botFirstName,
        });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Erreur serveur' });
    }
  });

  app.delete('/api/telegram/token', (_req, res) => {
    const success = removeBotToken();
    res.json({ success, configured: false });
  });

  // 7. Telegram Webhook handler
  const webhookHandler = async (req: express.Request, res: express.Response) => {
    try {
      const update = req.body;
      if (!update) return res.status(200).json({ ok: true });

      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Handle Callback Queries (Button click)
      if (update.callback_query) {
        const cb = update.callback_query;
        const dataStr = String(cb.data || '');
        const chatId = String(cb.message?.chat?.id || cb.from?.id);

        if (dataStr.startsWith('curfew_stop')) {
          const cycleKey = dataStr.split(':')[1] || todayKey;
          globalCurfewSettings.userConfirmedNightCycle = cycleKey;
          saveCurfewSettings();

          await sendTelegramMessage(
            chatId,
            `✨ <b>Bravo ! Téléphone lâché.</b>\n\nDéconnexion confirmée. Les rappels toutes les 5 minutes sont arrêtés pour ce soir. Bonne soirée / bonne nuit ! 🛌`
          );
          return res.status(200).json({ ok: true, action: 'confirmed', cycleKey });
        }
      }

      // Handle Text message stop keywords
      if (update.message?.text) {
        const text = update.message.text.trim().toLowerCase();
        const chatId = String(update.message.chat.id);
        const stopKeywords = ['stop', 'ok', 'lâché', 'lache', 'fait', 'bonne nuit', 'arrête', 'arrete', '/stop'];
        if (stopKeywords.some((k) => text === k || text.includes(k))) {
          globalCurfewSettings.userConfirmedNightCycle = todayKey;
          saveCurfewSettings();

          await sendTelegramMessage(
            chatId,
            `✅ <b>Téléphone lâché noté !</b> Rappels suspendus pour ce soir. Reposez-vous bien ! 🌙`
          );
        }
      }

      res.status(200).json({ ok: true });
    } catch (err: any) {
      console.warn('[Telegram Webhook Error]', err);
      res.status(200).json({ ok: true });
    }
  };

  app.post('/api/telegram/webhook', webhookHandler);
  app.post('/api/telegram-webhook', webhookHandler);

  // Endpoint to register webhook on Telegram API
  app.post('/api/telegram/set-webhook', async (req, res) => {
    try {
      const { webhookUrl } = req.body;
      if (!webhookUrl) {
        return res.status(400).json({ success: false, error: 'URL du webhook requise' });
      }
      const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
      if (!token) {
        return res.status(400).json({ success: false, error: 'Token bot non configuré' });
      }
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const tgData = await tgRes.json();
      res.json({ success: tgData.ok, result: tgData });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Erreur setWebhook' });
    }
  });

  // Health route
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      telegramConfigured: isTelegramConfigured(),
      subscribersCount: getTelegramSubscribers().length,
      serverTime: new Date().toISOString(),
    });
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
