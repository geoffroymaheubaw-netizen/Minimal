import React, { useState } from 'react';
import { X, Lock, Shield, Sparkles, Hourglass, Play } from 'lucide-react';
import { ThemeMode } from '../types';
import { playMinimalClick, playZenChime, triggerHaptic } from '../utils/audio';

interface FocusSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartFocus: (durationMinutes: number) => void;
  theme: ThemeMode;
  soundEnabled: boolean;
}

const PRESET_DURATIONS = [15, 25, 45, 60, 90];

export const FocusSetupModal: React.FC<FocusSetupModalProps> = ({
  isOpen,
  onClose,
  onStartFocus,
  theme,
  soundEnabled,
}) => {
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [customInput, setCustomInput] = useState<number | ''>('');

  if (!isOpen) return null;

  const isLight = theme === 'light';
  const isEink = theme === 'eink';

  const handleStart = () => {
    const finalMinutes = customInput && typeof customInput === 'number' && customInput > 0
      ? customInput
      : selectedMinutes;

    // Proactively request browser notification permission if available
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    playZenChime(soundEnabled);
    triggerHaptic(true);
    onStartFocus(finalMinutes);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      id="modal-focus-setup"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm rounded-2xl p-5 sm:p-6 border flex flex-col gap-4 text-left shadow-2xl ${
          isLight
            ? 'bg-white border-neutral-200 text-neutral-900'
            : isEink
            ? 'bg-neutral-200 border-neutral-900 text-neutral-950'
            : 'bg-[#141414] border-neutral-800 text-neutral-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800/40">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg ${
                isLight ? 'bg-amber-100 text-amber-900' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight">Mode Concentration</h3>
              <p className="text-xs text-neutral-400">Verrouillage temporaire des applications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-800/30 text-neutral-400 hover:text-white cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informative lock warning */}
        <div
          className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
            isLight
              ? 'bg-amber-50/70 border-amber-200 text-amber-900'
              : isEink
              ? 'bg-neutral-300 border-neutral-900 text-neutral-900'
              : 'bg-amber-500/5 border-amber-500/20 text-neutral-300'
          }`}
        >
          <Shield className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p>
            Pendant toute la durée du minuteur, <strong>l'accès à toutes les applications du site sera bloqué</strong> afin de protéger votre concentration.
          </p>
        </div>

        {/* Preset choices */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-2">
            Choisir la durée de la session
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {PRESET_DURATIONS.map((dur) => {
              const isSelected = selectedMinutes === dur && !customInput;
              return (
                <button
                  key={dur}
                  type="button"
                  onClick={() => {
                    playMinimalClick(soundEnabled);
                    setSelectedMinutes(dur);
                    setCustomInput('');
                  }}
                  className={`py-2 px-1 rounded-xl border text-xs font-mono font-medium transition-all cursor-pointer text-center ${
                    isSelected
                      ? isLight
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : isEink
                        ? 'bg-neutral-900 text-white font-bold'
                        : 'bg-amber-500 text-neutral-950 font-bold border-amber-400'
                      : isLight
                      ? 'bg-neutral-100 border-neutral-200 text-neutral-800 hover:bg-neutral-200'
                      : isEink
                      ? 'bg-neutral-300 border-neutral-400 text-neutral-900'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  {dur}m
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom duration input */}
        <div className="flex items-center justify-between text-xs pt-1">
          <span className="text-neutral-400">Ou durée personnalisée :</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              max="240"
              placeholder="Ex: 30"
              value={customInput}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value, 10) : '';
                setCustomInput(val);
              }}
              className={`w-16 px-2 py-1 rounded-lg border text-center font-mono text-xs outline-none ${
                isLight
                  ? 'bg-neutral-100 border-neutral-300 text-neutral-900 focus:border-neutral-500'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-100 focus:border-neutral-500'
              }`}
            />
            <span className="text-neutral-400 font-mono">min</span>
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          id="btn-confirm-start-focus"
          className={`w-full mt-2 py-3.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.985] cursor-pointer shadow-sm ${
            isLight
              ? 'bg-neutral-900 text-white hover:bg-neutral-800'
              : isEink
              ? 'bg-neutral-950 text-white font-bold'
              : 'bg-amber-500 text-neutral-950 font-bold hover:bg-amber-400'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          <span>
            Verrouiller pour{' '}
            {customInput && typeof customInput === 'number' && customInput > 0
              ? customInput
              : selectedMinutes}{' '}
            minutes
          </span>
        </button>
      </div>
    </div>
  );
};
