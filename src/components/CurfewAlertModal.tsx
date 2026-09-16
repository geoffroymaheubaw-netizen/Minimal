import React from 'react';
import { Moon, Power, Clock, Check, X, ShieldCheck } from 'lucide-react';
import { ThemeMode } from '../types';
import { playMinimalClick, playBedtimeChime, triggerBedtimeHaptic } from '../utils/audio';

interface CurfewAlertModalProps {
  isOpen: boolean;
  timeStr: string;
  message: string;
  onConfirmStop: () => void;
  onDismiss: () => void;
  onSnooze: (minutes: number) => void;
  theme: ThemeMode;
  soundEnabled: boolean;
  repeatIntervalMinutes?: number;
}

export const CurfewAlertModal: React.FC<CurfewAlertModalProps> = ({
  isOpen,
  timeStr,
  message,
  onConfirmStop,
  onDismiss,
  onSnooze,
  theme,
  soundEnabled,
  repeatIntervalMinutes = 10,
}) => {
  if (!isOpen) return null;

  const isLight = theme === 'light';
  const isEink = theme === 'eink';

  const handleConfirm = () => {
    playBedtimeChime(soundEnabled);
    triggerBedtimeHaptic(true);
    onConfirmStop();
  };

  const handleSnooze = () => {
    playMinimalClick(soundEnabled);
    onSnooze(repeatIntervalMinutes);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
      id="modal-curfew-alert"
    >
      <div
        className={`w-full max-w-sm rounded-3xl p-6 border flex flex-col items-center text-center shadow-2xl relative ${
          isLight
            ? 'bg-white border-neutral-200 text-neutral-900'
            : isEink
            ? 'bg-[#dedcd4] border-neutral-900 text-neutral-950'
            : 'bg-[#121213] border-neutral-800 text-neutral-100'
        }`}
      >
        {/* Close/Minimize button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/40 transition cursor-pointer"
          title="Réduire"
          aria-label="Réduire"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Soft pulsing moon icon */}
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-all ${
            isLight
              ? 'bg-amber-100 text-amber-600'
              : isEink
              ? 'bg-neutral-300 text-neutral-900'
              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
          }`}
        >
          <Moon className="w-8 h-8 animate-pulse" />
        </div>

        <span className="text-[11px] font-semibold uppercase tracking-widest text-amber-500 mb-1">
          Couvre-feu actif ({timeStr})
        </span>

        <h3 className="text-xl font-semibold tracking-tight mb-2">
          Il est l'heure de lâcher votre téléphone
        </h3>

        <p
          className={`text-xs mb-5 max-w-xs leading-relaxed ${
            isLight ? 'text-neutral-600' : isEink ? 'text-neutral-700' : 'text-neutral-300'
          }`}
        >
          {message ||
            "Vous avez atteint votre heure de déconnexion. Les notifications continueront d'arriver jusqu'à ce que vous confirmiez avoir posé votre téléphone."}
        </p>

        {/* Action buttons */}
        <div className="w-full flex flex-col gap-2.5">
          {/* Main confirmation button */}
          <button
            onClick={handleConfirm}
            id="btn-curfew-confirm-stop-phone"
            className={`w-full py-3.5 px-4 rounded-2xl font-semibold text-xs flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer shadow-lg hover:scale-[1.01] active:scale-[0.99] ${
              isLight
                ? 'bg-amber-500 text-black hover:bg-amber-400'
                : isEink
                ? 'bg-neutral-900 text-white font-bold'
                : 'bg-amber-500 text-black hover:bg-amber-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <Power className="w-4 h-4 shrink-0" />
              <span className="text-sm font-bold">J'arrête d'utiliser mon téléphone</span>
            </div>
            <span className="text-[10px] opacity-80 font-normal">
              Stoppe immédiatement les notifications pour ce soir
            </span>
          </button>

          <button
            onClick={handleSnooze}
            id="btn-curfew-snooze"
            className={`w-full py-2.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isLight
                ? 'border border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                : isEink
                ? 'border border-neutral-400 text-neutral-800'
                : 'border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Reporter de {repeatIntervalMinutes} minutes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
