import React from 'react';
import { X, Moon, Sun, Volume2, VolumeX, Shield, Smartphone, RotateCcw, Bell } from 'lucide-react';
import { UserPreferences, ThemeMode } from '../types';
import { playMinimalClick } from '../utils/audio';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefs: UserPreferences;
  onUpdatePrefs: (newPrefs: UserPreferences) => void;
  onResetData: () => void;
  onOpenDisconnectReminder: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  prefs,
  onUpdatePrefs,
  onResetData,
  onOpenDisconnectReminder,
}) => {
  if (!isOpen) return null;

  const isLight = prefs.theme === 'light';
  const isEink = prefs.theme === 'eink';

  const handleThemeChange = (newTheme: ThemeMode) => {
    playMinimalClick(prefs.soundEnabled);
    onUpdatePrefs({ ...prefs, theme: newTheme });
  };

  const handleTogglePause = () => {
    playMinimalClick(prefs.soundEnabled);
    onUpdatePrefs({ ...prefs, intentionalPause: !prefs.intentionalPause });
  };

  const handleToggleSound = () => {
    const nextVal = !prefs.soundEnabled;
    playMinimalClick(nextVal);
    onUpdatePrefs({ ...prefs, soundEnabled: nextVal });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      id="modal-settings"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm rounded-2xl p-5 border flex flex-col gap-4 text-left shadow-2xl ${
          isLight
            ? 'bg-white border-neutral-200 text-neutral-900'
            : isEink
            ? 'bg-neutral-200 border-neutral-900 text-neutral-950'
            : 'bg-[#141414] border-neutral-800 text-neutral-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800/40">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Paramètres</h3>
            <p className="text-xs text-neutral-400">Personnalisation du launcher sobre</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-800/30 text-neutral-400 hover:text-white"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Theme selection */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-2">
            Thème Visuel
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleThemeChange('oled')}
              className={`py-2 px-2.5 rounded-xl border text-xs flex flex-col items-center gap-1.5 transition-all ${
                prefs.theme === 'oled'
                  ? 'bg-neutral-900 border-amber-500 text-white font-medium ring-1 ring-amber-500/50'
                  : 'bg-black/60 border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-black border border-neutral-600" />
              <span>OLED Noir</span>
            </button>

            <button
              onClick={() => handleThemeChange('eink')}
              className={`py-2 px-2.5 rounded-xl border text-xs flex flex-col items-center gap-1.5 transition-all ${
                prefs.theme === 'eink'
                  ? 'bg-neutral-300 border-neutral-900 text-neutral-950 font-bold ring-1 ring-neutral-900'
                  : 'bg-neutral-300/40 border-neutral-400 text-neutral-700'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-neutral-300 border border-neutral-700" />
              <span>Papier E-Ink</span>
            </button>

            <button
              onClick={() => handleThemeChange('light')}
              className={`py-2 px-2.5 rounded-xl border text-xs flex flex-col items-center gap-1.5 transition-all ${
                prefs.theme === 'light'
                  ? 'bg-neutral-100 border-neutral-900 text-neutral-950 font-bold ring-1 ring-neutral-900'
                  : 'bg-white/40 border-neutral-300 text-neutral-600'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white border border-neutral-400" />
              <span>Épuré Blanc</span>
            </button>
          </div>
        </div>

        {/* Intentional Pause toggle */}
        <div className="pt-1 flex items-center justify-between">
          <div className="pr-4">
            <span className="text-xs font-medium block">Pause intentionnelle (3s)</span>
            <span className="text-[11px] text-neutral-400 block">
              Prendre une seconde de recul avant d'ouvrir chaque application.
            </span>
          </div>
          <button
            onClick={handleTogglePause}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              prefs.intentionalPause ? 'bg-amber-500' : 'bg-neutral-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                prefs.intentionalPause ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Audio feedback toggle */}
        <div className="pt-1 flex items-center justify-between">
          <div className="pr-4">
            <span className="text-xs font-medium block">Retour sonore & tactile</span>
            <span className="text-[11px] text-neutral-400 block">
              Clics mécaniques sobres et discrets.
            </span>
          </div>
          <button
            onClick={handleToggleSound}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              prefs.soundEnabled ? 'bg-amber-500' : 'bg-neutral-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                prefs.soundEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Disconnect Reminder (Lâcher le téléphone) */}
        <div className="pt-2 border-t border-neutral-800/40">
          <button
            onClick={() => {
              playMinimalClick(prefs.soundEnabled);
              onClose();
              onOpenDisconnectReminder();
            }}
            id="btn-settings-open-disconnect-reminder"
            className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
              prefs.disconnectReminder?.enabled
                ? isLight
                  ? 'bg-amber-50/70 border-amber-300 text-neutral-900'
                  : 'bg-amber-500/10 border-amber-500/30 text-neutral-100'
                : isLight
                ? 'bg-neutral-50 border-neutral-200 text-neutral-800 hover:bg-neutral-100'
                : 'bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  prefs.disconnectReminder?.enabled
                    ? 'bg-amber-500 text-black'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold block">Rappels Déconnexion</span>
                <span className="text-[10px] text-neutral-400 block">
                  {prefs.disconnectReminder?.enabled
                    ? prefs.disconnectReminder.scheduleMode === 'custom_days'
                      ? 'Personnalisé chaque jour'
                      : prefs.disconnectReminder.scheduleMode === 'weekdays_weekend'
                      ? `Semaine ${prefs.disconnectReminder.weekdayTime || '21:30'} • WE ${prefs.disconnectReminder.weekendTime || '23:00'}`
                      : `Actif à ${prefs.disconnectReminder.time} (${prefs.disconnectReminder.days?.length || 0}j/7)`
                    : 'Désactivé • Lâcher le téléphone'}
                </span>
              </div>
            </div>
            <span className="text-[11px] text-amber-500 font-medium">Modifier →</span>
          </button>
        </div>

        {/* Reset stats */}
        <div className="pt-3 border-t border-neutral-800/40 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500">Réinitialiser les compteurs</span>
          <button
            onClick={() => {
              if (confirm('Voulez-vous réinitialiser le suivi des jours et statistiques ?')) {
                onResetData();
              }
            }}
            className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Réinitialiser</span>
          </button>
        </div>
      </div>
    </div>
  );
};
