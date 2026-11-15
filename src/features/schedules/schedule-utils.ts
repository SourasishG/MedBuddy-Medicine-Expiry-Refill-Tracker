/**
 * Timezone-aware date, schedule, and dose categorization utilities for MedBuddy.
 * Complies with strict project constraints:
 * - Uses native Intl.DateTimeFormat (no external date libraries).
 * - Correctly honors the care profile's timezone for all "Today" and day boundary logic.
 */

export interface ScheduleTimeItem {
  time: string; // HH:mm format, e.g. "08:00"
  food: 'any' | 'before_food' | 'with_food' | 'after_food';
  amount?: number;
}

export const FOOD_RULE_LABELS: Record<string, string> = {
  any: 'Any time',
  before_food: 'Before food',
  with_food: 'With food',
  after_food: 'After food',
};

export const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekdays: 'Specific days of week',
  interval: 'Every few days',
  as_needed: 'As needed (PRN)',
};

export const DAYS_OF_WEEK = [
  { id: 1, label: 'Mon', fullName: 'Monday' },
  { id: 2, label: 'Tue', fullName: 'Tuesday' },
  { id: 3, label: 'Wed', fullName: 'Wednesday' },
  { id: 4, label: 'Thu', fullName: 'Thursday' },
  { id: 5, label: 'Fri', fullName: 'Friday' },
  { id: 6, label: 'Sat', fullName: 'Saturday' },
  { id: 7, label: 'Sun', fullName: 'Sunday' },
];

/**
 * Returns today's date formatted as YYYY-MM-DD in the specified IANA timezone.
 */
export function getTodayDateString(timezone = 'Asia/Kolkata', date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    // Fallback if timezone string is invalid
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Returns date formatted as YYYY-MM-DD in the specified IANA timezone.
 */
export function getLocalDateString(isoString: string | Date, timezone = 'Asia/Kolkata'): string {
  try {
    const d = typeof isoString === 'string' ? new Date(isoString) : isoString;
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch {
    const d = typeof isoString === 'string' ? new Date(isoString) : isoString;
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Formats a timestamp into a 12-hour clock string (e.g. "8:00 AM") in the specified timezone.
 */
export function formatTimeInTz(isoString: string | Date, timezone = 'Asia/Kolkata'): string {
  try {
    const d = typeof isoString === 'string' ? new Date(isoString) : isoString;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    const d = typeof isoString === 'string' ? new Date(isoString) : isoString;
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
}

/**
 * Formats a header date (e.g. "Sunday, 15 November") in the specified timezone.
 */
export function formatHeaderDate(timezone = 'Asia/Kolkata', date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date);
  } catch {
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }
}

/**
 * Formats 24h HH:mm string (e.g. "14:30") into a readable "2:30 PM".
 */
export function formatClockTime(time24: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = Number.parseInt(hStr || '0', 10);
  const m = Number.parseInt(mStr || '0', 10);
  if (Number.isNaN(h)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${period}`;
}

export interface DoseEventLike {
  id: string;
  care_profile_id: string;
  medicine_id: string;
  schedule_id?: string | null;
  schedule_time_id?: string | null;
  scheduled_for: string;
  amount: number;
  status: 'pending' | 'taken' | 'skipped' | 'missed';
  taken_at?: string | null;
  snoozed_until?: string | null;
  stock_shortfall?: number | null;
  as_needed?: boolean;
  note?: string | null;
  is_snoozed?: boolean;
}

export interface CategorizedDoses<T extends DoseEventLike> {
  dueNow: T[];
  laterToday: T[];
  missed: T[];
  doneToday: T[];
}

/**
 * Partitions dose events for "Today" into four clinical sections:
 * - dueNow: Pending doses scheduled on or before now, not snoozed past now, and within missed window.
 * - laterToday: Pending doses scheduled for later today, or snoozed until a future time today.
 * - missed: Finalized missed doses OR pending doses that have lapsed beyond missed_after_minutes.
 * - doneToday: Doses taken or skipped today.
 */
export function categorizeDoseEvents<T extends DoseEventLike>(
  events: T[],
  timezone = 'Asia/Kolkata',
  missedAfterMinutes = 120,
  now = new Date(),
): CategorizedDoses<T> {
  const todayStr = getTodayDateString(timezone, now);
  const nowMs = now.getTime();
  const missedThresholdMs = missedAfterMinutes * 60 * 1000;

  const dueNow: T[] = [];
  const laterToday: T[] = [];
  const missed: T[] = [];
  const doneToday: T[] = [];

  for (const event of events) {
    const schedDateStr = getLocalDateString(event.scheduled_for, timezone);
    const schedTimeMs = new Date(event.scheduled_for).getTime();

    // 1. Done today (taken or skipped)
    if (event.status === 'taken' || event.status === 'skipped') {
      const completionDateStr = event.taken_at
        ? getLocalDateString(event.taken_at, timezone)
        : schedDateStr;
      if (completionDateStr === todayStr || schedDateStr === todayStr) {
        doneToday.push(event);
      }
      continue;
    }

    // 2. Explicitly marked missed
    if (event.status === 'missed') {
      if (schedDateStr === todayStr || schedTimeMs >= nowMs - 24 * 3600 * 1000) {
        missed.push(event);
      }
      continue;
    }

    // 3. Pending doses
    if (event.status === 'pending') {
      const isSnoozedFuture =
        event.snoozed_until && new Date(event.snoozed_until).getTime() > nowMs;

      // If snoozed to the future
      if (isSnoozedFuture) {
        // As long as it is still relevant for today
        const snoozedDateStr = getLocalDateString(event.snoozed_until!, timezone);
        if (snoozedDateStr === todayStr || schedDateStr === todayStr) {
          laterToday.push({ ...event, is_snoozed: true });
        }
        continue;
      }

      // Check if it lapsed into missed threshold
      const isPastMissedThreshold = nowMs - schedTimeMs >= missedThresholdMs;
      if (isPastMissedThreshold) {
        missed.push(event);
        continue;
      }

      // If scheduled time is in the future today
      if (schedTimeMs > nowMs) {
        if (schedDateStr === todayStr) {
          laterToday.push(event);
        }
        continue;
      }

      // Scheduled in the past but not missed yet -> Due Now
      if (schedDateStr === todayStr || nowMs - schedTimeMs < missedThresholdMs) {
        dueNow.push(event);
      }
    }
  }

  // Sort each section logically:
  // dueNow: earliest scheduled first
  dueNow.sort(
    (a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime(),
  );
  // laterToday: earliest scheduled / snoozed first
  laterToday.sort((a, b) => {
    const timeA = a.snoozed_until ? new Date(a.snoozed_until).getTime() : new Date(a.scheduled_for).getTime();
    const timeB = b.snoozed_until ? new Date(b.snoozed_until).getTime() : new Date(b.scheduled_for).getTime();
    return timeA - timeB;
  });
  // missed: most recent missed first
  missed.sort(
    (a, b) => new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime(),
  );
  // doneToday: most recently completed first
  doneToday.sort((a, b) => {
    const timeA = a.taken_at ? new Date(a.taken_at).getTime() : new Date(a.scheduled_for).getTime();
    const timeB = b.taken_at ? new Date(b.taken_at).getTime() : new Date(b.scheduled_for).getTime();
    return timeB - timeA;
  });

  return { dueNow, laterToday, missed, doneToday };
}

/**
 * Builds readable recurrence summary string for display (e.g. "Daily at 8:00 AM & 8:00 PM").
 */
export function formatScheduleSummary(
  frequency: 'daily' | 'weekdays' | 'interval' | 'as_needed',
  times: { time_of_day: string; food?: string | null }[] = [],
  daysOfWeek?: number[] | null,
  intervalDays?: number | null,
): string {
  if (frequency === 'as_needed') {
    return 'Taken as needed (no fixed schedule)';
  }

  let freqText = 'Daily';
  if (frequency === 'weekdays' && daysOfWeek && daysOfWeek.length > 0) {
    const dayNames = daysOfWeek
      .map((d) => DAYS_OF_WEEK.find((item) => item.id === d)?.label || `D${d}`)
      .join(', ');
    freqText = `On ${dayNames}`;
  } else if (frequency === 'interval' && intervalDays) {
    freqText = `Every ${intervalDays} days`;
  }

  if (times.length === 0) {
    return freqText;
  }

  const timesText = times.map((t) => formatClockTime(t.time_of_day)).join(', ');
  return `${freqText} at ${timesText}`;
}
