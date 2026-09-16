import React, { useState } from 'react';
import {
  ArrowLeft,
  Flame,
  CheckCircle2,
  Calendar as CalendarIcon,
  Clock,
  Award,
  Sparkles,
  Smile,
  Info,
  ChevronLeft,
  ChevronRight,
  Hourglass,
} from 'lucide-react';
import { UserStats, ThemeMode, DayLog } from '../types';
import { formatFrenchDate, getTodayString } from '../utils/storage';
import { playZenChime, playMinimalClick, triggerHaptic } from '../utils/audio';

interface StreakPageProps {
  stats: UserStats;
  onBack: () => void;
  onToggleToday: (screenHours?: number, reflection?: string) => void;
  theme: ThemeMode;
  soundEnabled: boolean;
}

export const StreakPage: React.FC<StreakPageProps> = ({
  stats,
  onBack,
  onToggleToday,
  theme,
  soundEnabled,
}) => {
  const isLight = theme === 'light';
  const isEink = theme === 'eink';

  const todayStr = getTodayString();
  const todayLog: DayLog | undefined = stats.logs[todayStr];
  const isTodayCompleted = todayLog?.completed ?? false;

  const [reflectionInput, setReflectionInput] = useState(todayLog?.reflection || '');
  const [screenHoursInput, setScreenHoursInput] = useState<number>(todayLog?.screenTimeHours || 1.5);
  const [showReflectionBox, setShowReflectionBox] = useState(false);
  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0);

  const handleValidateToday = () => {
    playZenChime(soundEnabled);
    triggerHaptic(true);
    onToggleToday(screenHoursInput, reflectionInput);
  };

  // Estimated hours saved: average baseline without launcher is ~4.2h/day.
  // With launcher, saved is ~2.5h per logged day.
  const estimatedHoursSaved = Math.round(stats.totalDaysSuccessful * 2.5);

  // Generate calendar days for the current or offset month
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + selectedMonthOffset);
  const currentMonthYear = targetDate.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
  const capitalizedMonthYear =
    currentMonthYear.charAt(0).toUpperCase() + currentMonthYear.slice(1);

  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

  const daysGrid = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysGrid.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateFormatted = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const log = stats.logs[dateFormatted];
    daysGrid.push({
      dayNumber: d,
      dateString: dateFormatted,
      isCompleted: log?.completed ?? false,
      isToday: dateFormatted === todayStr,
      log,
    });
  }

  return (
    <div className="w-full flex flex-col gap-5 pb-8 animate-in fade-in duration-200" id="streak-page-container">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between pt-2 pb-1">
        <button
          onClick={() => {
            playMinimalClick(soundEnabled);
            onBack();
          }}
          id="btn-back-to-home"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            isLight
              ? 'text-neutral-700 hover:bg-neutral-100'
              : isEink
              ? 'text-neutral-900 hover:bg-neutral-300'
              : 'text-neutral-300 hover:bg-neutral-800'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Écran d'accueil</span>
        </button>

        <div
          className={`text-xs font-mono px-2 py-0.5 rounded ${
            isLight
              ? 'bg-neutral-100 text-neutral-600'
              : 'bg-neutral-900 text-neutral-400'
          }`}
        >
          Sobriété Numérique
        </div>
      </div>

      {/* Main Hero Streak Counter Card */}
      <div
        className={`p-5 rounded-2xl border flex flex-col items-center text-center relative overflow-hidden ${
          isLight
            ? 'bg-white border-neutral-200/90 shadow-sm'
            : isEink
            ? 'bg-neutral-200 border-neutral-900 text-neutral-950'
            : 'bg-[#141414] border-neutral-800'
        }`}
        id="card-hero-streak"
      >
        <div
          className={`p-3 rounded-full mb-3 ${
            isLight
              ? 'bg-amber-50 text-amber-600'
              : isEink
              ? 'bg-neutral-900 text-amber-300'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}
        >
          <Flame className="w-8 h-8" />
        </div>

        <span
          className={`text-xs font-semibold uppercase tracking-widest mb-1 ${
            isLight ? 'text-neutral-500' : isEink ? 'text-neutral-700' : 'text-neutral-400'
          }`}
        >
          Série Consécutive
        </span>

        <div className="flex items-baseline gap-1 my-1">
          <span
            className={`font-digital text-6xl sm:text-7xl font-light tracking-tight ${
              isLight ? 'text-neutral-900' : isEink ? 'text-neutral-950 font-medium' : 'text-white'
            }`}
          >
            {stats.currentStreak}
          </span>
          <span className="text-xl font-medium text-neutral-500">
            {stats.currentStreak > 1 ? 'jours' : 'jour'}
          </span>
        </div>

        <p
          className={`text-xs max-w-xs mt-1 ${
            isLight ? 'text-neutral-600' : isEink ? 'text-neutral-700' : 'text-neutral-400'
          }`}
        >
          {stats.currentStreak > 0
            ? 'Félicitations pour votre constance à préserver votre temps et votre attention.'
            : 'Commencez aujourd\'hui en validant votre première journée sobre.'}
        </p>

        {/* Validate Today Action Button */}
        <div className="w-full mt-5">
          <button
            onClick={handleValidateToday}
            id="btn-validate-today"
            className={`w-full py-3.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.985] cursor-pointer shadow-xs ${
              isTodayCompleted
                ? isLight
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                  : 'bg-emerald-950/40 text-emerald-300 border border-emerald-600/40 hover:bg-emerald-900/40'
                : isLight
                ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                : isEink
                ? 'bg-neutral-950 text-white'
                : 'bg-white text-neutral-950 hover:bg-neutral-200'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 ${isTodayCompleted ? 'text-emerald-500' : ''}`} />
            <span>
              {isTodayCompleted
                ? 'Aujourd\'hui validé avec succès (Cliquez pour modifier)'
                : 'Valider ma journée sobre aujourd\'hui'}
            </span>
          </button>
        </div>

        {/* Reflection toggle */}
        <div className="w-full mt-2 flex justify-end">
          <button
            onClick={() => setShowReflectionBox(!showReflectionBox)}
            id="btn-toggle-reflection"
            className={`text-[11px] underline underline-offset-2 transition-colors ${
              isLight ? 'text-neutral-500 hover:text-neutral-800' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {showReflectionBox ? 'Masquer la note' : 'Ajouter une note personnelle'}
          </button>
        </div>

        {showReflectionBox && (
          <div
            className={`w-full mt-3 p-3 rounded-xl border text-left flex flex-col gap-2 ${
              isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-900/90 border-neutral-800'
            }`}
          >
            <label className="text-xs font-medium text-neutral-400">
              Note ou victoire du jour (ex: 45 min de lecture, marche sans écouteurs) :
            </label>
            <textarea
              value={reflectionInput}
              onChange={(e) => setReflectionInput(e.target.value)}
              placeholder="Ex: J'ai lu 30 pages au lieu de scroller..."
              rows={2}
              className={`w-full text-xs p-2 rounded-lg border outline-none resize-none ${
                isLight
                  ? 'bg-white border-neutral-300 text-neutral-900 focus:border-neutral-500'
                  : 'bg-neutral-950 border-neutral-700 text-neutral-100 focus:border-neutral-500'
              }`}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-400">Temps d'écran estimé :</span>
                <input
                  type="number"
                  min="0"
                  max="12"
                  step="0.5"
                  value={screenHoursInput}
                  onChange={(e) => setScreenHoursInput(parseFloat(e.target.value) || 0)}
                  className={`w-14 px-1.5 py-0.5 rounded border text-center font-mono ${
                    isLight ? 'bg-white border-neutral-300 text-neutral-900' : 'bg-neutral-950 border-neutral-700'
                  }`}
                />
                <span className="text-neutral-400">heures</span>
              </div>
              <button
                onClick={handleValidateToday}
                className="text-xs px-2.5 py-1 rounded-md bg-neutral-700 text-white hover:bg-neutral-600"
              >
                Enregistrer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3 Secondary Stats Metrics Cards */}
      <div className="grid grid-cols-3 gap-2.5" id="stats-summary-grid">
        <div
          className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center ${
            isLight
              ? 'bg-white border-neutral-200 shadow-xs'
              : isEink
              ? 'bg-neutral-200 border-neutral-400 text-neutral-950'
              : 'bg-[#141414] border-neutral-800'
          }`}
        >
          <Award className="w-4 h-4 text-amber-500 mb-1" />
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Total</span>
          <span className="font-digital text-xl font-medium mt-0.5">{stats.totalDaysSuccessful}</span>
          <span className="text-[10px] text-neutral-400">jours réussis</span>
        </div>

        <div
          className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center ${
            isLight
              ? 'bg-white border-neutral-200 shadow-xs'
              : isEink
              ? 'bg-neutral-200 border-neutral-400 text-neutral-950'
              : 'bg-[#141414] border-neutral-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-sky-500 mb-1" />
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Record</span>
          <span className="font-digital text-xl font-medium mt-0.5">{stats.longestStreak}</span>
          <span className="text-[10px] text-neutral-400">jours max</span>
        </div>

        <div
          className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center ${
            isLight
              ? 'bg-white border-neutral-200 shadow-xs'
              : isEink
              ? 'bg-neutral-200 border-neutral-400 text-neutral-950'
              : 'bg-[#141414] border-neutral-800'
          }`}
        >
          <Clock className="w-4 h-4 text-emerald-500 mb-1" />
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Gagné</span>
          <span className="font-digital text-xl font-medium mt-0.5">~{estimatedHoursSaved}h</span>
          <span className="text-[10px] text-neutral-400">temps réel</span>
        </div>
      </div>

      {/* Focus minutes banner if user has logged focus sessions */}
      {stats.totalFocusMinutesCompleted && stats.totalFocusMinutesCompleted > 0 ? (
        <div
          className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between text-xs ${
            isLight
              ? 'bg-amber-50 border-amber-200 text-neutral-800'
              : isEink
              ? 'bg-neutral-200 border-neutral-400 text-neutral-950 font-medium'
              : 'bg-neutral-900/80 border-amber-500/20 text-neutral-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Hourglass className="w-4 h-4 text-amber-500" />
            <span>Temps passé en Mode Concentration :</span>
          </div>
          <span className="font-digital font-medium text-amber-400">
            {stats.totalFocusMinutesCompleted} minutes
          </span>
        </div>
      ) : null}

      {/* Calendar Grid of Completed Days */}
      <div
        className={`p-4 rounded-xl border ${
          isLight
            ? 'bg-white border-neutral-200 shadow-xs'
            : isEink
            ? 'bg-neutral-200 border-neutral-400 text-neutral-950'
            : 'bg-[#141414] border-neutral-800'
        }`}
        id="calendar-grid-card"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-neutral-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              {capitalizedMonthYear}
            </h3>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedMonthOffset((prev) => prev - 1)}
              className="p-1 rounded hover:bg-neutral-800/20 text-neutral-400 hover:text-neutral-200"
              title="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedMonthOffset(0)}
              className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-700/40 text-neutral-400 hover:text-neutral-200"
            >
              Aujourd'hui
            </button>
            <button
              onClick={() => setSelectedMonthOffset((prev) => Math.min(0, prev + 1))}
              disabled={selectedMonthOffset >= 0}
              className="p-1 rounded hover:bg-neutral-800/20 text-neutral-400 hover:text-neutral-200 disabled:opacity-30"
              title="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
            <span key={i} className="text-[10px] font-medium text-neutral-500">
              {d}
            </span>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {daysGrid.map((item, idx) => {
            if (!item) {
              return <div key={`empty-${idx}`} className="h-8" />;
            }
            return (
              <div
                key={item.dateString}
                className={`h-8 rounded-lg flex flex-col items-center justify-center text-xs relative transition-all ${
                  item.isCompleted
                    ? isLight
                      ? 'bg-amber-100 text-amber-900 font-semibold'
                      : isEink
                      ? 'bg-neutral-900 text-white font-bold'
                      : 'bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold'
                    : item.isToday
                    ? isLight
                      ? 'border border-dashed border-neutral-400 text-neutral-800'
                      : 'border border-dashed border-neutral-600 text-neutral-300'
                    : isLight
                    ? 'text-neutral-400 hover:bg-neutral-100'
                    : 'text-neutral-600 hover:bg-neutral-900'
                }`}
                title={`${formatFrenchDate(item.dateString)}: ${item.isCompleted ? 'Jour réussi' : 'Non validé'}`}
              >
                <span>{item.dayNumber}</span>
                {item.isCompleted && (
                  <span className="w-1 h-1 rounded-full bg-amber-400 -mt-0.5" />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-neutral-800/40 flex items-center justify-between text-[11px] text-neutral-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-500/30 border border-amber-500/60" />
            <span>Jour de réduction réussi</span>
          </div>
          <span>Premier jour : {formatFrenchDate(stats.firstUsedDate)}</span>
        </div>
      </div>

      {/* Screen Time Reduction Principles & Tips */}
      <div
        className={`p-4 rounded-xl border ${
          isLight
            ? 'bg-neutral-50 border-neutral-200'
            : isEink
            ? 'bg-neutral-200 border-neutral-400 text-neutral-950'
            : 'bg-neutral-900/50 border-neutral-800/80 text-neutral-300'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-neutral-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider">
            3 Astuces Complémentaires Pour Votre Téléphone
          </h4>
        </div>
        <ul className="text-xs space-y-2 text-neutral-400">
          <li className="flex items-start gap-2">
            <span className="font-mono text-neutral-500">01.</span>
            <span>
              <strong className={isLight ? 'text-neutral-800' : 'text-neutral-200'}>
                Niveaux de gris :
              </strong>{' '}
              Passez l'écran de votre iPhone/Android en noir et blanc dans les paramètres d'accessibilité pour tuer le pouvoir addictif des icônes.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono text-neutral-500">02.</span>
            <span>
              <strong className={isLight ? 'text-neutral-800' : 'text-neutral-200'}>
                Écran d'accueil unique :
              </strong>{' '}
              Installez ce site web en raccourci sur votre écran d'accueil et supprimez toutes les autres applications de votre première page.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono text-neutral-500">03.</span>
            <span>
              <strong className={isLight ? 'text-neutral-800' : 'text-neutral-200'}>
                Zone sans téléphone :
              </strong>{' '}
              Ne chargez jamais votre téléphone à côté de votre lit ; préférez un réveil matin classique.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};
