import fs from 'fs';
import path from 'path';

export interface TelegramSubscriber {
  chatId: string;
  name: string;
  username?: string;
  enabled: boolean;
  lastSentTimestamp?: number;
  lastSentCycle?: string;
  registeredAt: number;
}

const TELEGRAM_STORAGE_FILE = path.join(process.cwd(), 'telegram-subscribers.json');
const TELEGRAM_CONFIG_FILE = path.join(process.cwd(), 'telegram-config.json');

let subscribers: Map<string, TelegramSubscriber> = new Map();
let lastUpdateId = 0;
let cachedBotInfo: { username: string; firstName: string } | null = null;
let customBotToken: string | null = null;

// Initialize custom token from disk if exists
try {
  if (fs.existsSync(TELEGRAM_CONFIG_FILE)) {
    const conf = JSON.parse(fs.readFileSync(TELEGRAM_CONFIG_FILE, 'utf-8'));
    if (conf && typeof conf.token === 'string' && conf.token.trim()) {
      customBotToken = conf.token.trim();
      console.log('[Telegram] Loaded custom bot token from telegram-config.json');
    }
  }
} catch (err) {
  console.warn('[Telegram] Could not read telegram-config.json:', err);
}

// Load subscribers from disk
export function loadTelegramSubscribers() {
  try {
    if (fs.existsSync(TELEGRAM_STORAGE_FILE)) {
      const data: TelegramSubscriber[] = JSON.parse(
        fs.readFileSync(TELEGRAM_STORAGE_FILE, 'utf-8')
      );
      subscribers = new Map(data.map((s) => [s.chatId, s]));
      console.log(`[Telegram] Loaded ${subscribers.size} subscribers from disk`);
    }
  } catch (err) {
    console.warn('[Telegram] Could not read telegram-subscribers.json:', err);
  }

  // If TELEGRAM_CHAT_ID is provided via env, ensure it is enrolled
  const envChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (envChatId && !subscribers.has(envChatId)) {
    subscribers.set(envChatId, {
      chatId: envChatId,
      name: 'Utilisateur (Configuré via ENV)',
      enabled: true,
      registeredAt: Date.now(),
    });
    saveTelegramSubscribers();
  }
}

export function saveTelegramSubscribers() {
  try {
    const data = Array.from(subscribers.values());
    fs.writeFileSync(TELEGRAM_STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Telegram] Could not save telegram-subscribers.json:', err);
  }
}

export function addOrUpdateSubscriber(
  chatId: string,
  name = 'Mon Téléphone',
  username?: string
): TelegramSubscriber {
  const existing = subscribers.get(chatId);
  const updated: TelegramSubscriber = {
    chatId,
    name: name || existing?.name || 'Mon Téléphone',
    username: username || existing?.username,
    enabled: true,
    lastSentTimestamp: existing?.lastSentTimestamp,
    lastSentCycle: existing?.lastSentCycle,
    registeredAt: existing?.registeredAt || Date.now(),
  };
  subscribers.set(chatId, updated);
  saveTelegramSubscribers();
  return updated;
}

export function getBotToken(): string | null {
  return customBotToken || process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export function isTelegramConfigured(): boolean {
  return Boolean(getBotToken());
}

/**
 * Update or set bot token directly from UI
 */
export async function setBotToken(rawToken: string): Promise<{
  success: boolean;
  botUsername?: string;
  botFirstName?: string;
  error?: string;
}> {
  const token = (rawToken || '').trim();
  if (!token) {
    return { success: false, error: 'Le token ne peut pas être vide' };
  }

  // Validate format roughly (e.g. 123456789:ABCdef...)
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
    return {
      success: false,
      error: 'Format de token invalide. Il doit ressembler à : 123456789:AAFlkmx_...',
    };
  }

  // Verify against Telegram API
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await res.json()) as any;
    if (!data.ok || !data.result) {
      return {
        success: false,
        error: data.description || 'Token rejeté par l’API Telegram. Vérifiez auprès de @BotFather.',
      };
    }

    const username = data.result.username || '';
    const firstName = data.result.first_name || '';

    customBotToken = token;
    cachedBotInfo = { username, firstName };

    // Save to disk
    try {
      fs.writeFileSync(TELEGRAM_CONFIG_FILE, JSON.stringify({ token, username, firstName, updatedAt: Date.now() }, null, 2), 'utf-8');
    } catch (saveErr) {
      console.warn('[Telegram] Failed to save telegram-config.json:', saveErr);
    }

    console.log(`[Telegram] Bot token saved successfully for @${username}`);
    return {
      success: true,
      botUsername: username,
      botFirstName: firstName,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Erreur de connexion à Telegram: ${err?.message || err}`,
    };
  }
}

/**
 * Remove or reset custom token
 */
export function removeBotToken(): boolean {
  customBotToken = null;
  cachedBotInfo = null;
  try {
    if (fs.existsSync(TELEGRAM_CONFIG_FILE)) {
      fs.unlinkSync(TELEGRAM_CONFIG_FILE);
    }
    return true;
  } catch {
    return false;
  }
}

export function getTelegramSubscribers(): TelegramSubscriber[] {
  return Array.from(subscribers.values()).filter((s) => s.enabled);
}

/**
 * Fetch bot profile details from Telegram API
 */
export async function getBotInfo(): Promise<{
  configured: boolean;
  username: string | null;
  firstName: string | null;
}> {
  const token = getBotToken();
  if (!token) {
    return { configured: false, username: null, firstName: null };
  }

  if (cachedBotInfo) {
    return {
      configured: true,
      username: cachedBotInfo.username,
      firstName: cachedBotInfo.firstName,
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await res.json()) as any;
    if (data.ok && data.result) {
      cachedBotInfo = {
        username: data.result.username || '',
        firstName: data.result.first_name || '',
      };
      return {
        configured: true,
        username: cachedBotInfo.username,
        firstName: cachedBotInfo.firstName,
      };
    }
  } catch (err) {
    console.warn('[Telegram] getMe failed:', err);
  }

  return { configured: true, username: null, firstName: null };
}

/**
 * Send a message to a specific Telegram chat
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options?: {
    withStopButton?: boolean;
    cycleKey?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const token = getBotToken();
  if (!token) {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN manquant dans les réglages' };
  }

  const payload: any = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  if (options?.withStopButton) {
    payload.reply_markup = {
      inline_keyboard: [
        [
          {
            text: "✅ J'ai lâché mon téléphone",
            callback_data: `curfew_stop:${options.cycleKey || ''}`,
          },
        ],
      ],
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as any;
    if (data.ok) {
      return { success: true };
    } else {
      console.warn(`[Telegram Error] for ${chatId}:`, data.description);
      return { success: false, error: data.description || 'Erreur Telegram API' };
    }
  } catch (err: any) {
    console.error(`[Telegram Network Error] for ${chatId}:`, err);
    return { success: false, error: err?.message || 'Erreur réseau vers Telegram' };
  }
}

/**
 * Answer callback queries (button taps) in Telegram
 */
async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const token = getBotToken();
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || 'Action enregistrée',
      }),
    });
  } catch (err) {
    console.warn('[Telegram] answerCallbackQuery failed:', err);
  }
}

/**
 * Poll Telegram updates to discover users who pressed /start or clicked inline buttons
 */
export async function pollTelegramUpdates(
  onCurfewStopConfirmed?: (cycleKey?: string) => void
): Promise<{ newSubscribers: number; totalSubscribers: number }> {
  const token = getBotToken();
  if (!token) return { newSubscribers: 0, totalSubscribers: subscribers.size };

  let newSubscribersCount = 0;

  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&limit=30`;
    const res = await fetch(url);
    const data = (await res.json()) as any;

    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        if (typeof update.update_id === 'number') {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
        }

        // 1. Handle incoming chat messages (e.g. /start)
        if (update.message && update.message.chat) {
          const chat = update.message.chat;
          const from = update.message.from || {};
          const chatId = String(chat.id);
          const name = from.first_name || chat.first_name || 'Utilisateur';
          const username = from.username || chat.username;
          const text = (update.message.text || '').trim();

          const isNew = !subscribers.has(chatId);
          if (isNew) {
            subscribers.set(chatId, {
              chatId,
              name,
              username,
              enabled: true,
              registeredAt: Date.now(),
            });
            saveTelegramSubscribers();
            newSubscribersCount++;
            console.log(`[Telegram] Registered new subscriber: ${name} (ID: ${chatId})`);

            // Send welcoming confirmation
            await sendTelegramMessage(
              chatId,
              `🌙 <b>Minimal Launcher : Bot connecté avec succès !</b>\n\n` +
                `Bonjour <b>${name}</b>, votre compte Telegram est désormais relié à votre lanceur minimaliste.\n\n` +
                `✨ <b>Avantages de cette connexion :</b>\n` +
                `• Vos rappels de déconnexion sonneront et feront vibrer votre téléphone avec certitude, même avec l'écran verrouillé.\n` +
                `• Vous pourrez couper les rappels de la nuit en 1 clic directement depuis Telegram sans avoir à rouvrir le site.`
            );
          } else if (text === '/start' || text.toLowerCase() === 'test') {
            // Acknowledge re-start
            await sendTelegramMessage(
              chatId,
              `🌙 <b>Minimal Launcher</b>\n\nVotre bot est opérationnel. Vos rappels de déconnexion programmés vous seront envoyés ici.`
            );
          } else {
            const lower = text.toLowerCase();
            const stopKeywords = ['stop', 'ok', 'lâché', 'lache', 'fait', 'bonne nuit', 'arrête', 'arrete'];
            if (stopKeywords.some((k) => lower === k || lower.includes(k))) {
              await sendTelegramMessage(
                chatId,
                `✨ <b>Téléphone lâché noté !</b> Vos rappels de déconnexion sont suspendus pour la nuit. Reposez-vous bien ! 🌙`
              );
              if (onCurfewStopConfirmed) {
                onCurfewStopConfirmed();
              }
            }
          }
        }

        // 2. Handle button clicks (callback query)
        if (update.callback_query) {
          const cb = update.callback_query;
          const chatId = String(cb.message?.chat?.id || cb.from?.id);
          const dataStr = String(cb.data || '');

          if (dataStr.startsWith('curfew_stop')) {
            const cycleKey = dataStr.split(':')[1] || undefined;
            await answerCallbackQuery(cb.id, "Bravo ! Déconnexion confirmée 🌙");

            // Edit message to remove button and indicate confirmation
            if (cb.message?.message_id) {
              try {
                await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: chatId,
                    message_id: cb.message.message_id,
                    text: `✅ <b>Téléphone lâché !</b>\nDéconnexion confirmée. Les rappels de 5 min sont arrêtés pour ce soir. Bonne nuit ! 🛌`,
                    parse_mode: 'HTML',
                  }),
                });
              } catch {}
            }

            await sendTelegramMessage(
              chatId,
              `✨ <b>Bravo pour ce choix !</b>\n\nVotre confirmation a bien été prise en compte. Vos rappels toutes les 5 minutes sont désactivés jusqu'à la prochaine plage programmée. Reposez-vous bien ! 🛌`
            );

            if (onCurfewStopConfirmed) {
              onCurfewStopConfirmed(cycleKey);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Telegram] pollTelegramUpdates error:', err);
  }

  return { newSubscribers: newSubscribersCount, totalSubscribers: subscribers.size };
}

/**
 * Send test alert to all or specific Telegram subscriber
 */
export async function sendTestTelegramAlert(
  targetChatId?: string
): Promise<{ success: boolean; message: string }> {
  const token = getBotToken();
  if (!token) {
    return {
      success: false,
      message:
        'Le jeton TELEGRAM_BOT_TOKEN n’est pas configuré. Veuillez l’ajouter dans les Secrets de l’application.',
    };
  }

  // Poll first to ensure any recent /start is processed
  await pollTelegramUpdates();

  const recipients = targetChatId
    ? subscribers.has(targetChatId)
      ? [subscribers.get(targetChatId)!]
      : [{ chatId: targetChatId, name: 'Utilisateur', enabled: true, registeredAt: Date.now() }]
    : getTelegramSubscribers();

  if (recipients.length === 0) {
    return {
      success: false,
      message:
        'Aucun compte Telegram n’est encore relié. Ouvrez le bot Telegram et appuyez sur « Démarrer » (/start).',
    };
  }

  let sentCount = 0;
  for (const recipient of recipients) {
    const res = await sendTelegramMessage(
      recipient.chatId,
      `🔔 <b>Test de notification Minimal Launcher</b>\n\n` +
        `Votre bot Telegram fonctionne à merveille ! Vos rappels de déconnexion et de couvre-feu vous préviendront avec sonnerie et vibreur garantis, même lorsque votre téléphone est en veille ou verrouillé.\n\n` +
        `<i>Essayez d'appuyer sur le bouton ci-dessous pour tester l'arrêt des rappels :</i>`,
      { withStopButton: true, cycleKey: 'test-cycle' }
    );
    if (res.success) {
      sentCount++;
    }
  }

  if (sentCount > 0) {
    return {
      success: true,
      message: `Notification envoyée avec succès sur Telegram (${sentCount} compte(s) contacté(s)) !`,
    };
  }

  return {
    success: false,
    message: 'Impossible de délivrer le message sur Telegram. Vérifiez le chat ID ou le bot token.',
  };
}

// Initial load
loadTelegramSubscribers();
