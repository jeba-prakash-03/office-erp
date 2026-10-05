import { query } from '../config/db';

let cachedTimezone = 'Asia/Kolkata';
let lastTzFetch = 0;

export async function getCompanyTimezone(): Promise<string> {
  const now = Date.now();
  if (now - lastTzFetch < 60000 && cachedTimezone) {
    return cachedTimezone;
  }
  try {
    const rows = await query<any[]>('SELECT timezone FROM company_settings LIMIT 1');
    if (rows.length > 0 && rows[0].timezone) {
      cachedTimezone = rows[0].timezone;
      lastTzFetch = now;
    }
  } catch {
    // Fallback to default
  }
  return cachedTimezone || 'Asia/Kolkata';
}

/**
 * Returns canonical current date in YYYY-MM-DD according to company business timezone.
 */
export function getBusinessDate(timeZone: string = 'Asia/Kolkata', date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Formats fractional hours (e.g. 8.9166) into clean human duration (e.g. '8h 55m')
 */
export function formatDuration(hours: number | null | undefined): string {
  if (!hours || isNaN(Number(hours)) || Number(hours) <= 0) return '0h 00m';
  const totalMinutes = Math.round(Number(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}
