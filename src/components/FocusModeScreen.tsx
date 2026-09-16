import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Sparkles,
  CheckCircle2,
  Wind,
  AlertTriangle,
  BellRing,
  ArrowRight,
  Volume2,
  Hourglass,
} from 'lucide-react';
import { FocusSession, ThemeMode } from '../types';
import {
  playFocusCompleteAlarm,
  triggerFocusCompleteHaptic,
  triggerHaptic,
  playMinimalClick,
} from '../utils/audio';

interface FocusModeScreenProps {
  session: FocusSession;
  onComplete: (durationMinutes: number) => void;
  onCancel: () => void;
  theme: ThemeMode;
  soundEnabled: boolean;
}

const FOCUS_THOUGHTS = [
  "Votre attention est préservée. Posez votre téléphone écran vers le bas.",
  "La créativité émerge quand les distractions s'éteignent.",
  "Chaque minute loin de l'écran renforce votre capacité d'attention.",
  "Ce que vous faites maintenant dans le monde réel a plus de valeur qu'un flux de contenu.",
  "Respirez calmement. Rien d'urgent ne se passe sur vos applications.",
];

export const FocusModeScreen: React.FC<FocusModeScreenProps> = ({
  session,
  onComplete,
  onCancel,
  theme,
  soundEnabled,
}) => {
  const [timeLeftMs, setTimeLeftMs] = useState<number>(() =>
    Math.max(0, session.endTime - Date.now())
  );
  const [isFinished, setIsFinished] = useState<boolean>(() => session.endTime <= Date.now());
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef<number | null>(null);
  const repeatAlarmRef = useRef<number | null>(null);
  const hasTriggeredAlarmRef = useRef(false);

  // Trigger completion alert (audio, haptics, browser notification)
  const triggerCompletionAlert = React.useCallback(() => {
    if (hasTriggeredAlarmRef.current) return;
    hasTriggeredAlarmRef.current = true;

    // 1. Play rich harmonic Tibetan completion chime
    playFocusCompleteAlarm(soundEnabled);

    // 2. Play tactile haptic vibration pattern
    triggerFocusCompleteHaptic(true);

    // 3. Native browser notification if permitted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification("Temps de concentration terminé !", {
          body: `Bravo ! Vos ${session.durationMinutes} minutes de concentration sont achevées. Vous pouvez reprendre vos activités.`,
          icon: "/icon.svg",
        });
      } catch (e) {
        // Notification failed silently
      }
    }

    // 4. Repeat chime every 6 seconds (up to 3 additional times) in case the user was away
    let repeatCount = 0;
    repeatAlarmRef.current = window.setInterval(() => {
      repeatCount++;
      if (repeatCount >= 3) {
        if (repeatAlarmRef.current) clearInterval(repeatAlarmRef.current);
        return;
      }
      playFocusCompleteAlarm(soundEnabled);
      triggerFocusCompleteHaptic(true);
    }, 6000);
  }, [session.durationMinutes, soundEnabled]);

  // Main countdown timer interval
  useEffect(() => {
    if (isFinished) {
      triggerCompletionAlert();
      return;
    }

    const update = () => {
      const remaining = Math.max(0, session.endTime - Date.now());
      setTimeLeftMs(remaining);

      if (remaining <= 0) {
        setIsFinished(true);
        triggerCompletionAlert();
      }
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => {
      clearInterval(timer);
      if (repeatAlarmRef.current) {
        clearInterval(repeatAlarmRef.current);
      }
    };
  }, [session.endTime, isFinished, triggerCompletionAlert]);

  // Clean up repeating alarm on unmount
  useEffect(() => {
    return () => {
      if (repeatAlarmRef.current) {
        clearInterval(repeatAlarmRef.current);
      }
    };
  }, []);

  // Rotate mindful thought every 18 seconds
  useEffect(() => {
    if (isFinished) return;
    const interval = window.setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % FOCUS_THOUGHTS.length);
    }, 18000);
    return () => clearInterval(interval);
  }, [isFinished]);

  const totalDurationMs = session.durationMinutes * 60 * 1000;
  const progressRatio = Math.max(0, Math.min(1, 1 - timeLeftMs / totalDurationMs));

  const totalSeconds = Math.ceil(timeLeftMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');

  const isLight = theme === 'light';
  const isEink = theme === 'eink';

  // Handle intentional 3-second hold to cancel if emergency
  const startHolding = () => {
    setHoldProgress(0);
    const start = Date.now();
    holdIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / 2500) * 100);
      setHoldProgress(pct);

      if (pct >= 100) {
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        playMinimalClick(soundEnabled);
        onCancel();
      }
    }, 50);
  };

  const stopHolding = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldProgress(0);
  };

  const handleResumeActivities = () => {
    if (repeatAlarmRef.current) {
      clearInterval(repeatAlarmRef.current);
    }
    playMinimalClick(soundEnabled);
    triggerHaptic(true);
    onComplete(session.durationMinutes);
  };

  const handleReplayAlarm = () => {
    playFocusCompleteAlarm(soundEnabled);
    triggerFocusCompleteHaptic(true);
  };

  // ==========================================
  // 1. VISUAL & AUDITORY ALERT: SESSION COMPLETE
  // ==========================================
  if (isFinished) {
    return (
      <div
        className="w-full flex-1 flex flex-col items-center justify-between py-6 px-4 text-center animate-in zoom-in-95 fade-in duration-300"
        id="focus-mode-completed-screen"
      >
        {/* Top Alert Badge */}
        <div className="flex flex-col items-center gap-1.5 animate-bounce">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs tracking-wider border font-medium shadow-sm ${
              isLight
                ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                : isEink
                ? 'bg-neutral-900 text-white font-bold'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
            }`}
          >
            <BellRing className="w-3.5 h-3.5 animate-pulse" />
            <span>Alerte : Temps Écoulé !</span>
          </div>
        </div>

        {/* Central Visual Celebration Banner */}
        <div className="my-auto flex flex-col items-center justify-center max-w-sm">
          {/* Pulsing Visual Halo */}
          <div className="relative mb-5 flex items-center justify-center">
            <div
              className={`absolute w-28 h-28 rounded-full animate-ping opacity-30 ${
                isLight ? 'bg-emerald-300' : isEink ? 'bg-neutral-400' : 'bg-emerald-500'
              }`}
            />
            <div
              className={`relative p-5 rounded-full border shadow-xl ${
                isLight
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : isEink
                  ? 'bg-neutral-900 border-neutral-900 text-white'
                  : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400'
              }`}
            >
              <CheckCircle2 className="w-12 h-12" />
            </div>
          </div>

          <h2
            className={`text-2xl font-bold tracking-tight mb-2 ${
              isLight ? 'text-neutral-900' : isEink ? 'text-neutral-950' : 'text-neutral-50'
            }`}
          >
            Session Terminée !
          </h2>

          <p
            className={`text-sm leading-relaxed mb-5 ${
              isLight ? 'text-neutral-600' : isEink ? 'text-neutral-800' : 'text-neutral-300'
            }`}
          >
            Félicitations ! Vous avez préservé{' '}
            <strong className="font-semibold text-emerald-500">
              {session.durationMinutes} minutes
            </strong>{' '}
            de concentration loin de vos écrans. Vous pouvez désormais reprendre vos activités.
          </p>

          {/* Stats Box */}
          <div
            className={`w-full p-3.5 rounded-xl border text-xs flex items-center justify-between mb-2 ${
              isLight
                ? 'bg-neutral-50 border-neutral-200 text-neutral-800'
                : isEink
                ? 'bg-neutral-200 border-neutral-400 text-neutral-950'
                : 'bg-[#141414] border-neutral-800 text-neutral-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span>Temps de concentration comptabilisé</span>
            </div>
            <span className="font-digital font-medium text-emerald-500 text-sm">
              +{session.durationMinutes} min
            </span>
          </div>

          {/* Replay Sound Option */}
          {soundEnabled && (
            <button
              onClick={handleReplayAlarm}
              type="button"
              className={`flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-lg transition-colors cursor-pointer ${
                isLight ? 'text-neutral-500 hover:text-neutral-900' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Faire retentir le carillon</span>
            </button>
          )}
        </div>

        {/* Primary Action Button: Reprendre mes activités */}
        <div className="w-full max-w-sm pt-2">
          <button
            onClick={handleResumeActivities}
            id="btn-resume-activities"
            className={`w-full py-3.5 px-5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.985] cursor-pointer shadow-md ${
              isLight
                ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                : isEink
                ? 'bg-neutral-950 text-white font-bold'
                : 'bg-emerald-500 text-neutral-950 font-bold hover:bg-emerald-400'
            }`}
          >
            <span>Reprendre mes activités</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <span className="text-[11px] text-neutral-500 block mt-2">
            Déverrouille l'accès aux applications
          </span>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. ACTIVE FOCUS LOCK SCREEN
  // ==========================================
  return (
    <div
      className="w-full flex-1 flex flex-col items-center justify-between py-6 px-3 text-center animate-in fade-in duration-300"
      id="focus-mode-active-screen"
    >
      {/* Top lock indicator */}
      <div className="flex flex-col items-center gap-1.5">
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs tracking-wider border font-medium ${
            isLight
              ? 'bg-amber-100/90 border-amber-300 text-amber-900'
              : isEink
              ? 'bg-neutral-900 text-white font-bold'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Mode Concentration Actif</span>
        </div>
        <span
          className={`text-[11px] ${
            isLight ? 'text-neutral-500' : isEink ? 'text-neutral-700' : 'text-neutral-500'
          }`}
        >
          Accès aux autres applications verrouillé
        </span>
      </div>

      {/* Central circular timer display */}
      <div className="relative my-auto flex flex-col items-center justify-center p-6">
        {/* Subtle radial or circular SVG progress ring */}
        <div className="relative w-56 h-56 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="44"
              className={isLight ? 'stroke-neutral-200' : isEink ? 'stroke-neutral-300' : 'stroke-neutral-800'}
              strokeWidth="4"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r="44"
              className={isLight ? 'stroke-amber-600' : isEink ? 'stroke-neutral-900' : 'stroke-amber-400'}
              strokeWidth="4"
              strokeDasharray={276.46}
              strokeDashoffset={276.46 * (1 - progressRatio)}
              strokeLinecap="round"
              fill="transparent"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>

          {/* Time text centered */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className={`font-digital text-5xl font-light tracking-tight ${
                isLight ? 'text-neutral-900' : isEink ? 'text-neutral-950 font-bold' : 'text-neutral-100'
              }`}
            >
              <span>{formattedMinutes}</span>
              <span className="opacity-40 animate-pulse">:</span>
              <span>{formattedSeconds}</span>
            </div>
            <span
              className={`text-xs mt-1 font-medium ${
                isLight ? 'text-neutral-500' : isEink ? 'text-neutral-700' : 'text-neutral-400'
              }`}
            >
              Session {session.durationMinutes} min
            </span>
          </div>
        </div>

        {/* Breathing guide / Mindful quote */}
        <div
          className={`mt-6 max-w-xs p-3 rounded-xl border text-xs leading-relaxed transition-all ${
            isLight
              ? 'bg-neutral-50 border-neutral-200 text-neutral-700'
              : isEink
              ? 'bg-neutral-200 border-neutral-400 text-neutral-900 font-medium'
              : 'bg-[#141414] border-neutral-800 text-neutral-300'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1.5 opacity-60">
            <Wind className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-widest font-semibold">Présence</span>
          </div>
          <p className="italic">"{FOCUS_THOUGHTS[quoteIndex]}"</p>
        </div>
      </div>

      {/* Bottom emergency break option with intentional friction */}
      <div className="w-full max-w-xs flex flex-col items-center gap-2 pt-2">
        {!showCancelConfirm ? (
          <button
            onClick={() => setShowCancelConfirm(true)}
            id="btn-trigger-early-unlock"
            className={`text-xs underline underline-offset-4 transition-colors cursor-pointer ${
              isLight ? 'text-neutral-400 hover:text-neutral-700' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Déverrouiller en cas d'urgence
          </button>
        ) : (
          <div
            className={`w-full p-3.5 rounded-xl border flex flex-col items-center gap-2.5 animate-in fade-in ${
              isLight ? 'bg-red-50/80 border-red-200' : 'bg-red-950/20 border-red-900/40'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
              <AlertTriangle className="w-4 h-4" />
              <span>Interrompre la concentration ?</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-snug">
              Pour éviter les clics impulsifs, maintenez le bouton enfoncé pendant 3 secondes :
            </p>

            <button
              onMouseDown={startHolding}
              onMouseUp={stopHolding}
              onMouseLeave={stopHolding}
              onTouchStart={startHolding}
              onTouchEnd={stopHolding}
              id="btn-hold-to-cancel-focus"
              className="relative overflow-hidden w-full py-2.5 px-3 rounded-lg bg-red-600/20 border border-red-500/40 text-red-300 font-medium text-xs select-none active:scale-95 transition cursor-pointer"
            >
              {/* Filling progress bar */}
              <div
                className="absolute inset-0 bg-red-600/60 transition-all pointer-events-none"
                style={{ width: `${holdProgress}%` }}
              />
              <span className="relative z-10">
                {holdProgress > 0 ? `Maintenez... ${Math.round(holdProgress)}%` : 'Maintenir 3s pour déverrouiller'}
              </span>
            </button>

            <button
              onClick={() => setShowCancelConfirm(false)}
              className="text-[11px] text-neutral-400 hover:text-neutral-200 mt-1 cursor-pointer"
            >
              Garder la concentration active
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
