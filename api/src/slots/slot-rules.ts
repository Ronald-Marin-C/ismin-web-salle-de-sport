/*
 * Calendar rules of the slots. They take `now` instead of reading the clock,
 * so that the tests can fix the time. Dates and hours are local time: the API
 * runs with TZ=Europe/Paris.
 */

/** Places in a slot: beyond them, registrations go to the waiting list. */
export const SLOT_CAPACITY = 12;

/** Hour of the first slot of the day, 7:00 to 8:00. */
export const OPENING_HOUR = 7;

/** Closing time of the gym: the last slot is 21:00 to 22:00. */
export const CLOSING_HOUR = 22;

/** Number of visible days: today and the six following ones. */
export const DAYS_AHEAD = 7;

/**
 * Formats a date as `YYYY-MM-DD`, in local time.
 *
 * `toISOString` would give the UTC date, which in Paris is still the day
 * before until 1:00 or 2:00.
 */
export function toIsoDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Start of a slot.
 *
 * @param date `YYYY-MM-DD`.
 * @param hour From {@link OPENING_HOUR} to `CLOSING_HOUR - 1`.
 * @returns `hour:00` local time on that day.
 */
export function slotStart(date: string, hour: number): Date {
  // A date-time string without an offset is read as local time.
  return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
}

/**
 * The days whose slots can be seen and booked.
 *
 * @returns {@link DAYS_AHEAD} dates as `YYYY-MM-DD`, starting today.
 */
export function visibleDates(now: Date): string[] {
  // Calendar days rather than steps of 24 hours: the day of the switch to
  // winter time lasts 25 hours.
  return Array.from({ length: DAYS_AHEAD }, (_, i) =>
    toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)),
  );
}

/**
 * Whether a slot exists and is visible: an opening hour on one of the
 * visible days. Whether it has started is a separate check, {@link hasStarted}.
 */
export function isSlotInWindow(date: string, hour: number, now: Date): boolean {
  return hour >= OPENING_HOUR && hour < CLOSING_HOUR && visibleDates(now).includes(date);
}

/** Whether a slot has begun at `now`, from its first second on. */
export function hasStarted(date: string, hour: number, now: Date): boolean {
  return now.getTime() >= slotStart(date, hour).getTime();
}
