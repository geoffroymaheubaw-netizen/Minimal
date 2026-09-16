import { UserStats, UserPreferences, DayLog, FocusSession } from '../types';

const STATS_KEY = 'minimal_launcher_stats_v1';
const PREFS_KEY = 'minimal_launcher_prefs_v1';
const FOCUS_KEY = 'minimal_launcher_focus_session_v1';

export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatFrenchDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function getDefaultPreferences(): UserPreferences {
  return {
    theme: 'oled',
    intentionalPause: true,
    soundEnabled: true,
    hapticsEnabled: true,
    quoteOfDay: true,
    targetDailyScreenTimeHours: 2,
    disconnectReminder: {
      enabled: true,
      time: '21:30',
      days: [1, 2, 3, 4, 5, 6, 0], // Every day by default (Lun à Dim)
      scheduleMode: 'weekdays_weekend',
      weekdayTime: '21:30',
      weekendTime: '23:00',
      dayTimes: {
        1: { enabled: true, time: '21:30' }, // Lundi
        2: { enabled: true, time: '21:30' }, // Mardi
        3: { enabled: true, time: '21:30' }, // Mercredi
        4: { enabled: true, time: '21:30' }, // Jeudi
        5: { enabled: true, time: '22:30' }, // Vendredi (un peu plus tard)
        6: { enabled: true, time: '23:00' }, // Samedi
        0: { enabled: true, time: '22:00' }, // Dimanche
      },
      repeatIntervalMinutes: 30,
      customMessage: "Il est l'heure de lâcher votre téléphone. Offrez à vos yeux et votre esprit un repos bien mérité.",
      soundAlert: true,
      vibrateAlert: true,
    },
  };
}

export function loadPreferences(): UserPreferences {
  try {
    const saved = localStorage.getItem(PREFS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const defaults = getDefaultPreferences();
      return {
        ...defaults,
        ...parsed,
        disconnectReminder: {
          ...defaults.disconnectReminder,
          ...(parsed.disconnectReminder || {}),
        },
      };
    }
  } catch (e) {
    console.error('Failed to load preferences', e);
  }
  return getDefaultPreferences();
}

export function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error('Failed to save preferences', e);
  }
}

export function getDefaultStats(): UserStats {
  const today = getTodayString();
  const defaultLogs: Record<string, DayLog> = {
    [today]: {
      date: today,
      completed: true,
      screenTimeHours: 1.8,
      reflection: "Premier jour d'utilisation du lanceur minimaliste.",
      timestamp: Date.now(),
    },
  };

  return {
    currentStreak: 1,
    longestStreak: 1,
    totalDaysSuccessful: 1,
    firstUsedDate: today,
    logs: defaultLogs,
  };
}

export function loadStats(): UserStats {
  try {
    const saved = localStorage.getItem(STATS_KEY);
    if (saved) {
      const parsed: UserStats = JSON.parse(saved);
      return recalculateStreaks(parsed);
    }
  } catch (e) {
    console.error('Failed to load stats', e);
  }
  const init = getDefaultStats();
  saveStats(init);
  return init;
}

export function saveStats(stats: UserStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error('Failed to save stats', e);
  }
}

export function recalculateStreaks(stats: UserStats): UserStats {
  const dates = Object.keys(stats.logs)
    .filter((d) => stats.logs[d].completed)
    .sort();

  if (dates.length === 0) {
    return {
      ...stats,
      currentStreak: 0,
      longestStreak: 0,
      totalDaysSuccessful: 0,
    };
  }

  const totalDays = dates.length;
  let maxStreak = 1;
  let currentConsecutive = 1;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffTime = curr.getTime() - prev.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

    if (diffDays === 1) {
      currentConsecutive += 1;
      if (currentConsecutive > maxStreak) {
        maxStreak = currentConsecutive;
      }
    } else if (diffDays > 1) {
      currentConsecutive = 1;
    }
  }

  // Check if current streak extends to today or yesterday
  const today = getTodayString();
  const todayDate = new Date(today);
  const lastLogged = dates[dates.length - 1];
  const lastDate = new Date(lastLogged);
  const diffFromTodayDays = Math.round((todayDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

  let currentStreak = 0;
  if (diffFromTodayDays === 0 || diffFromTodayDays === 1) {
    // calculate back from the last logged date
    let streakCount = 1;
    for (let i = dates.length - 1; i > 0; i--) {
      const curr = new Date(dates[i]);
      const prev = new Date(dates[i - 1]);
      const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 3600 * 24));
      if (diff === 1) {
        streakCount += 1;
      } else {
        break;
      }
    }
    currentStreak = streakCount;
  }

  return {
    ...stats,
    currentStreak,
    longestStreak: Math.max(maxStreak, stats.longestStreak || 0, currentStreak),
    totalDaysSuccessful: totalDays,
  };
}

export function toggleDayCompletion(dateStr: string, screenHours?: number, reflection?: string): UserStats {
  const current = loadStats();
  const existing = current.logs[dateStr];

  const newLog: DayLog = {
    date: dateStr,
    completed: existing ? !existing.completed : true,
    screenTimeHours: screenHours ?? existing?.screenTimeHours ?? 2.0,
    reflection: reflection ?? existing?.reflection ?? '',
    timestamp: Date.now(),
  };

  const updatedLogs = {
    ...current.logs,
    [dateStr]: newLog,
  };

  const updated: UserStats = {
    ...current,
    logs: updatedLogs,
  };

  const recalculated = recalculateStreaks(updated);
  saveStats(recalculated);
  return recalculated;
}

export function loadFocusSession(): FocusSession | null {
  try {
    const raw = localStorage.getItem(FOCUS_KEY);
    if (raw) {
      const session: FocusSession = JSON.parse(raw);
      // Keep session if still running, or if ended within the last 24h waiting for user to acknowledge completion
      const endedRecently = Date.now() - session.endTime < 24 * 60 * 60 * 1000;
      if (session.isActive && endedRecently) {
        return session;
      } else {
        localStorage.removeItem(FOCUS_KEY);
      }
    }
  } catch (e) {
    console.error('Failed to load focus session', e);
  }
  return null;
}

export function saveFocusSession(session: FocusSession | null): void {
  try {
    if (session) {
      localStorage.setItem(FOCUS_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(FOCUS_KEY);
    }
  } catch (e) {
    console.error('Failed to save focus session', e);
  }
}

export function recordCompletedFocusSession(minutes: number): UserStats {
  const current = loadStats();
  const today = getTodayString();
  const existing = current.logs[today];

  const updatedMinutes = (existing?.focusMinutesCompleted || 0) + minutes;
  const newLog: DayLog = {
    date: today,
    completed: true,
    screenTimeHours: existing?.screenTimeHours ?? 1.5,
    reflection: existing?.reflection ?? '',
    timestamp: Date.now(),
    focusMinutesCompleted: updatedMinutes,
  };

  const updatedStats: UserStats = {
    ...current,
    totalFocusMinutesCompleted: (current.totalFocusMinutesCompleted || 0) + minutes,
    logs: {
      ...current.logs,
      [today]: newLog,
    },
  };

  const recalculated = recalculateStreaks(updatedStats);
  saveStats(recalculated);
  return recalculated;
}
