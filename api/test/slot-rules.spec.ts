import { hasStarted, isSlotInWindow, slotStart, toIsoDate, visibleDates } from '../src/slots/slot-rules.js';

/**
 * The calendar rules of the slots, as pure functions of `now`. The suite runs
 * with TZ=Europe/Paris: a date without an offset below is Paris time.
 */
describe('slot rules', () => {
  describe('toIsoDate', () => {
    it('gives the local date just after midnight, when UTC is still on the day before', () => {
      expect(toIsoDate(new Date('2026-10-21T00:30:00'))).toBe('2026-10-21');
    });

    it('gives the local date just before midnight', () => {
      expect(toIsoDate(new Date('2026-10-21T23:30:00'))).toBe('2026-10-21');
    });

    it('pads the month and the day', () => {
      expect(toIsoDate(new Date('2026-03-05T12:00:00'))).toBe('2026-03-05');
    });
  });

  describe('slotStart', () => {
    it('is the hour of the slot, Paris time', () => {
      expect(slotStart('2026-10-21', 7).toISOString()).toBe('2026-10-21T05:00:00.000Z');
    });

    it('follows the switch to winter time', () => {
      expect(slotStart('2026-10-26', 7).toISOString()).toBe('2026-10-26T06:00:00.000Z');
    });
  });

  describe('visibleDates', () => {
    it('returns today and the six following days', () => {
      expect(visibleDates(new Date('2026-10-21T10:30:00'))).toEqual([
        '2026-10-21',
        '2026-10-22',
        '2026-10-23',
        '2026-10-24',
        '2026-10-25',
        '2026-10-26',
        '2026-10-27',
      ]);
    });

    it('goes on into the next month', () => {
      expect(visibleDates(new Date('2026-10-29T10:30:00'))).toEqual([
        '2026-10-29',
        '2026-10-30',
        '2026-10-31',
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
        '2026-11-04',
      ]);
    });

    it('counts calendar days across the switch to winter time, when 25 October lasts 25 hours', () => {
      expect(visibleDates(new Date('2026-10-24T00:30:00'))).toEqual([
        '2026-10-24',
        '2026-10-25',
        '2026-10-26',
        '2026-10-27',
        '2026-10-28',
        '2026-10-29',
        '2026-10-30',
      ]);
    });
  });

  describe('isSlotInWindow', () => {
    const now = new Date('2026-10-21T10:30:00');

    it('accepts the slots from 7:00 to 21:00', () => {
      expect(isSlotInWindow('2026-10-22', 7, now)).toBe(true);
      expect(isSlotInWindow('2026-10-22', 21, now)).toBe(true);
    });

    it('rejects 6:00, before the opening, and 22:00, the closing', () => {
      expect(isSlotInWindow('2026-10-22', 6, now)).toBe(false);
      expect(isSlotInWindow('2026-10-22', 22, now)).toBe(false);
    });

    it('accepts the seventh day and rejects the eighth', () => {
      expect(isSlotInWindow('2026-10-27', 12, now)).toBe(true);
      expect(isSlotInWindow('2026-10-28', 12, now)).toBe(false);
    });

    it('rejects yesterday', () => {
      expect(isSlotInWindow('2026-10-20', 12, now)).toBe(false);
    });
  });

  describe('hasStarted', () => {
    it('is true from the first second of the slot', () => {
      expect(hasStarted('2026-10-21', 14, new Date('2026-10-21T14:00:00'))).toBe(true);
    });

    it('is false the second before', () => {
      expect(hasStarted('2026-10-21', 14, new Date('2026-10-21T13:59:59'))).toBe(false);
    });
  });
});
