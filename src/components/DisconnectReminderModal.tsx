import React, { useState, useEffect } from 'react';
import {
  X,
  Moon,
  Bell,
  Clock,
  Calendar,
  Volume2,
  Smartphone,
  Check,
  AlertCircle,
  Sparkles,
  Sun,
  Coffee,
  CalendarDays,
  Sliders,
  Lock,
  Send,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  Key,
  Trash2,
  Edit2,
  ShieldCheck,
} from 'lucide-react';
import {
  DisconnectReminderSettings,
  DisconnectScheduleMode,
  DaySpecificSchedule,
  ThemeMode,
} from '../types';
import { playMinimalClick } from '../utils/audio';
import {
  DAYS_OF_WEEK,
  DISCONNECT_MESSAGES,
  getNotificationPermissionStatus,
  requestPhoneNotificationPermission,
  triggerDisconnectAlert,
  getScheduledTimeForDay,
  getScheduledTimeForToday,
  fetchTelegramStatus,
  syncTelegramSubscribers,
  testTelegramAlert,
  testDelayedTelegramAlert,
  syncCurfewScheduleWithServer,
  saveTelegramToken,
  deleteTelegramToken,
  addManualTelegramSubscriber,
  triggerAutonomousCronCheck,
  TelegramStatus,
} from '../utils/notifications';

interface DisconnectReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: DisconnectReminderSettings;
  onSave: (newSettings: DisconnectReminderSettings) => void;
  theme: ThemeMode;
  soundEnabled: boolean;
}

export const DisconnectReminderModal: React.FC<DisconnectReminderModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  theme,
  soundEnabled,
}) => {
  // Ensure default fallback structure
  const getNormalizedSettings = (s: DisconnectReminderSettings): DisconnectReminderSettings => ({
    ...s,
    scheduleMode: s.scheduleMode || 'custom_days',
    weekdayTime: s.weekdayTime || '17:10',
    weekendTime: s.weekendTime || '19:40',
    repeatIntervalMinutes: typeof s.repeatIntervalMinutes === 'number' ? s.repeatIntervalMinutes : 5,
    dayTimes: s.dayTimes || {
      1: { enabled: true, time: '17:10' },
      2: { enabled: true, time: '17:10' },
      3: { enabled: true, time: '17:10' },
      4: { enabled: false, time: '17:10' }, // Jeudi désactivé
      5: { enabled: true, time: '17:10' },
      6: { enabled: true, time: '19:40' },
      0: { enabled: true, time: '19:40' },
    },
  });

  const [localSettings, setLocalSettings] = useState<DisconnectReminderSettings>(() =>
    getNormalizedSettings(settings)
  );
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermissionStatus()
  );
  const [countdownTest, setCountdownTest] = useState<number | null>(null);

  // Telegram integration state
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [isSyncingTelegram, setIsSyncingTelegram] = useState<boolean>(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState<boolean>(false);
  const [isTestingCron, setIsTestingCron] = useState<boolean>(false);
  const [telegramFeedback, setTelegramFeedback] = useState<string | null>(null);

  // Bot token direct input state
  const [botTokenInput, setBotTokenInput] = useState<string>('');
  const [isSavingToken, setIsSavingToken] = useState<boolean>(false);
  const [showTokenEditor, setShowTokenEditor] = useState<boolean>(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenSuccess, setTokenSuccess] = useState<string | null>(null);
  const [showBotFatherSteps, setShowBotFatherSteps] = useState<boolean>(false);

  // Manual chat ID input state (for quick direct pairing on phone)
  const [manualChatIdInput, setManualChatIdInput] = useState<string>('');
  const [showManualIdInput, setShowManualIdInput] = useState<boolean>(false);

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      setLocalSettings(getNormalizedSettings(settings));
      setPermissionStatus(getNotificationPermissionStatus());
      setCountdownTest(null);
      setTelegramFeedback(null);

      // Fetch Telegram status
      fetchTelegramStatus().then((status) => {
        setTelegramStatus(status);
      });

      // Synchronize curfew schedule with server
      syncCurfewScheduleWithServer(settings);
    }
  }, [isOpen, settings]);

  // Auto-poll Telegram when user switches back to the tab
  useEffect(() => {
    if (!isOpen) return;

    const handleTabReactivation = () => {
      if (document.visibilityState === 'visible') {
        syncTelegramSubscribers().then((status) => {
          if (status) setTelegramStatus(status);
        });
      }
    };

    document.addEventListener('visibilitychange', handleTabReactivation);
    window.addEventListener('focus', handleTabReactivation);
    return () => {
      document.removeEventListener('visibilitychange', handleTabReactivation);
      window.removeEventListener('focus', handleTabReactivation);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isLight = theme === 'light';
  const isEink = theme === 'eink';
  const activeMode: DisconnectScheduleMode = localSettings.scheduleMode || 'weekdays_weekend';
  const todayDayIndex = new Date().getDay();
  const todaySchedule = getScheduledTimeForToday(localSettings);

  const updateSettings = (updated: DisconnectReminderSettings) => {
    setLocalSettings(updated);
    onSave(updated);
    syncCurfewScheduleWithServer(updated);
  };

  const handleSyncTelegram = async () => {
    playMinimalClick(soundEnabled);
    setIsSyncingTelegram(true);
    setTelegramFeedback(null);
    try {
      const status = await syncTelegramSubscribers();
      setTelegramStatus(status);
      if (status && status.subscribersCount > 0) {
        setTelegramFeedback(
          `Compte Telegram connecté avec succès (${status.subscribers[0].name}) !`
        );
      } else {
        setTelegramFeedback(
          "Aucun message reçu. Avez-vous cliqué sur « Démarrer » (/start) dans le bot Telegram ?"
        );
      }
    } catch {
      setTelegramFeedback("Erreur lors de la synchronisation avec Telegram.");
    } finally {
      setIsSyncingTelegram(false);
    }
  };

  const handleTestTelegramInstant = async () => {
    playMinimalClick(soundEnabled);
    setIsTestingTelegram(true);
    setTelegramFeedback(null);
    try {
      const res = await testTelegramAlert();
      setTelegramFeedback(res.message);
    } catch (err: any) {
      setTelegramFeedback(err?.message || "Erreur lors du test Telegram.");
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleTestDelayedTelegram = async (delaySeconds = 10) => {
    playMinimalClick(soundEnabled);
    setTelegramFeedback(null);
    setCountdownTest(delaySeconds);

    let count = delaySeconds;
    const timer = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(timer);
        setCountdownTest(null);
      } else {
        setCountdownTest(count);
      }
    }, 1000);

    const res = await testDelayedTelegramAlert(delaySeconds);
    if (!res.success) {
      clearInterval(timer);
      setCountdownTest(null);
      setTelegramFeedback(res.message);
    } else {
      setTelegramFeedback(
        `Test programmé dans ${delaySeconds}s ! Verrouillez votre écran ou fermez le navigateur maintenant pour voir le bot sonner.`
      );
    }
  };

  const handleTriggerAutonomousCron = async () => {
    playMinimalClick(soundEnabled);
    setIsTestingCron(true);
    setTelegramFeedback(null);
    try {
      const res = await triggerAutonomousCronCheck(true);
      if (res.success) {
        setTelegramFeedback(
          res.message || 'Exécution du robot autonome réussie ! Message envoyé sur votre Telegram.'
        );
      } else {
        setTelegramFeedback(res.message || 'Erreur lors de l’exécution du robot.');
      }
    } catch (err: any) {
      setTelegramFeedback(err?.message || 'Erreur d’appel');
    } finally {
      setIsTestingCron(false);
    }
  };

  const handleSaveBotToken = async () => {
    const trimmed = botTokenInput.trim();
    if (!trimmed) {
      setTokenError("Veuillez saisir ou coller votre jeton (Token) Telegram.");
      return;
    }
    setIsSavingToken(true);
    setTokenError(null);
    setTokenSuccess(null);
    playMinimalClick(soundEnabled);
    try {
      const res = await saveTelegramToken(trimmed);
      if (res.success) {
        setTokenSuccess(`Bot @${res.botUsername} connecté avec succès !`);
        setBotTokenInput('');
        setShowTokenEditor(false);
        const updated = await fetchTelegramStatus();
        setTelegramStatus(updated);
      } else {
        setTokenError(res.error || "Token invalide ou non reconnu par Telegram.");
      }
    } catch (err: any) {
      setTokenError(err?.message || "Erreur lors de l'enregistrement du token.");
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleRemoveBotToken = async () => {
    playMinimalClick(soundEnabled);
    setIsSavingToken(true);
    try {
      await deleteTelegramToken();
      const updated = await fetchTelegramStatus();
      setTelegramStatus(updated);
      setShowTokenEditor(false);
      setTokenSuccess(null);
      setTokenError(null);
      setTelegramFeedback(null);
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleAddManualChatId = () => {
    const trimmed = manualChatIdInput.trim();
    if (!trimmed) return;
    playMinimalClick(soundEnabled);
    addManualTelegramSubscriber(trimmed, 'Mon Téléphone');
    fetchTelegramStatus().then((s) => {
      setTelegramStatus(s);
      setTelegramFeedback(`Chat ID ${trimmed} associé avec succès !`);
      setManualChatIdInput('');
      setShowManualIdInput(false);
    });
  };

  const handleToggleEnable = () => {
    playMinimalClick(soundEnabled);
    const updated = { ...localSettings, enabled: !localSettings.enabled };
    updateSettings(updated);

    if (updated.enabled && permissionStatus !== 'granted') {
      handleRequestPermission();
    }
  };

  const handleModeChange = (mode: DisconnectScheduleMode) => {
    playMinimalClick(soundEnabled);
    const updated = { ...localSettings, scheduleMode: mode };
    updateSettings(updated);
  };

  const handleUnifiedTimeChange = (newTime: string) => {
    const updated = { ...localSettings, time: newTime };
    updateSettings(updated);
  };

  const handleWeekdayTimeChange = (newTime: string) => {
    const updated = {
      ...localSettings,
      weekdayTime: newTime,
      dayTimes: {
        ...(localSettings.dayTimes || {}),
        1: { enabled: localSettings.dayTimes?.[1]?.enabled ?? true, time: newTime },
        2: { enabled: localSettings.dayTimes?.[2]?.enabled ?? true, time: newTime },
        3: { enabled: localSettings.dayTimes?.[3]?.enabled ?? true, time: newTime },
        4: { enabled: localSettings.dayTimes?.[4]?.enabled ?? true, time: newTime },
        5: { enabled: localSettings.dayTimes?.[5]?.enabled ?? true, time: newTime },
      },
    };
    updateSettings(updated);
  };

  const handleWeekendTimeChange = (newTime: string) => {
    const updated = {
      ...localSettings,
      weekendTime: newTime,
      dayTimes: {
        ...(localSettings.dayTimes || {}),
        6: { enabled: localSettings.dayTimes?.[6]?.enabled ?? true, time: newTime },
        0: { enabled: localSettings.dayTimes?.[0]?.enabled ?? true, time: newTime },
      },
    };
    updateSettings(updated);
  };

  const handleDaySpecificTimeChange = (dayId: number, newTime: string) => {
    const currentDayConfig = localSettings.dayTimes?.[dayId] || { enabled: true, time: '21:30' };
    const updated = {
      ...localSettings,
      dayTimes: {
        ...(localSettings.dayTimes || {}),
        [dayId]: {
          ...currentDayConfig,
          time: newTime,
        },
      },
    };
    updateSettings(updated);
  };

  const handleDaySpecificToggle = (dayId: number) => {
    playMinimalClick(soundEnabled);
    const currentDayConfig = localSettings.dayTimes?.[dayId] || { enabled: true, time: '21:30' };
    const updated = {
      ...localSettings,
      dayTimes: {
        ...(localSettings.dayTimes || {}),
        [dayId]: {
          ...currentDayConfig,
          enabled: !currentDayConfig.enabled,
        },
      },
      days: currentDayConfig.enabled
        ? localSettings.days.filter((d) => d !== dayId)
        : [...localSettings.days, dayId],
    };
    updateSettings(updated);
  };

  const handleToggleDay = (dayId: number) => {
    playMinimalClick(soundEnabled);
    let newDays: number[];
    if (localSettings.days.includes(dayId)) {
      if (localSettings.days.length <= 1) return;
      newDays = localSettings.days.filter((d) => d !== dayId);
    } else {
      newDays = [...localSettings.days, dayId];
    }
    const updated = { ...localSettings, days: newDays };
    updateSettings(updated);
  };

  const handleSelectPresetDays = (type: 'all' | 'weekdays' | 'weekend') => {
    playMinimalClick(soundEnabled);
    let newDays: number[];
    if (type === 'all') {
      newDays = [1, 2, 3, 4, 5, 6, 0];
    } else if (type === 'weekdays') {
      newDays = [1, 2, 3, 4, 5];
    } else {
      newDays = [6, 0];
    }
    const updated = { ...localSettings, days: newDays };
    updateSettings(updated);
  };

  const handleRepeatChange = (interval: number) => {
    playMinimalClick(soundEnabled);
    const updated = { ...localSettings, repeatIntervalMinutes: interval };
    updateSettings(updated);
  };

  const handleRequestPermission = async () => {
    playMinimalClick(soundEnabled);
    const granted = await requestPhoneNotificationPermission();
    setPermissionStatus(granted ? 'granted' : 'denied');
  };

  return (
    <div
      id="disconnect-reminder-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
    >
      <div
        id="disconnect-reminder-modal-card"
        className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-5 border transition-colors ${
          isLight
            ? 'bg-white text-neutral-900 border-neutral-200'
            : isEink
            ? 'bg-neutral-100 text-neutral-900 border-neutral-400'
            : 'bg-neutral-950 text-neutral-100 border-neutral-800'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Couvre-Feu & Déconnexion</h2>
              <p className="text-xs text-neutral-400">
                Alertes automatiques Telegram envoyées même site fermé et écran verrouillé
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              playMinimalClick(soundEnabled);
              onClose();
            }}
            id="btn-close-disconnect-modal"
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Master Switch */}
        <div
          onClick={handleToggleEnable}
          className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition ${
            localSettings.enabled
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
              : 'bg-neutral-900/40 border-neutral-800 text-neutral-400'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                localSettings.enabled
                  ? 'bg-amber-500 text-neutral-950'
                  : 'bg-neutral-800 text-neutral-500'
              }`}
            >
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                {localSettings.enabled ? 'Rappels de couvre-feu activés' : 'Rappels désactivés'}
              </div>
              <div className="text-xs text-neutral-400">
                Aujourd'hui : {todaySchedule.enabled ? `Prévu à ${todaySchedule.time}` : 'Désactivé aujourd’hui'}
              </div>
            </div>
          </div>
          <div
            className={`w-11 h-6 rounded-full p-1 transition-colors flex items-center ${
              localSettings.enabled ? 'bg-amber-500 justify-end' : 'bg-neutral-800 justify-start'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
          </div>
        </div>

        {/* SCHEDULE MODE SELECTOR */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Structure des horaires
          </label>
          <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs">
            <button
              onClick={() => handleModeChange('weekdays_weekend')}
              className={`py-2 px-2 rounded-xl font-medium transition cursor-pointer text-center ${
                activeMode === 'weekdays_weekend'
                  ? 'bg-amber-500 text-neutral-950 font-semibold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Semaine / Week-end
            </button>
            <button
              onClick={() => handleModeChange('custom_days')}
              className={`py-2 px-2 rounded-xl font-medium transition cursor-pointer text-center ${
                activeMode === 'custom_days'
                  ? 'bg-amber-500 text-neutral-950 font-semibold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Jour par jour
            </button>
            <button
              onClick={() => handleModeChange('unified')}
              className={`py-2 px-2 rounded-xl font-medium transition cursor-pointer text-center ${
                activeMode === 'unified'
                  ? 'bg-amber-500 text-neutral-950 font-semibold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Même heure
            </button>
          </div>
        </div>

        {/* SCHEDULE CONTROLS */}
        {activeMode === 'weekdays_weekend' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-300">Semaine (Lun - Ven)</span>
                <Coffee className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <input
                type="time"
                value={localSettings.weekdayTime || '21:30'}
                onChange={(e) => handleWeekdayTimeChange(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-700 text-lg font-mono font-semibold text-center focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-300">Week-end (Sam - Dim)</span>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <input
                type="time"
                value={localSettings.weekendTime || '23:00'}
                onChange={(e) => handleWeekendTimeChange(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-700 text-lg font-mono font-semibold text-center focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>
        )}

        {activeMode === 'custom_days' && (
          <div className="flex flex-col gap-2">
            <div className="text-[11px] text-neutral-400">
              Personnalisez l'heure pour chaque jour de la semaine :
            </div>
            <div className="flex flex-col gap-1.5">
              {DAYS_OF_WEEK.map((d) => {
                const dayConfig = localSettings.dayTimes?.[d.id] || { enabled: true, time: '21:30' };
                return (
                  <div
                    key={d.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                      dayConfig.enabled
                        ? 'bg-neutral-900/70 border-neutral-800 text-white'
                        : 'bg-neutral-950/40 border-neutral-800/40 text-neutral-500 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={dayConfig.enabled}
                        onChange={() => handleDaySpecificToggle(d.id)}
                        className="w-4 h-4 rounded text-amber-500 focus:ring-0 focus:outline-none cursor-pointer"
                      />
                      <span className="font-medium">{d.label}</span>
                    </div>
                    <input
                      type="time"
                      value={dayConfig.time}
                      disabled={!dayConfig.enabled}
                      onChange={(e) => handleDaySpecificTimeChange(d.id, e.target.value)}
                      className="py-1 px-2 rounded-lg bg-neutral-950 border border-neutral-700 text-xs font-mono font-semibold text-center focus:border-amber-400 focus:outline-none disabled:opacity-40"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeMode === 'unified' && (
          <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-300">Heure de couvre-feu unique</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <input
              type="time"
              value={localSettings.time || '21:30'}
              onChange={(e) => handleUnifiedTimeChange(e.target.value)}
              className="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-700 text-2xl font-mono font-semibold text-center focus:border-amber-400 focus:outline-none"
            />
            {/* Active days selector for unified mode */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-800/60">
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span>Jours actifs :</span>
                <div className="flex gap-2 text-[10px]">
                  <button onClick={() => handleSelectPresetDays('all')} className="hover:text-amber-400 underline">Tous</button>
                  <button onClick={() => handleSelectPresetDays('weekdays')} className="hover:text-amber-400 underline">Semaine</button>
                  <button onClick={() => handleSelectPresetDays('weekend')} className="hover:text-amber-400 underline">W-E</button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {DAYS_OF_WEEK.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleToggleDay(d.id)}
                    className={`py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                      localSettings.days.includes(d.id)
                        ? 'bg-amber-500 text-neutral-950 font-semibold'
                        : 'bg-neutral-900 text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {d.short}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* REPEAT INTERVAL SELECTOR */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center justify-between">
            <span>Répétition si l'écran reste allumé</span>
            <span className="text-[11px] text-amber-400 font-normal">
              Toutes les {localSettings.repeatIntervalMinutes || 10} min
            </span>
          </label>
          <div className="grid grid-cols-4 gap-1.5 text-xs">
            {[5, 10, 15, 20].map((interval) => (
              <button
                key={interval}
                onClick={() => handleRepeatChange(interval)}
                className={`py-2 px-2 rounded-xl font-medium transition cursor-pointer text-center ${
                  localSettings.repeatIntervalMinutes === interval
                    ? 'bg-amber-500 text-neutral-950 font-semibold shadow-xs'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
                }`}
              >
                {interval} min
              </button>
            ))}
          </div>
        </div>

        {/* CUSTOM NOTIFICATION MESSAGE */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Message du rappel
          </label>
          <textarea
            value={localSettings.customMessage || ''}
            onChange={(e) => {
              const updated = { ...localSettings, customMessage: e.target.value };
              updateSettings(updated);
            }}
            placeholder="Ex: Il est l'heure de lâcher votre téléphone. Offrez à vos yeux et votre esprit un repos bien mérité."
            rows={2}
            className="w-full p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:border-amber-400 focus:outline-none resize-none"
          />
          <div className="flex flex-wrap gap-1 mt-0.5">
            {DISCONNECT_MESSAGES.map((msg, i) => (
              <button
                key={i}
                onClick={() => {
                  playMinimalClick(soundEnabled);
                  const updated = { ...localSettings, customMessage: msg };
                  updateSettings(updated);
                }}
                className="text-[10px] text-neutral-400 hover:text-amber-400 underline underline-offset-2 transition mr-2 cursor-pointer"
              >
                Modèle #{i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* TELEGRAM BOT NOTIFICATION CARD (EXCLUSIVELY FOCUSES ON CLOSED-SITE BACKGROUND ALERTS) */}
        <div
          className={`p-4 rounded-2xl border text-xs flex flex-col gap-3.5 ${
            isLight
              ? 'bg-neutral-50 border-neutral-200 text-neutral-800'
              : isEink
              ? 'bg-neutral-200 border-neutral-600 text-neutral-900'
              : 'bg-neutral-900/70 border-neutral-800 text-neutral-200'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-xs">Alertes par Bot Telegram (Site fermé & Écran en veille)</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                telegramStatus?.configured && telegramStatus.subscribersCount > 0
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : telegramStatus?.configured
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
              }`}
            >
              {telegramStatus?.configured && telegramStatus.subscribersCount > 0
                ? '✓ Relié & Actif 24h/24'
                : telegramStatus?.configured
                ? 'Action requise (/start)'
                : 'À configurer'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-neutral-300 leading-relaxed flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white font-medium">Fonctionne automatiquement site fermé :</strong> Le serveur évalue votre heure de couvre-feu en arrière-plan et envoie les messages directement sur votre compte Telegram. Votre téléphone sonne et vibre même avec l'écran verrouillé.
            </div>
          </div>

          {/* BOT CONFIGURED & NOT IN EDIT MODE */}
          {telegramStatus?.configured && !showTokenEditor ? (
            <div className="flex flex-col gap-2.5">
              <div className="p-2.5 rounded-xl bg-neutral-950/50 border border-neutral-800 text-[11px] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Bot connecté :</span>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://t.me/${telegramStatus.botUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      @{telegramStatus.botUsername}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60">
                  <span className="text-neutral-400">Appareils enregistrés :</span>
                  <span className="font-semibold text-white">
                    {telegramStatus.subscribersCount > 0
                      ? `${telegramStatus.subscribersCount} destinataire(s)`
                      : 'Aucun pour le moment'}
                  </span>
                </div>

                {telegramStatus.subscribers.length > 0 && (
                  <div className="pt-1 border-t border-neutral-800/60 flex flex-col gap-1">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
                      Destinataires qui recevront les alertes en veille :
                    </span>
                    {telegramStatus.subscribers.map((sub, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[11px] bg-emerald-500/10 text-emerald-300 px-2.5 py-1.5 rounded-lg border border-emerald-500/20"
                      >
                        <div className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="font-medium">{sub.name || 'Utilisateur'}</span>
                          {sub.username && (
                            <span className="text-emerald-400/70 text-[10px]">(@{sub.username})</span>
                          )}
                        </div>
                        <span className="text-[9px] font-mono text-emerald-400/70">ID: {sub.chatId}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-1 border-t border-neutral-800/60 flex items-center justify-between text-[11px]">
                  <button
                    onClick={() => {
                      playMinimalClick(soundEnabled);
                      setShowTokenEditor(true);
                      setTokenError(null);
                      setTokenSuccess(null);
                    }}
                    className="text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Modifier le jeton (token)</span>
                  </button>
                  <button
                    onClick={handleRemoveBotToken}
                    className="text-neutral-500 hover:text-red-400 flex items-center gap-1 cursor-pointer transition"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Dissocier le bot</span>
                  </button>
                </div>
              </div>

              {/* If no subscriber yet, prompt to click link and start */}
              {telegramStatus.subscribersCount === 0 ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex flex-col gap-2.5 text-[11px]">
                  <strong className="text-white font-medium">Liez votre compte Telegram :</strong>
                  <div className="text-neutral-300">
                    1. Touchez le bouton ci-dessous pour ouvrir le bot dans Telegram :
                  </div>

                  <a
                    href={`https://t.me/${telegramStatus.botUsername}?start=minimal`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition text-center shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ouvrir @{telegramStatus.botUsername} sur Telegram</span>
                  </a>

                  <div className="text-neutral-300">
                    2. Dans Telegram, appuyez sur <strong className="text-white">« Démarrer »</strong> (ou tapez <code className="text-amber-300">/start</code>).
                  </div>

                  <button
                    onClick={handleSyncTelegram}
                    disabled={isSyncingTelegram}
                    className="w-full py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingTelegram ? 'animate-spin' : ''}`} />
                    <span>{isSyncingTelegram ? 'Recherche en cours...' : 'Vérifier la connexion avec Telegram'}</span>
                  </button>

                  <div className="pt-1.5 border-t border-amber-500/20 flex flex-col gap-1.5">
                    <button
                      onClick={() => {
                        playMinimalClick(soundEnabled);
                        setShowManualIdInput((prev) => !prev);
                      }}
                      className="text-[10px] text-amber-400/80 hover:text-amber-300 transition text-left cursor-pointer flex items-center justify-between"
                    >
                      <span>Ou renseigner votre Chat ID manuellement</span>
                      <span>{showManualIdInput ? '▲' : '▼'}</span>
                    </button>

                    {showManualIdInput && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="text"
                          value={manualChatIdInput}
                          onChange={(e) => setManualChatIdInput(e.target.value)}
                          placeholder="Ex : 7712575789"
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-amber-400"
                        />
                        <button
                          onClick={handleAddManualChatId}
                          disabled={!manualChatIdInput.trim()}
                          className="py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-semibold disabled:opacity-50 transition cursor-pointer shrink-0"
                        >
                          Associer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  {/* Schedule summary box */}
                  <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 text-[11px] flex flex-col gap-1 text-neutral-300">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                      Horaires autonomes du bot :
                    </span>
                    <div className="flex items-center justify-between">
                      <span>• Lun, Mar, Mer, Ven :</span>
                      <strong className="text-white font-mono">17h10</strong>
                    </div>
                    <div className="flex items-center justify-between text-neutral-500">
                      <span>• Jeudi :</span>
                      <span className="text-neutral-400 italic">Désactivé (pause)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>• Samedi & Dimanche :</span>
                      <strong className="text-white font-mono">19h40</strong>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60 text-amber-300/90">
                      <span>• Répétition :</span>
                      <strong className="font-mono">Toutes les 5 min</strong>
                    </div>
                    <div className="text-[10px] text-neutral-400 italic pt-0.5">
                      Répète jusqu'à ce que vous cochiez avoir lâché le téléphone.
                    </div>
                  </div>

                  {/* Delayed test button: 10 seconds delay so user can lock screen! */}
                  <button
                    onClick={() => handleTestDelayedTelegram(10)}
                    disabled={countdownTest !== null}
                    id="btn-test-delayed-telegram"
                    className={`w-full py-2.5 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs ${
                      countdownTest !== null
                        ? 'bg-amber-500 text-neutral-950 animate-pulse'
                        : 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>
                      {countdownTest !== null
                        ? `Verrouillez votre écran ! Message dans ${countdownTest}s...`
                        : 'Tester écran verrouillé / site fermé (délai 10s)'}
                    </span>
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={handleTriggerAutonomousCron}
                      disabled={isTestingCron}
                      id="btn-test-curfew-cron"
                      className="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-300 text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isTestingCron ? 'animate-spin' : ''}`} />
                      <span>{isTestingCron ? 'Vérification...' : 'Tester le robot cloud (/cron)'}</span>
                    </button>

                    <button
                      onClick={handleTestTelegramInstant}
                      disabled={isTestingTelegram}
                      id="btn-test-telegram-instant"
                      className="w-full py-2 px-3 rounded-xl border border-neutral-800 hover:border-neutral-700 text-neutral-300 text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isTestingTelegram ? 'Envoi...' : 'Envoyer test immédiat'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TOKEN INPUT */
            <div className="flex flex-col gap-3">
              <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-xs text-amber-400">
                    <Key className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="font-semibold text-white">Jeton (Token) du bot Telegram :</span>
                  </div>
                  {telegramStatus?.configured && (
                    <button
                      onClick={() => {
                        playMinimalClick(soundEnabled);
                        setShowTokenEditor(false);
                        setTokenError(null);
                      }}
                      className="text-[11px] text-neutral-400 hover:text-neutral-200 cursor-pointer"
                    >
                      Annuler
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Collez le jeton d'accès (HTTP API token) fourni par <strong>@BotFather</strong> :
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <input
                      id="telegram-token-input"
                      type="text"
                      value={botTokenInput}
                      onChange={(e) => {
                        setBotTokenInput(e.target.value);
                        if (tokenError) setTokenError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveBotToken();
                        }
                      }}
                      placeholder="Ex : 7839402831:AAFlkmx_48k..."
                      className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-900 border border-neutral-700 focus:border-amber-400 focus:outline-none text-xs text-white placeholder-neutral-500 font-mono"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      onClick={handleSaveBotToken}
                      disabled={isSavingToken || !botTokenInput.trim()}
                      id="btn-save-telegram-token"
                      className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
                    >
                      {isSavingToken ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>{isSavingToken ? 'Vérification...' : 'Valider le token'}</span>
                    </button>
                  </div>
                </div>

                {tokenError && (
                  <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                    <span>{tokenError}</span>
                  </div>
                )}

                {tokenSuccess && (
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                    <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span>{tokenSuccess}</span>
                  </div>
                )}

                {/* Collapsible 1-minute BotFather guide */}
                <div className="pt-2 border-t border-neutral-800/80">
                  <button
                    onClick={() => {
                      playMinimalClick(soundEnabled);
                      setShowBotFatherSteps((prev) => !prev);
                    }}
                    className="w-full flex items-center justify-between text-[11px] text-amber-400 hover:text-amber-300 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Comment créer un bot gratuit sur Telegram ? (1 minute)</span>
                    </div>
                    <span>{showBotFatherSteps ? '▲' : '▼'}</span>
                  </button>

                  {showBotFatherSteps && (
                    <ol className="mt-2.5 list-decimal list-inside space-y-1.5 text-[11px] text-neutral-300 leading-relaxed bg-neutral-900/80 p-3 rounded-xl border border-neutral-800 animate-in fade-in">
                      <li>
                        Ouvrez l'application <strong>Telegram</strong> sur votre téléphone.
                      </li>
                      <li>
                        Recherchez <strong className="text-white">@BotFather</strong> (avec le badge bleu officiel).
                      </li>
                      <li>
                        Envoyez-lui le message <code className="text-amber-400 font-mono">/newbot</code>.
                      </li>
                      <li>
                        Donnez-lui un nom, puis un identifiant se terminant par <em>bot</em> (ex: <span className="text-white">mon_couvrefeu_bot</span>).
                      </li>
                      <li>
                        BotFather vous envoie alors votre <strong>HTTP API token</strong>. Copiez-le et collez-le ici !
                      </li>
                    </ol>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Telegram feedback message */}
          {telegramFeedback && (
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-1.5 animate-in fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>{telegramFeedback}</span>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="pt-2 border-t border-neutral-800/40 flex flex-col gap-2">
          <button
            onClick={() => {
              playMinimalClick(soundEnabled);
              onClose();
            }}
            id="btn-confirm-save-modal"
            className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs text-center transition cursor-pointer"
          >
            Enregistrer et fermer
          </button>
        </div>
      </div>
    </div>
  );
};
