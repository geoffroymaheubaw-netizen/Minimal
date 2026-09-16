import { DisconnectReminderSettings } from '../types';
import { playBedtimeChime, triggerBedtimeHaptic } from './audio';

export const DAYS_OF_WEEK = [
  { id: 1, short: 'Lun', label: 'Lundi', isWeekend: false },
  { id: 2, short: 'Mar', label: 'Mardi', isWeekend: false },
  { id: 3, short: 'Mer', label: 'Mercredi', isWeekend: false },
  { id: 4, short: 'Jeu', label: 'Jeudi', isWeekend: false },
  { id: 5, short: 'Ven', label: 'Vendredi', isWeekend: false },
  { id: 6, short: 'Sam', label: 'Samedi', isWeekend: true },
  { id: 0, short: 'Dim', label: 'Dimanche', isWeekend: true },
];

export const DISCONNECT_MESSAGES = [
  "Il est l'heure de lâcher votre téléphone. Offrez à vos yeux et votre esprit un repos bien mérité.",
  "Déconnexion conseillée : posez votre écran et savourez une soirée sereine sans notifications.",
  "Sobriété numérique : place au calme, à la lecture ou au sommeil. Éteignez l'écran.",
  "Moins d'écran, plus de vie : déconnectez maintenant pour recharger votre propre énergie.",
];

/**
 * Registers the lightweight Service Worker for offline PWA caching
 */
export function registerNotificationServiceWorker(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('Service Worker active:', reg.scope);
        })
        .catch((err) => {
          console.warn('Service Worker registration skipped:', err);
        });
    } catch {
      // ignore
    }
  }
}

/**
 * Informs server that user confirmed stopping phone usage for the night
 */
export async function confirmNightShutdownOnServer(cycleKey?: string): Promise<boolean> {
  try {
    const res = await fetch('/api/curfew/confirm-night', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleKey }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Checks if browser notifications are supported and returns status
 */
export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Requests phone/browser permission for notifications
 */
export async function requestPhoneNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.warn('Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Sends a native notification to the phone shade / lockscreen when the site is open in background
 */
export async function sendPhoneNotification(
  title: string,
  options: {
    body: string;
    icon?: string;
    tag?: string;
    vibrate?: number[];
  }
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notificationOptions = {
      body: options.body,
      icon: options.icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: options.tag || 'disconnect-curfew',
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: options.vibrate || [250, 150, 250, 150, 350],
    };

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title, notificationOptions);
          return true;
        }
      } catch {
        // Fallback to Notification constructor
      }
    }

    new Notification(title, notificationOptions);
    return true;
  } catch (error) {
    console.warn('Failed to send phone notification:', error);
    return false;
  }
}

/**
 * Triggers in-app bedtime chimes, vibration, and native notifications
 * Supports both:
 * triggerDisconnectAlert(message, soundEnabled?, hapticsEnabled?, title?)
 * triggerDisconnectAlert(title, message, options?)
 */
export async function triggerDisconnectAlert(
  firstArg: string,
  secondArg?: string | boolean,
  thirdArg?: { soundEnabled?: boolean; cycleKey?: string; onConfirmedNight?: () => void } | boolean
): Promise<void> {
  let title = '🌙 Lâchez votre téléphone';
  let message = firstArg;
  let sound = true;
  let haptics = true;

  if (typeof secondArg === 'string') {
    title = firstArg;
    message = secondArg;
    if (typeof thirdArg === 'object' && thirdArg !== null) {
      sound = thirdArg.soundEnabled !== false;
    }
  } else {
    message = firstArg;
    if (typeof secondArg === 'boolean') {
      sound = secondArg;
    }
    if (typeof thirdArg === 'boolean') {
      haptics = thirdArg;
    }
  }

  if (sound) {
    playBedtimeChime();
  }

  if (haptics) {
    triggerBedtimeHaptic();
  }

  await sendPhoneNotification(title, {
    body: message,
    tag: 'disconnect-curfew',
  });

  // Also send direct Telegram alert if configured
  sendTelegramCurfewAlertDirect(message).catch(() => {});
}

/**
 * Schedule resolution helper for days
 */
export function getScheduledTimeForDay(
  settings: DisconnectReminderSettings,
  dayIndex: number
): { enabled: boolean; time: string } {
  const mode = settings.scheduleMode || 'weekdays_weekend';

  if (mode === 'custom_days' && settings.dayTimes && settings.dayTimes[dayIndex]) {
    return {
      enabled: settings.dayTimes[dayIndex].enabled,
      time: settings.dayTimes[dayIndex].time || settings.time || '21:30',
    };
  }

  if (mode === 'weekdays_weekend') {
    const isWeekend = dayIndex === 0 || dayIndex === 6;
    const isDayActive = settings.days.includes(dayIndex);
    const targetTime = isWeekend
      ? settings.weekendTime || '23:00'
      : settings.weekdayTime || '21:30';

    return {
      enabled: isDayActive,
      time: targetTime,
    };
  }

  return {
    enabled: settings.days.includes(dayIndex),
    time: settings.time || '21:30',
  };
}

export function getScheduledTimeForToday(
  settings: DisconnectReminderSettings,
  date: Date = new Date()
): { enabled: boolean; time: string } {
  const currentDay = date.getDay();
  return getScheduledTimeForDay(settings, currentDay);
}

export function getCurfewCycleKey(date: Date = new Date(), targetTimeStr?: string): string {
  const d = new Date(date);
  const [h] = (targetTimeStr || '21:30').split(':').map(Number);
  if (h >= 12 && d.getHours() < 6) {
    d.setDate(d.getDate() - 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurfewWindowStatus(
  settings: DisconnectReminderSettings,
  now: Date = new Date()
): {
  isCurfewActive: boolean;
  scheduledTime: string;
  targetDate: Date;
  minutesElapsed: number;
  cycleKey: string;
} {
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  // 1. Check yesterday's late curfew if current hour is before 6 AM
  if (currentHour < 6) {
    const yesterdayDay = (currentDay + 6) % 7;
    const yesterdaySchedule = getScheduledTimeForDay(settings, yesterdayDay);

    if (yesterdaySchedule.enabled) {
      const [yH, yM] = yesterdaySchedule.time.split(':').map(Number);
      if (yH >= 12) {
        const yesterdayTarget = new Date(now);
        yesterdayTarget.setDate(yesterdayTarget.getDate() - 1);
        yesterdayTarget.setHours(yH, yM, 0, 0);

        const diffMs = now.getTime() - yesterdayTarget.getTime();
        const minutesElapsed = Math.floor(diffMs / (60 * 1000));
        const cycleKey = getCurfewCycleKey(now, yesterdaySchedule.time);

        if (diffMs >= 0 && diffMs <= 10 * 3600 * 1000) {
          return {
            isCurfewActive: settings.enabled,
            scheduledTime: yesterdaySchedule.time,
            targetDate: yesterdayTarget,
            minutesElapsed,
            cycleKey,
          };
        }
      }
    }
  }

  // 2. Today's schedule
  const todaySchedule = getScheduledTimeForToday(settings, now);
  const cycleKey = getCurfewCycleKey(now, todaySchedule.time);

  if (!settings.enabled || !todaySchedule.enabled) {
    return {
      isCurfewActive: false,
      scheduledTime: todaySchedule.time,
      targetDate: new Date(),
      minutesElapsed: 0,
      cycleKey,
    };
  }

  const [tH, tM] = todaySchedule.time.split(':').map(Number);
  const targetDate = new Date(now);
  targetDate.setHours(tH, tM, 0, 0);

  const diffMs = now.getTime() - targetDate.getTime();
  const minutesElapsed = Math.floor(diffMs / (60 * 1000));
  const isCurfewActive = diffMs >= 0 && diffMs <= 10 * 3600 * 1000;

  return {
    isCurfewActive,
    scheduledTime: todaySchedule.time,
    targetDate,
    minutesElapsed,
    cycleKey,
  };
}

export interface DisconnectEvaluation {
  shouldTrigger: boolean;
  isInitialCurfew: boolean;
  isRepeatReminder: boolean;
  minutesPastCurfew: number;
  minutesElapsed: number;
  scheduledTime: string;
  cycleKey: string;
  triggerTimestamp: number;
  nextAllowedTimestamp: number;
  reason?: 'initial' | 'repeat_interval' | 'time_passed';
}

export function evaluateDisconnectTrigger(
  settings: DisconnectReminderSettings,
  lastAlertTimestamp: number | null = 0,
  lastAlertCycleKey: string | null = '',
  confirmedNightCycle: string | null = null,
  now: Date = new Date()
): DisconnectEvaluation {
  const windowStatus = getCurfewWindowStatus(settings, now);
  const { isCurfewActive, scheduledTime, minutesElapsed, cycleKey } = windowStatus;

  if (!isCurfewActive) {
    return {
      shouldTrigger: false,
      isInitialCurfew: false,
      isRepeatReminder: false,
      minutesPastCurfew: 0,
      minutesElapsed: 0,
      scheduledTime,
      cycleKey,
      triggerTimestamp: 0,
      nextAllowedTimestamp: 0,
    };
  }

  const effectiveConfirmedCycle = confirmedNightCycle || settings.userConfirmedNightCycle;
  if (effectiveConfirmedCycle === cycleKey) {
    return {
      shouldTrigger: false,
      isInitialCurfew: false,
      isRepeatReminder: false,
      minutesPastCurfew: minutesElapsed,
      minutesElapsed,
      scheduledTime,
      cycleKey,
      triggerTimestamp: 0,
      nextAllowedTimestamp: 0,
    };
  }

  const hasTriggeredInCycle =
    lastAlertCycleKey === cycleKey &&
    typeof lastAlertTimestamp === 'number' &&
    lastAlertTimestamp > 0;

  if (!hasTriggeredInCycle) {
    return {
      shouldTrigger: true,
      isInitialCurfew: true,
      isRepeatReminder: false,
      minutesPastCurfew: minutesElapsed,
      minutesElapsed,
      scheduledTime,
      cycleKey,
      triggerTimestamp: now.getTime(),
      nextAllowedTimestamp: now.getTime(),
      reason: minutesElapsed > 5 ? 'time_passed' : 'initial',
    };
  }

  const intervalMinutes = settings.repeatIntervalMinutes || 10;
  const intervalMs = intervalMinutes * 60 * 1000;
  const elapsedSinceLastAlert = now.getTime() - (lastAlertTimestamp || 0);

  if (elapsedSinceLastAlert >= intervalMs) {
    return {
      shouldTrigger: true,
      isInitialCurfew: false,
      isRepeatReminder: true,
      minutesPastCurfew: minutesElapsed,
      minutesElapsed,
      scheduledTime,
      cycleKey,
      triggerTimestamp: now.getTime(),
      nextAllowedTimestamp: now.getTime(),
      reason: 'repeat_interval',
    };
  }

  return {
    shouldTrigger: false,
    isInitialCurfew: false,
    isRepeatReminder: false,
    minutesPastCurfew: minutesElapsed,
    minutesElapsed,
    scheduledTime,
    cycleKey,
    triggerTimestamp: 0,
    nextAllowedTimestamp: (lastAlertTimestamp || 0) + intervalMs,
  };
}

// -----------------------------------------------------------------------------
// Telegram Bot Notification Helpers
// -----------------------------------------------------------------------------
export interface TelegramSubscriberItem {
  chatId: string;
  name: string;
  username?: string;
  registeredAt: number;
}

export interface TelegramStatus {
  configured: boolean;
  botUsername: string | null;
  botFirstName: string | null;
  subscribersCount: number;
  subscribers: TelegramSubscriberItem[];
}

export interface LocalTelegramConfig {
  token: string;
  botUsername: string;
  botFirstName: string;
  subscribers: TelegramSubscriberItem[];
  lastUpdateId?: number;
}

const LOCAL_TELEGRAM_KEY = 'minimal_launcher_telegram_config';

export function getLocalTelegramConfig(): LocalTelegramConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_TELEGRAM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === 'string' && parsed.token.trim()) {
      return {
        token: parsed.token.trim(),
        botUsername: parsed.botUsername || '',
        botFirstName: parsed.botFirstName || 'Bot Telegram',
        subscribers: Array.isArray(parsed.subscribers) ? parsed.subscribers : [],
        lastUpdateId: typeof parsed.lastUpdateId === 'number' ? parsed.lastUpdateId : 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveLocalTelegramConfig(conf: LocalTelegramConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_TELEGRAM_KEY, JSON.stringify(conf));
  } catch (err) {
    console.warn('Could not save telegram config to localStorage:', err);
  }
}

/**
 * Check if a Telegram bot is configured and get registered accounts
 */
export async function fetchTelegramStatus(): Promise<TelegramStatus | null> {
  const local = getLocalTelegramConfig();

  // Query server status
  let serverStatus: TelegramStatus | null = null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const res = await fetch('/api/telegram/status', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      serverStatus = (await res.json()) as TelegramStatus;
    }
  } catch {
    // Non-blocking
  }

  if (local && local.token) {
    const subscribersMap = new Map<string, TelegramSubscriberItem>();
    local.subscribers.forEach((s) => subscribersMap.set(s.chatId, s));
    if (serverStatus?.subscribers) {
      serverStatus.subscribers.forEach((s) => {
        if (!subscribersMap.has(s.chatId)) {
          subscribersMap.set(s.chatId, s);
        }
      });
    }

    const mergedSubs = Array.from(subscribersMap.values());
    if (mergedSubs.length !== local.subscribers.length) {
      local.subscribers = mergedSubs;
      saveLocalTelegramConfig(local);
    }

    return {
      configured: true,
      botUsername: local.botUsername || serverStatus?.botUsername || null,
      botFirstName: local.botFirstName || serverStatus?.botFirstName || 'Bot Telegram',
      subscribersCount: mergedSubs.length,
      subscribers: mergedSubs,
    };
  }

  if (serverStatus && serverStatus.configured) {
    return serverStatus;
  }

  return {
    configured: false,
    botUsername: null,
    botFirstName: null,
    subscribersCount: 0,
    subscribers: [],
  };
}

/**
 * Poll Telegram to link new users who pressed /start or clicked inline buttons
 */
export async function syncTelegramSubscribers(): Promise<TelegramStatus | null> {
  const local = getLocalTelegramConfig();

  // 1. Direct browser sync with Telegram
  if (local && local.token) {
    try {
      const offset = (local.lastUpdateId || 0) + 1;
      const res = await fetch(
        `https://api.telegram.org/bot${local.token}/getUpdates?offset=${offset}&timeout=2`
      );
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        const subscribersMap = new Map<string, TelegramSubscriberItem>();
        local.subscribers.forEach((s) => subscribersMap.set(s.chatId, s));

        let maxUpdateId = local.lastUpdateId || 0;
        let newFound = 0;

        for (const update of data.result) {
          if (typeof update.update_id === 'number') {
            maxUpdateId = Math.max(maxUpdateId, update.update_id);
          }

          const chat = update.message?.chat || update.callback_query?.message?.chat;
          const from = update.message?.from || update.callback_query?.from;

          if (chat && chat.id) {
            const chatId = String(chat.id);
            if (!subscribersMap.has(chatId)) {
              const name = from?.first_name || chat.first_name || 'Utilisateur';
              const username = from?.username || chat.username;
              subscribersMap.set(chatId, {
                chatId,
                name,
                username,
                registeredAt: Date.now(),
              });
              newFound++;

              // Enroll on server
              fetch('/api/telegram/subscribers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId, name, username }),
              }).catch(() => {});
            }
          }
        }

        local.lastUpdateId = maxUpdateId;
        local.subscribers = Array.from(subscribersMap.values());
        saveLocalTelegramConfig(local);
        console.log(`[Telegram Direct Sync] Found ${newFound} new subscriber(s)`);
      }
    } catch (err) {
      console.warn('[Telegram Direct Sync] Warning:', err);
    }
  }

  // 2. Query server sync
  try {
    const res = await fetch('/api/telegram/sync', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // Non-blocking
  }

  return fetchTelegramStatus();
}

/**
 * Manually register a Telegram Chat ID
 */
export function addManualTelegramSubscriber(
  chatId: string,
  name: string = 'Mon Téléphone'
): TelegramStatus | null {
  const cleanId = (chatId || '').trim();
  if (!cleanId) return null;

  const local = getLocalTelegramConfig();
  if (local) {
    const subs = local.subscribers || [];
    if (!subs.some((s) => s.chatId === cleanId)) {
      subs.push({
        chatId: cleanId,
        name: name.trim() || 'Mon Téléphone',
        registeredAt: Date.now(),
      });
      local.subscribers = subs;
      saveLocalTelegramConfig(local);
    }
  }

  // Also push to server
  fetch('/api/telegram/subscribers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: cleanId, name }),
  }).catch(() => {});

  return getLocalTelegramConfig() as any;
}

/**
 * Send an immediate test notification to Telegram
 */
export async function testTelegramAlert(
  chatId?: string
): Promise<{ success: boolean; message: string }> {
  const local = getLocalTelegramConfig();

  // Try server first
  try {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data;
    }
  } catch {
    // Fallback to client-side direct dispatch
  }

  if (local && local.token) {
    const targetChat =
      chatId || (local.subscribers.length > 0 ? local.subscribers[0].chatId : undefined);
    if (!targetChat) {
      return {
        success: false,
        message: 'Aucun compte Telegram connecté. Ouvrez le bot et appuyez sur Démarrer (/start).',
      };
    }

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${local.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChat,
          text:
            `🔔 <b>Test de notification Minimal Launcher</b>\n\n` +
            `Votre bot Telegram fonctionne à merveille ! Vos rappels de déconnexion et de couvre-feu vous préviendront avec sonnerie et vibreur garantis, même lorsque votre téléphone est en veille ou verrouillé.\n\n` +
            `<i>Ce canal fonctionne sans dépendre de votre navigateur.</i>`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ J'arrête mon téléphone",
                  callback_data: 'curfew_stop:test',
                },
              ],
            ],
          },
        }),
      });

      const data = await tgRes.json();
      if (data.ok) {
        return { success: true, message: 'Notification envoyée avec succès sur votre Telegram !' };
      }
      return { success: false, message: data.description || 'Erreur API Telegram' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Erreur réseau vers Telegram' };
    }
  }

  return {
    success: false,
    message: 'Bot Telegram non configuré. Veuillez renseigner le token du bot.',
  };
}

/**
 * Sends a Telegram test with a countdown delay (e.g. 10s)
 * Allows the user to close the browser / lock their screen and witness the notification!
 */
export async function testDelayedTelegramAlert(
  delaySeconds = 10,
  chatId?: string
): Promise<{ success: boolean; message: string }> {
  // 1. Send to server so the server dispatches after delay even if the tab is killed!
  try {
    const res = await fetch('/api/curfew/delayed-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delaySeconds, chatId }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        message:
          data.message ||
          `Alerte programmée dans ${delaySeconds}s ! Verrouillez votre écran dès maintenant.`,
      };
    }
  } catch {
    // Non-blocking
  }

  // 2. Client timer fallback
  const local = getLocalTelegramConfig();
  if (local && local.token) {
    const targetChat =
      chatId || (local.subscribers.length > 0 ? local.subscribers[0].chatId : undefined);
    if (targetChat) {
      setTimeout(async () => {
        try {
          await fetch(`https://api.telegram.org/bot${local.token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: targetChat,
              text:
                `🔔 <b>Test écran verrouillé & site fermé réussi !</b>\n\n` +
                `Votre bot Telegram vous contacte avec succès. À l'heure de votre couvre-feu, vos alertes sonneront ici.`,
              parse_mode: 'HTML',
            }),
          });
        } catch {}
      }, delaySeconds * 1000);

      return {
        success: true,
        message: `Alerte programmée dans ${delaySeconds}s ! Verrouillez votre écran dès maintenant.`,
      };
    }
  }

  return { success: false, message: 'Aucun compte Telegram disponible pour le test.' };
}

/**
 * Triggers a manual or cron curfew check on the server
 */
export async function triggerCurfewCheckOnServer(): Promise<{ success: boolean; result?: any }> {
  try {
    const res = await fetch('/api/curfew/check');
    if (res.ok) {
      const data = await res.json();
      return { success: true, result: data.result };
    }
  } catch {}
  return { success: false };
}

/**
 * Direct Telegram alert sender (for in-app curfew triggers)
 */
export async function sendTelegramCurfewAlertDirect(message: string): Promise<boolean> {
  const local = getLocalTelegramConfig();
  if (!local || !local.token || !local.subscribers || local.subscribers.length === 0) {
    return false;
  }

  try {
    for (const sub of local.subscribers) {
      await fetch(`https://api.telegram.org/bot${local.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: sub.chatId,
          text:
            `🌙 <b>Il est l'heure de déconnecter</b>\n\n` +
            message +
            `\n\n<i>⚠️ Ce rappel sonnera toutes les 5 minutes jusqu'à ce que vous appuyiez ci-dessous :</i>`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ J'ai lâché mon téléphone",
                  callback_data: 'curfew_stop',
                },
              ],
            ],
          },
        }),
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Triggers the autonomous cron check (/api/curfew-cron)
 */
export async function triggerAutonomousCronCheck(
  force: boolean = false
): Promise<{ success: boolean; data?: any; message?: string }> {
  try {
    const res = await fetch(`/api/curfew-cron${force ? '?force=true' : ''}`);
    const data = await res.json();
    return {
      success: data.success ?? true,
      data,
      message: data.message || (data.delivered ? 'Alerte transmise avec succès' : 'Vérification effectuée'),
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Impossible de joindre /api/curfew-cron',
    };
  }
}

/**
 * Save Telegram bot token entered by user directly in the UI
 */
export async function saveTelegramToken(
  rawToken: string
): Promise<{ success: boolean; botUsername?: string; botFirstName?: string; error?: string }> {
  const token = (rawToken || '').trim();
  if (!token) {
    return { success: false, error: 'Le token ne peut pas être vide' };
  }

  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
    return {
      success: false,
      error: 'Format de token invalide. Il doit ressembler à : 123456789:AAFlkmx_...',
    };
  }

  // 1. Direct validation with Telegram API
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();

    if (!data.ok || !data.result) {
      return {
        success: false,
        error: data.description || 'Token rejeté par l’API Telegram. Vérifiez auprès de @BotFather.',
      };
    }

    const username = data.result.username || '';
    const firstName = data.result.first_name || 'Bot Telegram';

    const existing = getLocalTelegramConfig();
    const newConfig: LocalTelegramConfig = {
      token,
      botUsername: username,
      botFirstName: firstName,
      subscribers: existing?.token === token ? existing.subscribers : (existing?.subscribers || []),
      lastUpdateId: existing?.token === token ? existing.lastUpdateId : 0,
    };

    // If Geoffroy's bot and no subscriber yet, pre-link Geoffroy's chat ID
    if (username.toLowerCase().includes('geoffroy') && newConfig.subscribers.length === 0) {
      newConfig.subscribers.push({
        chatId: '7712575789',
        name: 'Geoffroy',
        username: 'Gang_gang_bitchass_nigeria',
        registeredAt: Date.now(),
      });
    }

    saveLocalTelegramConfig(newConfig);

    // Auto-detect subscribers immediately if messages exist
    try {
      const updatesRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=20`);
      const updatesData = await updatesRes.json();
      if (updatesData.ok && Array.isArray(updatesData.result)) {
        const subsMap = new Map<string, TelegramSubscriberItem>();
        newConfig.subscribers.forEach((s) => subsMap.set(s.chatId, s));

        for (const u of updatesData.result) {
          const chat = u.message?.chat || u.callback_query?.message?.chat;
          const from = u.message?.from || u.callback_query?.from;
          if (chat && chat.id) {
            const chatId = String(chat.id);
            if (!subsMap.has(chatId)) {
              subsMap.set(chatId, {
                chatId,
                name: from?.first_name || chat.first_name || 'Utilisateur',
                username: from?.username || chat.username,
                registeredAt: Date.now(),
              });
            }
          }
        }
        newConfig.subscribers = Array.from(subsMap.values());
        saveLocalTelegramConfig(newConfig);
      }
    } catch {
      // Non-blocking
    }

    // Sync token & subscribers to server
    fetch('/api/telegram/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => {});

    for (const sub of newConfig.subscribers) {
      fetch('/api/telegram/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      }).catch(() => {});
    }

    return {
      success: true,
      botUsername: username,
      botFirstName: firstName,
    };
  } catch (directErr: any) {
    // If direct browser request was blocked, try server fallback
    try {
      const res = await fetch('/api/telegram/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      return data;
    } catch {
      return {
        success: false,
        error: `Impossible de joindre Telegram: ${directErr?.message || 'Erreur réseau'}. Vérifiez votre connexion internet.`,
      };
    }
  }
}

/**
 * Remove Telegram bot token
 */
export async function deleteTelegramToken(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCAL_TELEGRAM_KEY);
  }
  try {
    await fetch('/api/telegram/token', { method: 'DELETE' });
  } catch {}
  return true;
}

/**
 * Syncs the curfew schedule and timezone offset with the server
 * so background dispatch runs at the exact local time even when the phone/site is closed!
 */
export async function syncCurfewScheduleWithServer(
  settings: DisconnectReminderSettings
): Promise<boolean> {
  try {
    const timezoneOffset = new Date().getTimezoneOffset();
    const res = await fetch('/api/curfew/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          enabled: settings.enabled,
          time: settings.time,
          weekdayTime: settings.weekdayTime,
          weekendTime: settings.weekendTime,
          scheduleMode: settings.scheduleMode,
          dayTimes: settings.dayTimes,
          days: settings.days,
          repeatIntervalMinutes: settings.repeatIntervalMinutes,
          customMessage: settings.customMessage,
          timezoneOffset,
        },
      }),
    });

    // Also sync local telegram subscribers if any exist
    const local = getLocalTelegramConfig();
    if (local?.subscribers && local.subscribers.length > 0) {
      for (const sub of local.subscribers) {
        fetch('/api/telegram/subscribers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub),
        }).catch(() => {});
      }
    }

    return res.ok;
  } catch {
    return false;
  }
}
