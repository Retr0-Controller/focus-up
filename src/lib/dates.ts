/** Dates are stored as plain "YYYY-MM-DD" text in the user's own calendar, with no time zone surprises. */

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** A Date -> "2026-10-08" using the local calendar day. */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-10-08" -> a Date at local midnight. */
export function fromDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** First day of the month containing `date`, and first day of the next month. Both as "YYYY-MM-DD". */
export function monthRange(date: Date): { start: string; nextStart: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const nextStart = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start: toDateString(start), nextStart: toDateString(nextStart) };
}

/** "2026-10-08" -> "Oct 8". */
export function formatShortDate(value: string): string {
  return fromDateString(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
