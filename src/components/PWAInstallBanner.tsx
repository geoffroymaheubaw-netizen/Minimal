import React, { useState } from 'react';
import { Download, Share2, X, Smartphone, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { ThemeMode } from '../types';

interface PWAInstallBannerProps {
  theme: ThemeMode;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ theme }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) {
    return null;
  }

  const isLight = theme === 'light';
  const isEink = theme === 'eink';

  return (
    <>
      <div
        className={`w-full max-w-sm mt-3 p-2.5 px-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
          isLight
            ? 'bg-neutral-100/90 border-neutral-300 text-neutral-800'
            : isEink
            ? 'bg-neutral-300 border-neutral-400 text-neutral-900'
            : 'bg-neutral-900/90 border-neutral-800 text-neutral-300'
        }`}
        id="pwa-install-banner"
      >
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="font-medium text-[11px]">
            {isIOS
              ? 'Ajouter à l\'écran d\'accueil iPhone'
              : 'Installer comme lanceur mobile'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isInstallable && (
            <button
              onClick={install}
              className="px-2.5 py-1 rounded-md bg-amber-500 text-neutral-950 font-semibold text-[11px] hover:bg-amber-400 transition cursor-pointer"
            >
              Installer
            </button>
          )}

          {isIOS && (
            <button
              onClick={() => setShowIOSGuide(true)}
              className={`px-2 py-0.5 rounded border text-[11px] font-medium transition cursor-pointer ${
                isLight
                  ? 'border-neutral-400 hover:bg-neutral-200'
                  : 'border-neutral-700 hover:bg-neutral-800'
              }`}
            >
              Comment faire
            </button>
          )}

          {!isInstallable && !isIOS && (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="px-2 py-0.5 rounded border border-neutral-700 text-[11px] hover:bg-neutral-800 cursor-pointer"
            >
              Raccourci
            </button>
          )}

          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded text-neutral-400 hover:text-neutral-200"
            aria-label="Fermer la bannière"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Guide modal for iOS & Android shortcuts */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className={`w-full max-w-xs rounded-2xl p-5 border text-left shadow-xl ${
              isLight
                ? 'bg-white border-neutral-300 text-neutral-900'
                : isEink
                ? 'bg-neutral-200 border-neutral-900 text-neutral-950'
                : 'bg-[#141414] border-neutral-800 text-neutral-100'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-neutral-800/40">
              <h4 className="font-semibold text-sm">Installer sur votre téléphone</h4>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded text-neutral-400 hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-400 mb-3">
              Pour utiliser ce site comme un véritable écran d'accueil sans barre d'adresse :
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="p-1 rounded bg-neutral-800 text-neutral-200">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-medium text-neutral-200 block">1. Bouton Partager</span>
                  <span className="text-neutral-400 text-[11px]">
                    Appuyez sur l'icône Partager dans Safari ou les 3 points dans Chrome.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="p-1 rounded bg-neutral-800 text-neutral-200">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-medium text-neutral-200 block">
                    2. "Sur l'écran d'accueil"
                  </span>
                  <span className="text-neutral-400 text-[11px]">
                    Sélectionnez "Sur l'écran d'accueil" pour créer l'icône d'application.
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 w-full py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium transition cursor-pointer"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};
