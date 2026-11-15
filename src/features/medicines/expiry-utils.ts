/**
 * Expiry, stock, and date utility functions for medicines and inventory items.
 * Follows rules from docs/MEDBUDDY_DB_DESIGN.md and MEDBUDDY_APP_FRONTEND_PROMPT.md.
 */

export type ExpiryBand = 'fresh' | 'soon' | 'urgent' | 'expired';

export interface ExpiryMeta {
  band: ExpiryBand;
  label: string;
  humanText: string;
  badgeClass: string;
}

/**
 * Calculates effective expiry date: least of expiry_date and (opened_on + shelf_life_after_opening_days).
 */
export function getEffectiveExpiryDate(
  expiryDate: string,
  openedOn?: string | null,
  shelfLifeDays?: number | null,
): string {
  if (!openedOn || !shelfLifeDays || shelfLifeDays <= 0) {
    return expiryDate;
  }

  try {
    const openedTime = new Date(`${openedOn}T00:00:00Z`).getTime();
    const shelfLifeMs = shelfLifeDays * 86400000;
    const openedExpiryDate = new Date(openedTime + shelfLifeMs).toISOString().slice(0, 10);

    return openedExpiryDate < expiryDate ? openedExpiryDate : expiryDate;
  } catch {
    return expiryDate;
  }
}

/**
 * Calculates whole days remaining until effective expiry in the care profile's timezone.
 */
export function computeDaysLeft(
  expiryDate: string,
  timezone = 'Asia/Kolkata',
  openedOn?: string | null,
  shelfLifeDays?: number | null,
): number {
  const effective = getEffectiveExpiryDate(expiryDate, openedOn, shelfLifeDays);

  try {
    // Current date in target timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = formatter.format(now); // YYYY-MM-DD

    const todayDate = new Date(`${todayStr}T00:00:00Z`).getTime();
    const expDate = new Date(`${effective}T00:00:00Z`).getTime();

    const diffDays = Math.round((expDate - todayDate) / 86400000);
    return diffDays;
  } catch {
    // Fallback using UTC
    const todayUtc = new Date().toISOString().slice(0, 10);
    const todayDate = new Date(`${todayUtc}T00:00:00Z`).getTime();
    const expDate = new Date(`${effective}T00:00:00Z`).getTime();
    return Math.round((expDate - todayDate) / 86400000);
  }
}

/**
 * Determines expiry band according to prompt requirements:
 * - Expired: days_left < 0
 * - Urgent: 0 <= days_left <= 7
 * - Soon: 8 <= days_left <= 30
 * - Fresh: days_left > 30
 */
export function getExpiryBand(daysLeft: number): ExpiryBand {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 7) return 'urgent';
  if (daysLeft <= 30) return 'soon';
  return 'fresh';
}

/**
 * Returns full metadata for UI badges, labels, and accessible text.
 */
export function getExpiryMeta(daysLeft: number): ExpiryMeta {
  const band = getExpiryBand(daysLeft);

  switch (band) {
    case 'expired':
      return {
        band,
        label: 'Expired',
        humanText: daysLeft === -1 ? 'Expired yesterday' : `Expired ${Math.abs(daysLeft)}d ago`,
        badgeClass: 'expired',
      };
    case 'urgent':
      return {
        band,
        label: 'Urgent',
        humanText: daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`,
        badgeClass: 'urgent',
      };
    case 'soon':
      return {
        band,
        label: 'Soon',
        humanText: `${daysLeft}d left`,
        badgeClass: 'soon',
      };
    case 'fresh':
    default:
      return {
        band: 'fresh',
        label: 'Fresh',
        humanText: `${daysLeft}d left`,
        badgeClass: 'fresh',
      };
  }
}

/**
 * Converts user month/year (YYYY-MM) or date input (YYYY-MM-DD)
 * to a strict YYYY-MM-DD string pointing to the end of that month.
 */
export function parseExpiryInput(input: string): string {
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const [yearStr, monthStr] = trimmed.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    // Month is 1-indexed in split, in Date.UTC month is 0-indexed: month index `month` with day 0 is last day of `month`
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  }
  return trimmed;
}

/**
 * Checks if a given date string is already expired in the target timezone.
 */
export function isPastExpiry(dateString: string, timezone = 'Asia/Kolkata'): boolean {
  const days = computeDaysLeft(dateString, timezone);
  return days < 0;
}

/**
 * Calculates a friendly refill hint from supply data and daily usage.
 */
export function formatRefillHint(params: {
  remaining: number;
  dailyUsage?: number | null;
  daysOfSupply?: number | null;
  unit?: string;
}): string {
  const { remaining, dailyUsage, daysOfSupply, unit = 'tablets' } = params;

  if (remaining <= 0) {
    return 'Out of stock. Refill needed.';
  }

  if (dailyUsage && dailyUsage > 0 && daysOfSupply !== null && daysOfSupply !== undefined) {
    if (daysOfSupply <= 3) {
      return `Critical: About ${Math.round(daysOfSupply)} days left. Refill now.`;
    }
    if (daysOfSupply <= 7) {
      return `About ${Math.round(daysOfSupply)} days left. Refill soon.`;
    }
    return `About ${Math.round(daysOfSupply)} days of supply left.`;
  }

  if (remaining <= 5) {
    return `Low stock: ${remaining} ${unit} left.`;
  }

  return `${remaining} ${unit} in stock.`;
}
