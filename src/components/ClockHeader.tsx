import React, { useState, useEffect } from 'react';
import { Sparkles, Settings as SettingsIcon, Flame, Moon, Check } from 'lucide-react';
import { MINDFUL_QUOTES } from '../data/apps';
import { ThemeMode, DisconnectReminderSettings } from '../types';
import { getScheduledTimeForToday } from '../utils/notifications';

interface ClockHeaderProps {
  currentStreak: number;
  totalDays: number;
  onOpenSettings: () => void;
  onOpenStreak: () => void;
  onOpenDisconnectReminder: () => void;
  onOpenWeather?: () => void;
  disconnectReminder: DisconnectReminderSettings;
  theme: ThemeMode;
  isCurfewConfirmed?: boolean;
}

// Calcule l'indice de la citation quotidienne de manière déterministe pour chaque jour de l'année
export const getDailyQuoteIndex = (date: Date = new Date()): number => {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const dailyOffset = (dayOfYear + date.getFullYear()) % MINDFUL_QUOTES.length;
  return Math.abs(dailyOffset);
};

export const ClockHeader: React.FC<ClockHeaderProps> = ({
  currentStreak,
  totalDays,
  onOpenSettings,
  onOpenStreak,
  onOpenDisconnectReminder,
  onOpenWeather,
  disconnectReminder,
  theme,
  isCurfewConfirmed = false,
}) => {
  const [time, setTime] = useState({ hours: '12', minutes: '00', seconds: '00' });
  const [dateStr, setDateStr] = useState('');
  const [quoteIndex, setQuoteIndex] = useState(() => getDailyQuoteIndex(new Date()));
  const lastDayRef = React.useRef(new Date().toDateString());

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime({
        hours: String(now.getHours()).padStart(2, '0'),
        minutes: String(now.getMinutes()).padStart(2, '0'),
        seconds: String(now.getSeconds()).padStart(2, '0'),
      });

      const formatted = now.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      // Capitalize first letter
      setDateStr(formatted.charAt(0).toUpperCase() + formatted.slice(1));

      // Vérifie si le jour a changé (passage de minuit ou reprise) pour actualiser la citation
      const todayKey = now.toDateString();
      if (todayKey !== lastDayRef.current) {
        lastDayRef.current = todayKey;
        setQuoteIndex(getDailyQuoteIndex(now));
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const cycleQuote = () => {
    setQuoteIndex((prev) => (prev + 1) % MINDFUL_QUOTES.length);
  };

  const isEink = theme === 'eink';
  const isLight = theme === 'light';
  const todaySchedule = getScheduledTimeForToday(disconnectReminder);

  return (
    <header className="w-full pt-4 pb-6 px-1 flex flex-col items-center select-none" id="header-clock">
      {/* Top utility row: Status / Streak quick badge & Settings */}
      <div className="w-full flex items-center justify-between text-xs tracking-wider mb-6">
        <button
          onClick={onOpenStreak}
          id="btn-quick-streak-badge"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
            currentStreak > 0
              ? isLight
                ? 'bg-neutral-100 border-neutral-300 text-neutral-800'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300'
              : 'border-dashed border-neutral-700 text-neutral-500'
          }`}
          title="Voir le suivi des jours"
        >
          <Flame className={`w-3.5 h-3.5 ${currentStreak > 0 ? 'text-amber-500 fill-amber-500/20' : 'text-neutral-500'}`} />
          <span className="font-medium">{currentStreak} {currentStreak > 1 ? 'jours' : 'jour'} de sobriété</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenDisconnectReminder}
            id="btn-quick-disconnect-reminder"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] transition-all cursor-pointer ${
              isCurfewConfirmed
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-medium'
                : disconnectReminder.enabled && todaySchedule.enabled
                ? isLight
                  ? 'bg-amber-50 border-amber-300 text-amber-900 font-medium'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-medium'
                : isLight
                ? 'border-neutral-300 text-neutral-500 hover:text-neutral-700'
                : 'border-neutral-800 text-neutral-500 hover:text-neutral-400'
            }`}
            title={
              isCurfewConfirmed
                ? 'Couvre-feu validé : téléphone posé pour ce soir (notifications coupées)'
                : disconnectReminder.enabled
                ? todaySchedule.enabled
                  ? `Rappels de déconnexion : prévu aujourd'hui à ${todaySchedule.time}`
                  : 'Rappels de déconnexion : en pause aujourd’hui'
                : 'Configurer les rappels de déconnexion'
            }
          >
            {isCurfewConfirmed ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Moon
                className={`w-3 h-3 ${
                  disconnectReminder.enabled && todaySchedule.enabled
                    ? 'text-amber-500 fill-amber-500/20'
                    : 'text-neutral-500'
                }`}
              />
            )}
            <span>
              {isCurfewConfirmed
                ? 'Posé ✓'
                : disconnectReminder.enabled
                ? todaySchedule.enabled
                  ? todaySchedule.time
                  : 'En pause'
                : 'Déconnexion'}
            </span>
          </button>

          <button
            onClick={onOpenSettings}
            id="btn-settings"
            className={`p-1.5 rounded-full transition-colors ${
              isLight ? 'hover:bg-neutral-200 text-neutral-600' : 'hover:bg-neutral-800 text-neutral-400'
            }`}
            aria-label="Paramètres"
            title="Paramètres du launcher"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Large digital time display */}
      <div className="flex flex-col items-center">
        <div
          className={`font-digital text-6xl sm:text-7xl font-light tracking-tight ${
            isLight ? 'text-neutral-900' : isEink ? 'text-neutral-950 font-normal' : 'text-neutral-100'
          }`}
        >
          <span>{time.hours}</span>
          <span className="opacity-40 animate-pulse">:</span>
          <span>{time.minutes}</span>
        </div>

        {/* Date */}
        <div className="mt-1 flex items-center justify-center">
          <p
            className={`text-sm font-medium tracking-wide ${
              isLight ? 'text-neutral-600' : isEink ? 'text-neutral-700' : 'text-neutral-400'
            }`}
          >
            {dateStr}
          </p>
        </div>
      </div>

      {/* Minimalist interactive mindful quote banner */}
      <button
        onClick={cycleQuote}
        id="btn-quote-cycle"
        title="Citation du jour (change automatiquement chaque jour, touchez pour en découvrir d'autres)"
        aria-label="Citation du jour"
        className={`mt-4 px-3.5 py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 max-w-full text-center border cursor-pointer ${
          isLight
            ? 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
            : isEink
            ? 'bg-neutral-200/60 border-neutral-300 text-neutral-800'
            : 'bg-neutral-900/60 border-neutral-800/80 text-neutral-400 hover:text-neutral-300 hover:bg-neutral-900'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5 shrink-0 opacity-70" />
        <span className="italic leading-relaxed">{MINDFUL_QUOTES[quoteIndex]}</span>
      </button>
    </header>
  );
};
