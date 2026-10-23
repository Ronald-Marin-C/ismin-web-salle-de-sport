import { afterEach, describe, expect, it } from 'vitest';
import { formatDay, formatHour } from './format';

describe('formatDay', () => {
  const timeZone = process.env.TZ;
  afterEach(() => {
    process.env.TZ = timeZone;
  });

  it('writes the short day, then the day and the month', () => {
    expect(formatDay('2026-10-21')).toBe('mer. 21/10');
  });

  it('pads the day and the month with a zero', () => {
    expect(formatDay('2026-11-01')).toBe('dim. 01/11');
  });

  it('keeps the same day in a time zone behind UTC', () => {
    process.env.TZ = 'America/Bogota';

    expect(formatDay('2026-10-21')).toBe('mer. 21/10');
  });
});

describe('formatHour', () => {
  it('writes the start and the end of the slot', () => {
    expect(formatHour(14)).toBe('14:00 – 15:00');
  });

  it('pads the hours with a zero', () => {
    expect(formatHour(7)).toBe('07:00 – 08:00');
    expect(formatHour(9)).toBe('09:00 – 10:00');
  });
});
