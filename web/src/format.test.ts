import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatDay, formatHour } from './format';

describe('formatDay', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('writes the short day, then the day and the month', () => {
    expect(formatDay('2026-10-21')).toBe('mer. 21/10');
  });

  it('pads the day and the month with a zero', () => {
    expect(formatDay('2026-11-01')).toBe('dim. 01/11');
  });

  it('keeps the same day in a time zone behind UTC', () => {
    vi.stubEnv('TZ', 'America/Bogota');

    expect(formatDay('2026-10-21')).toBe('mer. 21/10');
  });
});

describe('formatDate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('writes the day and the month of an instant', () => {
    expect(formatDate('2026-10-21T08:30:00.000Z')).toBe('21/10');
  });

  it('gives the day in Paris, whatever the time zone of the browser', () => {
    vi.stubEnv('TZ', 'UTC');

    // 00:30 on the 22nd in Paris, still the 21st in UTC.
    expect(formatDate('2026-10-21T22:30:00.000Z')).toBe('22/10');
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
