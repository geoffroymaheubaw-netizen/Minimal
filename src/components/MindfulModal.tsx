import React, { useState, useEffect } from 'react';
import { ExternalLink, X, Wind, Check, Smartphone, Globe, RefreshCw } from 'lucide-react';
import { AppLauncherItem, ThemeMode } from '../types';
import { playMinimalClick } from '../utils/audio';
import { getPrimaryDeepLink, getAlternativeDeepLink, getMobilePlatform, isCustomScheme } from '../utils/launcher';

interface MindfulModalProps {
  app: AppLauncherItem | null;
  onClose: () => void;
  onLaunch: (targetUrl: string, fallbackWebUrl?: string) => void;
  theme: ThemeMode;
  soundEnabled: boolean;
}

export const MindfulModal: React.FC<MindfulModalProps> = ({
  app,
  onClose,
  onLaunch,
  theme,
  soundEnabled,
}) => {
  const [countdown, setCountdown] = useState(3);
  const [canOpenDirectly, setCanOpenDirectly] = useState(false);

  useEffect(() => {
    if (!app) return;
    setCountdown(3);
    setCanOpenDirectly(false);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanOpenDirectly(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [app]);

  if (!app) return null;

  const isLight = theme === 'light';
  const isEink = theme === 'eink';

  const primaryDeepLink = getPrimaryDeepLink(app);
  const alternativeDeepLink = getAlternativeDeepLink(app);
  const isCustom = primaryDeepLink ? isCustomScheme(primaryDeepLink) : false;
  const isZenTube = app.id === 'zentube';
  const platform = getMobilePlatform();

  const primaryBtnLabel = isZenTube
    ? 'Accéder à ZenTube'
    : isCustom
    ? `Ouvrir l'application mobile (${app.name})`
    : `Accéder à ${app.name}`;

  const altBtnLabel = isZenTube
    ? platform === 'ios'
      ? "Télécharger ZenTube (App Store)"
      : "Voir ZenTube (Google Play)"
    : 'Essayer le lien direct alternatif';

  const handleOpenTarget = (deepLinkUrl?: string) => {
    playMinimalClick(soundEnabled);
    const targetUrl = deepLinkUrl || app.url;
    onLaunch(targetUrl, app.url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      id="modal-mindful-pause"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm rounded-2xl p-6 border flex flex-col items-center text-center relative shadow-2xl ${
          isLight
            ? 'bg-white border-neutral-200 text-neutral-900'
            : isEink
            ? 'bg-neutral-200 border-neutral-900 text-neutral-950'
            : 'bg-[#141414] border-neutral-800 text-neutral-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors ${
            isLight ? 'hover:bg-neutral-100 text-neutral-500' : 'hover:bg-neutral-800 text-neutral-400'
          }`}
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Breathing Animation Icon */}
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-all ${
            isLight
              ? 'bg-neutral-100 text-neutral-700'
              : isEink
              ? 'bg-neutral-300 text-neutral-900'
              : 'bg-neutral-900 text-neutral-300 border border-neutral-800'
          } ${countdown > 0 ? 'scale-110' : 'scale-100'}`}
        >
          <Wind className={`w-7 h-7 ${countdown > 0 ? 'animate-pulse' : ''}`} />
        </div>

        <span
          className={`text-[11px] font-semibold uppercase tracking-widest ${
            isLight ? 'text-neutral-500' : isEink ? 'text-neutral-600' : 'text-neutral-500'
          }`}
        >
          Pause Intentionnelle
        </span>

        <h3 className="text-xl font-medium mt-1 mb-2 tracking-tight">
          Ouvrir {app.name} ?
        </h3>

        <p
          className={`text-xs mb-5 max-w-xs ${
            isLight ? 'text-neutral-600' : isEink ? 'text-neutral-700' : 'text-neutral-400'
          }`}
        >
          {app.intentPrompt ||
            'Prenez une seconde de recul : est-ce un choix conscient ou un réflexe d\'ennui ?'}
        </p>

        {/* Breathing countdown circle or unlocked state */}
        <div className="mb-5 flex flex-col items-center">
          {countdown > 0 ? (
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Respiration consciente... {countdown}s</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
              <Check className="w-4 h-4" />
              <span>Prêt lorsque vous l'êtes</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2">
          {/* If app has deepLink (like chatgpt, claude, mobilenotes or calshow), offer direct app open */}
          {primaryDeepLink ? (
            <>
              <button
                onClick={() => handleOpenTarget(primaryDeepLink)}
                id="btn-launch-deep-link"
                className={`w-full py-3 px-4 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                  isLight
                    ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                    : isEink
                    ? 'bg-neutral-900 text-white font-bold'
                    : 'bg-white text-neutral-950 font-semibold hover:bg-neutral-200'
                }`}
              >
                {isCustom ? <Smartphone className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                <span>{primaryBtnLabel}</span>
              </button>

              {alternativeDeepLink && (
                <button
                  onClick={() => handleOpenTarget(alternativeDeepLink)}
                  id="btn-launch-alt-deep-link"
                  className={`w-full py-2 px-3 rounded-lg text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isLight
                      ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200/80'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-neutral-800/80'
                  }`}
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{altBtnLabel}</span>
                </button>
              )}

              {primaryDeepLink !== app.url && (
                <button
                  onClick={() => handleOpenTarget(undefined)}
                  id="btn-launch-web-link"
                  className={`w-full py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isLight
                      ? 'border border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                      : isEink
                      ? 'border border-neutral-400 text-neutral-800'
                      : 'border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Ouvrir la version Web (navigateur)</span>
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => handleOpenTarget(undefined)}
              id="btn-launch-web-link"
              className={`w-full py-3 px-4 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isLight
                  ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                  : isEink
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white text-neutral-950 hover:bg-neutral-200'
              }`}
            >
              <span>Accéder à {app.name}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onClose}
            id="btn-cancel-mindful"
            className={`w-full py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer mt-1 ${
              isLight
                ? 'text-neutral-400 hover:text-neutral-700'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Annuler et éteindre l'écran
          </button>
        </div>
      </div>
    </div>
  );
};
