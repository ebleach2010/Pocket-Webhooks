import { describe, expect, it } from 'vitest';

import { isAllDay, nextDay, toEventTimes } from './datetime';

describe('isAllDay', () => {
  it('treats date-only and midnight as all-day', () => {
    expect(isAllDay('2026-08-04')).toBe(true);
    expect(isAllDay('2026-08-04T00:00:00')).toBe(true);
    expect(isAllDay('2026-07-30T00:00:00.000Z')).toBe(true);
  });
  it('treats a real time-of-day as timed', () => {
    expect(isAllDay('2026-08-04T09:00:00')).toBe(false);
    expect(isAllDay('2026-07-30T15:00:00.000Z')).toBe(false);
  });
});

describe('toEventTimes', () => {
  it('maps a naive timed value and adds the default duration', () => {
    expect(toEventTimes('2026-08-04T11:15:00', 60)).toEqual({
      allDay: false,
      start: '2026-08-04T11:15:00',
      end: '2026-08-04T12:15:00',
    });
  });

  it('rolls over to the next day when adding duration crosses midnight', () => {
    expect(toEventTimes('2026-08-04T23:30:00', 60)).toEqual({
      allDay: false,
      start: '2026-08-04T23:30:00',
      end: '2026-08-05T00:30:00',
    });
  });

  it('treats a midnight UTC instant as an all-day event', () => {
    expect(toEventTimes('2026-07-30T00:00:00.000Z', 60)).toEqual({
      allDay: true,
      start: '2026-07-30',
      end: '2026-07-31',
    });
  });

  it('keeps an absolute non-midnight instant as timed', () => {
    const res = toEventTimes('2026-07-30T15:00:00.000Z', 60);
    expect(res.allDay).toBe(false);
    expect(res.start).toBe('2026-07-30T15:00:00.000Z');
    expect(res.end).toBe('2026-07-30T16:00:00.000Z');
  });

  it('maps a date-only value to an all-day event', () => {
    expect(toEventTimes('2026-08-04', 60)).toEqual({
      allDay: true,
      start: '2026-08-04',
      end: '2026-08-05',
    });
  });
});

describe('nextDay', () => {
  it('handles month rollover', () => {
    expect(nextDay('2026-08-31')).toBe('2026-09-01');
  });
});
