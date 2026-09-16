import React, { useState, useEffect } from 'react';
import {
  AppLauncherItem,
  UserStats,
  UserPreferences,
  ThemeMode,
  FocusSession,
} from './types';
import {
  loadStats,
  saveStats,
  loadPreferences,
  savePreferences,
  toggleDayCompletion,
  loadFocusSession,
  saveFocusSession,
  recordCompletedFocusSession,
} from './utils/storage';
import { playMinimalClick, triggerHaptic } from './utils/audio';
import { launchAppUrl, getPrimaryDeepLink } from './utils/launcher';
import { LAUNCHER_APPS } from './data/apps';
import { ClockHeader } from './components/ClockHeader';
import { AppGrid } from './components/AppGrid';
import { StreakPage } from './components/StreakPage';
import { MindfulModal } from './components/MindfulModal';
import { SettingsModal } from './components/SettingsModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { FocusSetupModal } from './components/FocusSetupModal';
import { FocusModeScreen } from './components/FocusModeScreen';
import { DisconnectReminderModal } from './components/DisconnectReminderModal';
import { CurfewAlertModal } from './components/CurfewAlertModal';
import {
  evaluateDisconnectTrigger,
  triggerDisconnectAlert,
  getScheduledTimeForToday,
  getCurfewCycleKey,
  getCurfewWindowStatus,
  confirmNightShutdownOnServer,
  syncCurfewScheduleWithServer,
  fetchTelegramStatus,
  TelegramStatus,
} from './utils/notifications';
import { playBedtimeChime, triggerBedtimeHaptic } from './utils/audio';
import { Smartphone, Monitor, Moon, Power, ShieldCheck, Send, ChevronRight } from 'lucide-react';

export default function App() {
  const [stats, setStats] = useState<UserStats>(loadStats);
  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences);
  const [currentView, setCurrentView] = useState<'home' | 'streak'>('home');
  const [pendingApp, setPendingApp] = useState<AppLauncherItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFocusSetupOpen, setIsFocusSetupOpen] = useState(false);
  const [isDisconnectReminderOpen, setIsDisconnectReminderOpen] = useState(false);
  const [curfewAlertActive, setCurfewAlertActive] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null);
  const [curfewConfirmedCycle, setCurfewConfirmedCycle] = useState<string | null>(() => {
    try {
      return localStorage.getItem('minimal_launcher_curfew_confirmed_cycle');
    } catch {
      return null;
    }
  });
  const [curfewConfirmedTime, setCurfewConfirmedTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem('minimal_launcher_curfew_confirmed_time');
    } catch {
      return null;
    }
  });
  const [lastTriggerTimestamp, setLastTriggerTimestamp] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem('minimal_launcher_last_trigger_timestamp');
      return stored ? Number(stored) : null;
    } catch {
      return null;
    }
  });
  const [lastTriggerCycle, setLastTriggerCycle] = useState<string | null>(() => {
    try {
      return localStorage.getItem('minimal_launcher_last_trigger_cycle');
    } catch {
      return null;
    }
  });
  const [activeFocusSession, setActiveFocusSession] = useState<FocusSession | null>(loadFocusSession);
  const [desktopPhoneFrame, setDesktopPhoneFrame] = useState(true);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);

  // Sync theme changes to html body background
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (preferences.theme === 'eink') {
      root.className = 'h-full bg-[#d5d3cb] text-[#1a1a1a]';
      body.className = 'h-full bg-[#d5d3cb] text-[#1a1a1a] antialiased select-none';
    } else if (preferences.theme === 'light') {
      root.className = 'h-full bg-[#f6f6f7] text-[#121212]';
      body.className = 'h-full bg-[#f6f6f7] text-[#121212] antialiased select-none';
    } else {
      // OLED / Default dark
      root.className = 'h-full bg-[#0a0a0a] text-[#ededed]';
      body.className = 'h-full bg-[#0a0a0a] text-[#ededed] antialiased select-none';
    }
  }, [preferences.theme]);

  // Periodic checker for the user's disconnect curfew & repeated notifications
  useEffect(() => {
    const checkCurfew = () => {
      if (!preferences.disconnectReminder || !preferences.disconnectReminder.enabled) {
        return;
      }

      // If snoozed and snooze time hasn't passed, do not trigger yet
      if (snoozeUntil && Date.now() < snoozeUntil) {
        return;
      }

      const evaluation = evaluateDisconnectTrigger(
        preferences.disconnectReminder,
        lastTriggerTimestamp,
        lastTriggerCycle,
        curfewConfirmedCycle
      );

      if (evaluation.shouldTrigger) {
        const nowTs = evaluation.triggerTimestamp;
        setLastTriggerTimestamp(nowTs);
        setLastTriggerCycle(evaluation.cycleKey);
        try {
          localStorage.setItem('minimal_launcher_last_trigger_timestamp', String(nowTs));
          localStorage.setItem('minimal_launcher_last_trigger_cycle', evaluation.cycleKey);
        } catch {
          // ignore
        }

        let alertMessage = preferences.disconnectReminder.customMessage;
        if (evaluation.reason === 'repeat_interval' && evaluation.minutesElapsed) {
          alertMessage = `Rappel (+${evaluation.minutesElapsed}m) : Il est l'heure de lâcher votre téléphone. Rendez-vous sur le site et appuyez sur « J'arrête d'utiliser mon téléphone » pour couper les rappels.`;
        } else if (evaluation.reason === 'time_passed' && evaluation.minutesElapsed && evaluation.minutesElapsed > 0) {
          alertMessage = `L'heure limite (${evaluation.scheduledTime}) est passée depuis ${evaluation.minutesElapsed} min. Posez votre téléphone et préservez votre soirée.`;
        }

        // Trigger phone notification, soothing chime and haptics
        triggerDisconnectAlert(
          alertMessage,
          preferences.soundEnabled,
          preferences.hapticsEnabled
        );

        // Also display in-app curfew alert screen
        setCurfewAlertActive(true);
      }
    };

    // Run check immediately on mount or state change
    checkCurfew();

    // Check every 5 seconds so minute transitions and interval boundaries trigger promptly
    const interval = setInterval(checkCurfew, 5000);

    // Also trigger check immediately when tab gains focus or becomes visible
    const handleVisibilityOrFocus = () => {
      checkCurfew();
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // Optional background worker to avoid aggressive background tab throttling
    let worker: Worker | null = null;
    try {
      const blob = new Blob(
        [`setInterval(() => { self.postMessage('tick'); }, 5000);`],
        { type: 'application/javascript' }
      );
      worker = new Worker(URL.createObjectURL(blob));
      worker.onmessage = () => {
        checkCurfew();
      };
    } catch {
      // Inline worker unavailable
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      if (worker) {
        worker.terminate();
      }
    };
  }, [
    preferences.disconnectReminder,
    lastTriggerTimestamp,
    lastTriggerCycle,
    curfewConfirmedCycle,
    snoozeUntil,
    preferences.soundEnabled,
    preferences.hapticsEnabled,
  ]);

  const handleConfirmStopUsingPhone = () => {
    const todaySched = getScheduledTimeForToday(preferences.disconnectReminder);
    const cycleKey = getCurfewCycleKey(new Date(), todaySched.time);
    const timeNow = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setCurfewConfirmedCycle(cycleKey);
    setCurfewConfirmedTime(timeNow);
    try {
      localStorage.setItem('minimal_launcher_curfew_confirmed_cycle', cycleKey);
      localStorage.setItem('minimal_launcher_curfew_confirmed_time', timeNow);
    } catch {
      // ignore
    }
    setCurfewAlertActive(false);
    setSnoozeUntil(null);
    playBedtimeChime(preferences.soundEnabled);
    triggerBedtimeHaptic(true);

    // Also notify server push scheduler that user stopped for the night
    confirmNightShutdownOnServer(cycleKey);
  };

  const handleCancelCurfewConfirmation = () => {
    setCurfewConfirmedCycle(null);
    setCurfewConfirmedTime(null);
    setLastTriggerTimestamp(null);
    setLastTriggerCycle(null);
    try {
      localStorage.removeItem('minimal_launcher_curfew_confirmed_cycle');
      localStorage.removeItem('minimal_launcher_curfew_confirmed_time');
      localStorage.removeItem('minimal_launcher_last_trigger_timestamp');
      localStorage.removeItem('minimal_launcher_last_trigger_cycle');
    } catch {
      // ignore
    }

    // Reset server night shutdown
    confirmNightShutdownOnServer(undefined);
  };

  const handleSnoozeCurfew = (minutes?: number) => {
    const snoozeMin = minutes || preferences.disconnectReminder.repeatIntervalMinutes || 10;
    setSnoozeUntil(Date.now() + snoozeMin * 60 * 1000);
    setCurfewAlertActive(false);
  };

  const handleUpdatePreferences = (newPrefs: UserPreferences) => {
    // If schedule or times changed, reset the last trigger tracker so newly configured times trigger immediately
    const prevReminder = preferences.disconnectReminder;
    const nextReminder = newPrefs.disconnectReminder;
    if (
      prevReminder.time !== nextReminder.time ||
      prevReminder.weekdayTime !== nextReminder.weekdayTime ||
      prevReminder.weekendTime !== nextReminder.weekendTime ||
      prevReminder.scheduleMode !== nextReminder.scheduleMode ||
      prevReminder.repeatIntervalMinutes !== nextReminder.repeatIntervalMinutes ||
      prevReminder.enabled !== nextReminder.enabled
    ) {
      setLastTriggerTimestamp(null);
      setLastTriggerCycle(null);
      try {
        localStorage.removeItem('minimal_launcher_last_trigger_timestamp');
        localStorage.removeItem('minimal_launcher_last_trigger_cycle');
      } catch {
        // ignore
      }
    }
    setPreferences(newPrefs);
    savePreferences(newPrefs);

    // Keep server scheduler updated with new times/settings
    syncCurfewScheduleWithServer(nextReminder);
  };

  // Sync curfew settings and query Telegram status on load/change
  useEffect(() => {
    syncCurfewScheduleWithServer(preferences.disconnectReminder);
    fetchTelegramStatus().then((status) => {
      setTelegramStatus(status);
    });
  }, [preferences.disconnectReminder]);

  const curfewStatus = getCurfewWindowStatus(preferences.disconnectReminder);
  const isCurfewWindowActive = curfewStatus.isCurfewActive;
  const isCurfewConfirmedForNight = curfewConfirmedCycle === curfewStatus.cycleKey;

  const handleResetData = () => {
    localStorage.removeItem('minimal_launcher_stats_v1');
    const fresh = loadStats();
    setStats(fresh);
    setIsSettingsOpen(false);
  };

  const handleSelectApp = (app: AppLauncherItem) => {
    playMinimalClick(preferences.soundEnabled);
    triggerHaptic(preferences.hapticsEnabled);

    if (preferences.intentionalPause) {
      setPendingApp(app);
    } else {
      // Directly launch with priority to device-specific deep link
      const urlToOpen = getPrimaryDeepLink(app) || app.deepLink || app.url;
      const isAppTarget = Boolean(app.deepLink && urlToOpen !== app.url);
      launchAppUrl(urlToOpen, app.url, isAppTarget);
    }
  };

  const handleDirectLaunch = (url: string, fallbackUrl?: string) => {
    const isAppTarget = Boolean(pendingApp?.deepLink && url !== pendingApp.url);
    setPendingApp(null);
    launchAppUrl(url, fallbackUrl, isAppTarget);
  };

  const handleToggleDay = (screenHours?: number, reflection?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const updated = toggleDayCompletion(today, screenHours, reflection);
    setStats(updated);
  };

  const handleStartFocus = (durationMinutes: number) => {
    const now = Date.now();
    const newSession: FocusSession = {
      isActive: true,
      durationMinutes,
      startTime: now,
      endTime: now + durationMinutes * 60 * 1000,
    };
    saveFocusSession(newSession);
    setActiveFocusSession(newSession);
    setIsFocusSetupOpen(false);
    setCurrentView('home');
  };

  const handleCompleteFocus = (durationMinutes: number) => {
    saveFocusSession(null);
    setActiveFocusSession(null);
    const updated = recordCompletedFocusSession(durationMinutes);
    setStats(updated);
  };

  const handleCancelFocus = () => {
    saveFocusSession(null);
    setActiveFocusSession(null);
  };

  const isLight = preferences.theme === 'light';
  const isEink = preferences.theme === 'eink';

  const themeBg = isLight
    ? 'bg-[#f6f6f7]'
    : isEink
    ? 'bg-[#d5d3cb]'
    : 'bg-[#0a0a0a]';

  const containerBg = isLight
    ? 'bg-white/70'
    : isEink
    ? 'bg-[#dedcd4]'
    : 'bg-[#0f0f10]';

  const borderColor = isLight
    ? 'border-neutral-200'
    : isEink
    ? 'border-neutral-400'
    : 'border-neutral-800';

  return (
    <main
      className={`min-h-full w-full flex flex-col items-center justify-center p-0 sm:p-4 md:p-6 transition-colors duration-200 ${themeBg}`}
    >
      {/* Desktop view frame switcher toggle */}
      <div className="hidden sm:flex fixed top-3 right-4 z-40 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border backdrop-blur-md bg-black/40 border-neutral-800 text-neutral-400 shadow-sm">
        <button
          onClick={() => setDesktopPhoneFrame(true)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition ${
            desktopPhoneFrame ? 'bg-neutral-700 text-white' : 'hover:text-neutral-200'
          }`}
          title="Format Téléphone Mobile"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Mobile</span>
        </button>
        <button
          onClick={() => setDesktopPhoneFrame(false)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition ${
            !desktopPhoneFrame ? 'bg-neutral-700 text-white' : 'hover:text-neutral-200'
          }`}
          title="Plein Écran"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Large</span>
        </button>
      </div>

      {/* Main Mobile Launcher Chassis */}
      <div
        className={`w-full transition-all duration-300 flex flex-col ${
          desktopPhoneFrame
            ? 'max-w-[420px] min-h-screen sm:min-h-[780px] sm:max-h-[92vh] sm:rounded-[36px] sm:border-4 sm:shadow-2xl overflow-y-auto sm:my-auto'
            : 'max-w-xl min-h-screen sm:rounded-2xl sm:border p-4'
        } ${containerBg} ${borderColor} relative`}
        style={{
          paddingTop: 'env(safe-area-inset-top, 16px)',
          paddingBottom: 'env(safe-area-inset-bottom, 24px)',
        }}
      >
        {/* Subtle mobile notch speaker indicator on desktop */}
        {desktopPhoneFrame && (
          <div className="hidden sm:flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-20 h-3.5 rounded-full bg-neutral-900/60 border border-neutral-800/40 flex items-center justify-center">
              <div className="w-8 h-1 rounded-full bg-neutral-700/60" />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-between px-4 sm:px-6 py-2">
          {activeFocusSession && activeFocusSession.isActive ? (
            /* Focus Mode Screen: Completely blocks access during countdown, then displays visual & auditory completion alert */
            <FocusModeScreen
              session={activeFocusSession}
              onComplete={handleCompleteFocus}
              onCancel={handleCancelFocus}
              theme={preferences.theme}
              soundEnabled={preferences.soundEnabled}
            />
          ) : currentView === 'home' ? (
            <div className="flex-1 flex flex-col justify-between">
              {/* TOP OF HOME SCREEN: Direct button to stop using phone & cut off notifications */}
              <div className="w-full pt-1 pb-2 shrink-0 animate-in fade-in duration-200" id="section-top-phone-stop">
                {!isCurfewConfirmedForNight ? (
                  <button
                    onClick={handleConfirmStopUsingPhone}
                    id="btn-top-stop-phone-home"
                    className={`w-full p-3 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer shadow-md active:scale-[0.99] ${
                      isCurfewWindowActive
                        ? 'bg-amber-500 border-amber-400 text-black shadow-amber-500/20'
                        : preferences.theme === 'light'
                        ? 'bg-amber-50/90 border-amber-300 text-amber-950 hover:bg-amber-100'
                        : preferences.theme === 'eink'
                        ? 'bg-[#dedcd4] border-neutral-900 text-neutral-950 font-bold'
                        : 'bg-amber-500/15 border-amber-500/35 text-amber-200 hover:bg-amber-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isCurfewWindowActive
                            ? 'bg-black text-amber-400'
                            : preferences.theme === 'light'
                            ? 'bg-amber-200 text-amber-900'
                            : 'bg-amber-500/25 text-amber-300'
                        }`}
                      >
                        <Power className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-bold block leading-tight">
                          J'arrête d'utiliser mon téléphone
                        </span>
                        <span
                          className={`text-[10px] sm:text-[11px] block mt-0.5 ${
                            isCurfewWindowActive
                              ? 'text-black/85 font-medium'
                              : preferences.theme === 'light'
                              ? 'text-amber-800'
                              : 'text-amber-300/80'
                          }`}
                        >
                          {isCurfewWindowActive
                            ? `Couvre-feu en cours (${curfewStatus.scheduledTime}) • Stoppe les rappels`
                            : preferences.disconnectReminder.enabled
                            ? `Rappel prévu à ${curfewStatus.scheduledTime} • Poser et couper les rappels`
                            : 'Coupe les notifications pour ce soir'}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 ml-2">
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold ${
                          isCurfewWindowActive
                            ? 'bg-black text-amber-400'
                            : 'bg-amber-500 text-black'
                        }`}
                      >
                        Arrêter
                      </span>
                    </div>
                  </button>
                ) : (
                  <div
                    className={`w-full py-2 px-3.5 rounded-2xl border flex items-center justify-between text-xs transition-colors shadow-sm ${
                      preferences.theme === 'light'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : preferences.theme === 'eink'
                        ? 'bg-[#dedcd4] border-neutral-900 text-neutral-950'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-left">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-semibold block text-xs">Téléphone posé pour ce soir</span>
                        <span className="text-[10px] opacity-80">
                          {curfewConfirmedTime ? `Validé à ${curfewConfirmedTime} • ` : ''}Notifications coupées jusqu'à demain.
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleCancelCurfewConfirmation}
                      className="text-[10px] font-medium opacity-70 hover:opacity-100 hover:text-amber-400 underline cursor-pointer shrink-0 ml-2 py-1 px-1.5"
                      title="Réactiver si vous devez continuer à utiliser le téléphone"
                    >
                      Réactiver
                    </button>
                  </div>
                )}
              </div>

              {/* Header with Digital Clock & Mindful quote */}
              <ClockHeader
                currentStreak={stats.currentStreak}
                totalDays={stats.totalDaysSuccessful}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenStreak={() => {
                  playMinimalClick(preferences.soundEnabled);
                  setCurrentView('streak');
                }}
                onOpenDisconnectReminder={() => {
                  playMinimalClick(preferences.soundEnabled);
                  setIsDisconnectReminderOpen(true);
                }}
                onOpenWeather={() => {
                  const weatherApp = LAUNCHER_APPS.find((a) => a.id === 'weather');
                  if (weatherApp) {
                    handleSelectApp(weatherApp);
                  }
                }}
                disconnectReminder={preferences.disconnectReminder}
                theme={preferences.theme}
                isCurfewConfirmed={isCurfewConfirmedForNight}
              />

              {/* Notification prompt banner if curfew enabled but Telegram not connected */}
              {preferences.disconnectReminder.enabled && !isCurfewConfirmedForNight && (!telegramStatus?.configured || telegramStatus.subscribersCount === 0) && (
                <div
                  onClick={() => {
                    playMinimalClick(preferences.soundEnabled);
                    setIsDisconnectReminderOpen(true);
                  }}
                  className={`mt-3 mb-1 px-3.5 py-2 rounded-2xl border text-xs flex items-center justify-between gap-2.5 transition-all cursor-pointer shadow-xs ${
                    preferences.theme === 'light'
                      ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100/80'
                      : preferences.theme === 'eink'
                      ? 'bg-[#e4e2da] border-neutral-800 text-neutral-900'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/15'
                  }`}
                  id="banner-enable-offline-notifications"
                >
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-[11px] leading-tight">
                      {!telegramStatus?.configured
                        ? "Connectez votre bot Telegram pour recevoir les alertes site fermé & écran en veille"
                        : "Appuyez sur Démarrer (/start) dans votre bot Telegram pour relier ce téléphone"}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-neutral-950 shrink-0 flex items-center gap-0.5">
                    <span>Relier</span>
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              )}

              {/* Central App Launcher Grid (The apps + Focus button + Streak button) */}
              <AppGrid
                onSelectApp={handleSelectApp}
                onOpenStreakPage={() => {
                  playMinimalClick(preferences.soundEnabled);
                  setCurrentView('streak');
                }}
                onOpenFocusSetup={() => {
                  playMinimalClick(preferences.soundEnabled);
                  setIsFocusSetupOpen(true);
                }}
                theme={preferences.theme}
                currentStreak={stats.currentStreak}
              />

              {/* Bottom PWA home-screen installer & subtle footer */}
              <footer className="mt-6 flex flex-col items-center">
                <PWAInstallBanner theme={preferences.theme} />
                <div className="mt-3 text-[10px] tracking-widest uppercase opacity-40 font-mono">
                  Focus • Moins d'écran, plus de vie
                </div>
              </footer>
            </div>
          ) : (
            /* Dedicated Screen Time Reduction Streak & Days Page */
            <StreakPage
              stats={stats}
              onBack={() => setCurrentView('home')}
              onToggleToday={handleToggleDay}
              theme={preferences.theme}
              soundEnabled={preferences.soundEnabled}
            />
          )}
        </div>

        {/* Focus Mode Setup Modal */}
        <FocusSetupModal
          isOpen={isFocusSetupOpen}
          onClose={() => setIsFocusSetupOpen(false)}
          onStartFocus={handleStartFocus}
          theme={preferences.theme}
          soundEnabled={preferences.soundEnabled}
        />

        {/* Intentional Mindful Pause Modal */}
        <MindfulModal
          app={pendingApp}
          onClose={() => setPendingApp(null)}
          onLaunch={handleDirectLaunch}
          theme={preferences.theme}
          soundEnabled={preferences.soundEnabled}
        />

        {/* Settings and Customization Drawer */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          prefs={preferences}
          onUpdatePrefs={handleUpdatePreferences}
          onResetData={handleResetData}
          onOpenDisconnectReminder={() => setIsDisconnectReminderOpen(true)}
        />

        {/* Disconnect & Curfew Reminder Settings Modal */}
        <DisconnectReminderModal
          isOpen={isDisconnectReminderOpen}
          onClose={() => setIsDisconnectReminderOpen(false)}
          settings={preferences.disconnectReminder}
          onSave={(newSettings) =>
            handleUpdatePreferences({ ...preferences, disconnectReminder: newSettings })
          }
          theme={preferences.theme}
          soundEnabled={preferences.soundEnabled}
        />

        {/* Live Curfew Evening Alert Modal */}
        <CurfewAlertModal
          isOpen={curfewAlertActive}
          timeStr={getScheduledTimeForToday(preferences.disconnectReminder).time}
          message={preferences.disconnectReminder.customMessage}
          onConfirmStop={handleConfirmStopUsingPhone}
          onDismiss={() => setCurfewAlertActive(false)}
          onSnooze={handleSnoozeCurfew}
          theme={preferences.theme}
          soundEnabled={preferences.soundEnabled}
          repeatIntervalMinutes={preferences.disconnectReminder.repeatIntervalMinutes || 10}
        />
      </div>
    </main>
  );
}
