import type { Request, Response } from 'express';

/**
 * Vercel Serverless Function & Cron Job Handler
 * Executed by Vercel Cron every 5 minutes or called externally (e.g. cron-job.org)
 * to deliver Telegram curfew reminders even when the site and phone are completely closed!
 */
export default async function handler(req: any, res: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const defaultChatId = process.env.TELEGRAM_CHAT_ID?.trim() || '7712575789';

  if (!token) {
    return res.status(200).json({
      success: false,
      message: 'TELEGRAM_BOT_TOKEN non configuré dans les variables d’environnement Vercel',
    });
  }

  // Current time
  const now = new Date();
  // By default, Europe/Paris is UTC+1 in winter and UTC+2 in summer.
  // We can compute Paris local hour
  const parisTimeStr = now.toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const [currentHour, currentMinute] = parisTimeStr.split(':').map(Number);

  // Check if current time matches curfew window (e.g., between 21:30 and 06:00)
  const isNightCurfewTime =
    currentHour > 21 || (currentHour === 21 && currentMinute >= 30) || currentHour < 6;

  // If query specifies ?force=true or if in curfew window
  const isForce = req.query?.force === 'true';

  if (isNightCurfewTime || isForce) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: defaultChatId,
          text:
            `🌙 <b>Il est l'heure de déconnecter</b>\n\n` +
            `Il est ${parisTimeStr}. Votre téléphone devrait être posé pour offrir à votre esprit une nuit sereine et réparatrice.\n\n` +
            `Appuyez sur le bouton ci-dessous pour couper les rappels cette nuit :`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ J'arrête mon téléphone",
                  callback_data: 'curfew_stop',
                },
              ],
            ],
          },
        }),
      });

      const data = await tgRes.json();
      return res.status(200).json({
        success: data.ok,
        delivered: data.ok,
        parisTime: parisTimeStr,
        result: data,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Erreur envoi Telegram',
      });
    }
  }

  return res.status(200).json({
    success: true,
    delivered: false,
    parisTime: parisTimeStr,
    message: `Pas de couvre-feu actuellement (${parisTimeStr}). Fenêtre active de 21h30 à 06h00.`,
  });
}
