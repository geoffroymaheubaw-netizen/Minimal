export type ThemeMode = 'oled' | 'eink' | 'chalk' | 'light';

export interface AppLauncherItem {
  id: string;
  name: string;
  category: string;
  url: string;
  deepLink?: string;
  iconName: 'notebook' | 'claude' | 'chatgpt' | 'calendar' | 'apple-notes' | 'apple-mail' | 'stats' | 'youtube' | 'zentube' | 'weather';
  description: string;
  intentPrompt?: string;
}

export interface DayLog {
  date: string; // YYYY-MM-DD
  completed: boolean;
  screenTimeHours?: number;
  reflection?: string;
  timestamp: number;
  focusMinutesCompleted?: number;
}

export interface FocusSession {
  isActive: boolean;
  durationMinutes: number;
  startTime: number;
  endTime: number;
}

export interface UserStats {
  currentStreak: number;
  longestStreak: number;
  totalDaysSuccessful: number;
  firstUsedDate: string;
  totalFocusMinutesCompleted?: number;
  logs: Record<string, DayLog>; // keyed by YYYY-MM-DD
}

export type DisconnectScheduleMode = 'unified' | 'weekdays_weekend' | 'custom_days';

export interface DaySpecificSchedule {
  enabled: boolean;
  time: string; // HH:mm
}

export interface DisconnectReminderSettings {
  enabled: boolean;
  time: string; // Fallback or unified time (HH:mm format)
  days: number[]; // 0 = Dimanche, 1 = Lundi, 2 = Mardi, 3 = Mercredi, 4 = Jeudi, 5 = Vendredi, 6 = Samedi
  scheduleMode?: DisconnectScheduleMode;
  weekdayTime?: string; // e.g. "21:30" (Lun - Ven)
  weekendTime?: string; // e.g. "23:00" (Sam - Dim)
  dayTimes?: Record<number, DaySpecificSchedule>; // 0 to 6 with specific time & enabled status
  repeatIntervalMinutes: number; // 0 = une seule fois, ou 15, 30, 60 minutes après
  customMessage: string;
  soundAlert: boolean;
  vibrateAlert: boolean;
  userConfirmedNightCycle?: string;
}

export interface UserPreferences {
  theme: ThemeMode;
  intentionalPause: boolean; // 3-second mindful pause before opening apps
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  quoteOfDay: boolean;
  targetDailyScreenTimeHours: number;
  disconnectReminder: DisconnectReminderSettings;
}
