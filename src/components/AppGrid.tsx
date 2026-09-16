import React from 'react';
import {
  BookOpen,
  Sparkles,
  MessageSquare,
  Calendar as CalendarIcon,
  PenLine,
  Flame,
  ArrowUpRight,
  ChevronRight,
  Hourglass,
  Lock,
  Youtube,
  Play,
  CloudSun,
  Mail,
} from 'lucide-react';
import { AppLauncherItem, ThemeMode } from '../types';
import { LAUNCHER_APPS } from '../data/apps';

interface AppGridProps {
  onSelectApp: (app: AppLauncherItem) => void;
  onOpenStreakPage: () => void;
  onOpenFocusSetup: () => void;
  theme: ThemeMode;
  currentStreak: number;
}

export const AppGrid: React.FC<AppGridProps> = ({
  onSelectApp,
  onOpenStreakPage,
  onOpenFocusSetup,
  theme,
  currentStreak,
}) => {
  const isLight = theme === 'light';
  const isEink = theme === 'eink';

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'notebook':
        return <BookOpen className="w-5 h-5" />;
      case 'claude':
        return <Sparkles className="w-5 h-5" />;
      case 'chatgpt':
        return <MessageSquare className="w-5 h-5" />;
      case 'calendar':
        return <CalendarIcon className="w-5 h-5" />;
      case 'apple-notes':
        return <PenLine className="w-5 h-5" />;
      case 'apple-mail':
        return <Mail className="w-5 h-5 text-sky-400" />;
      case 'weather':
        return <CloudSun className="w-5 h-5 text-amber-400" />;
      case 'zentube':
        return <Play className="w-5 h-5 text-emerald-400" />;
      case 'youtube':
        return <Youtube className="w-5 h-5 text-red-500" />;
      default:
        return <ArrowUpRight className="w-5 h-5" />;
    }
  };

  return (
    <div className="w-full flex flex-col gap-2.5 my-auto" id="app-launcher-grid">
      <div className="flex items-center justify-between px-1 mb-1">
        <span
          className={`text-[11px] font-semibold uppercase tracking-widest ${
            isLight ? 'text-neutral-500' : isEink ? 'text-neutral-600' : 'text-neutral-500'
          }`}
        >
          Applications Utiles
        </span>
        <span
          className={`text-[11px] ${
            isLight ? 'text-neutral-400' : isEink ? 'text-neutral-500' : 'text-neutral-600'
          }`}
        >
          Accès ciblé sans distraction
        </span>
      </div>

      {/* 6 Essential Focus & Utility Apps including ZenTube */}
      {LAUNCHER_APPS.map((app) => (
        <button
          key={app.id}
          id={`btn-app-${app.id}`}
          onClick={() => onSelectApp(app)}
          className={`w-full group relative flex items-center justify-between p-3.5 sm:p-4 rounded-xl border text-left transition-all duration-150 active:scale-[0.985] cursor-pointer ${
            isLight
              ? 'bg-white border-neutral-200/90 text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50 shadow-xs'
              : isEink
              ? 'bg-neutral-200 border-neutral-400 text-neutral-950 hover:bg-neutral-300'
              : 'bg-[#141414] border-neutral-800/90 text-neutral-100 hover:border-neutral-700 hover:bg-[#1a1a1a]'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`p-2 rounded-lg transition-colors ${
                isLight
                  ? 'bg-neutral-100 text-neutral-800 group-hover:bg-neutral-200'
                  : isEink
                  ? 'bg-neutral-300 text-neutral-900'
                  : 'bg-neutral-900 text-neutral-300 group-hover:bg-neutral-800 group-hover:text-white'
              }`}
            >
              {getIcon(app.iconName)}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-base tracking-tight">{app.name}</span>
                {app.deepLink ? (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded tracking-wide font-mono ${
                      isLight
                        ? 'bg-neutral-100 text-neutral-600'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    App
                  </span>
                ) : null}
              </div>
              <p
                className={`text-xs mt-0.5 line-clamp-1 ${
                  isLight ? 'text-neutral-500' : isEink ? 'text-neutral-700' : 'text-neutral-400'
                }`}
              >
                {app.description}
              </p>
            </div>
          </div>

          <div
            className={`p-1 rounded-md transition-colors ${
              isLight
                ? 'text-neutral-400 group-hover:text-neutral-700'
                : 'text-neutral-500 group-hover:text-neutral-300'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </button>
      ))}

      {/* Mode Concentration / Focus Timer Button */}
      <div className="pt-1">
        <button
          id="btn-focus-mode"
          onClick={onOpenFocusSetup}
          className={`w-full group relative flex items-center justify-between p-3.5 sm:p-4 rounded-xl border text-left transition-all duration-150 active:scale-[0.985] cursor-pointer ${
            isLight
              ? 'bg-neutral-100/90 border-neutral-300 text-neutral-900 hover:bg-neutral-200/70 shadow-xs'
              : isEink
              ? 'bg-neutral-300 border-neutral-800 text-neutral-950 font-medium'
              : 'bg-[#18181b] border-neutral-700/80 text-neutral-100 hover:border-neutral-600 hover:bg-[#202024]'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`p-2 rounded-lg transition-colors ${
                isLight
                  ? 'bg-neutral-200 text-neutral-900'
                  : isEink
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-800 text-amber-400 border border-neutral-700'
              }`}
            >
              <Hourglass className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-base tracking-tight">
                  Mode Concentration
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1 ${
                    isLight
                      ? 'bg-neutral-200 text-neutral-800'
                      : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  <Lock className="w-2.5 h-2.5" />
                  Minuteur
                </span>
              </div>
              <p
                className={`text-xs mt-0.5 ${
                  isLight ? 'text-neutral-600' : isEink ? 'text-neutral-800' : 'text-neutral-400'
                }`}
              >
                Verrouiller l'accès aux applications pendant un temps choisi
              </p>
            </div>
          </div>

          <div
            className={`p-1 rounded-md transition-colors ${
              isLight
                ? 'text-neutral-500'
                : 'text-neutral-400'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </div>
        </button>
      </div>

      {/* 6th Requested Button: Dedicated Streak & Screen Time Reduction Page */}
      <div className="pt-1">
        <button
          id="btn-streak-page"
          onClick={onOpenStreakPage}
          className={`w-full group relative flex items-center justify-between p-3.5 sm:p-4 rounded-xl border text-left transition-all duration-150 active:scale-[0.985] cursor-pointer ${
            isLight
              ? 'bg-amber-50/60 border-amber-200 text-neutral-900 hover:bg-amber-50 hover:border-amber-300 shadow-xs'
              : isEink
              ? 'bg-neutral-300 border-neutral-900 text-neutral-950 font-semibold'
              : 'bg-neutral-900/80 border-amber-500/30 text-neutral-100 hover:border-amber-500/60 hover:bg-neutral-900'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`p-2 rounded-lg transition-colors ${
                isLight
                  ? 'bg-amber-100 text-amber-800'
                  : isEink
                  ? 'bg-neutral-900 text-white'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              <Flame className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base tracking-tight">
                  Jours de Réduction d'Écran
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                    isLight
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {currentStreak} {currentStreak > 1 ? 'jours' : 'jour'}
                </span>
              </div>
              <p
                className={`text-xs mt-0.5 ${
                  isLight ? 'text-amber-800/80' : isEink ? 'text-neutral-800' : 'text-neutral-400'
                }`}
              >
                Suivre mes réussites & valider ma journée sobre
              </p>
            </div>
          </div>

          <div
            className={`p-1 rounded-md transition-colors ${
              isLight
                ? 'text-amber-700'
                : 'text-amber-400'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </div>
        </button>
      </div>
    </div>
  );
};
