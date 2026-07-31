/**
 * Date/time helpers for turning Pockey's loosely-typed appointment times into
 * Google Calendar event start/end values.
 *
 * Pockey emits three broad shapes for a due time:
 *   - naive local wall-clock: "2026-08-04T11:15:00"          (no zone)
 *   - absolute instant:       "2026-07-30T00:00:00.000Z"     (UTC / offset)
 *   - date only:              "2026-08-04"
 *
 * We keep naive values "floating" and let Google apply the configured IANA
 * timezone (passing { dateTime, timeZone }). For absolute values we keep the
 * offset. Arithmetic on floating values is done in UTC purely to add minutes —
 * DST is never applied by us; Google interprets the wall-clock value in-zone.
 */

const NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HAS_ZONE_RE = /(?:Z|[+-]\d{2}:?\d{2})$/;

export interface EventTimes {
  allDay: boolean;
  /** For timed events: RFC3339-ish start/end (floating or with offset). */
  start: string;
  end: string;
}

/** True when the value carries an explicit UTC/offset (an absolute instant). */
export function isAbsolute(value: string): boolean {
  return HAS_ZONE_RE.test(value.trim());
}

/** The calendar date (YYYY-MM-DD) portion of any supported due-time string. */
export function datePart(value: string): string {
  const v = value.trim();
  const dateOnly = DATE_ONLY_RE.exec(v);
  if (dateOnly) return v;
  return v.slice(0, 10);
}

/**
 * Decide whether a due time represents an all-day item rather than a timed
 * appointment. Date-only strings and midnight instants are treated as all-day.
 */
export function isAllDay(value: string): boolean {
  const v = value.trim();
  if (DATE_ONLY_RE.test(v)) return true;
  // Midnight (00:00[:00][.000]) with or without a zone → treat as all-day.
  return /T00:00(?::00)?(?:\.0+)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(v);
}

/** Add `minutes` to a floating "YYYY-MM-DDTHH:MM:SS" wall-clock value. */
function addMinutesToNaive(naive: string, minutes: number): string {
  const m = NAIVE_RE.exec(naive.trim());
  if (!m) return naive;
  const [, y, mo, d, h, mi, s] = m;
  const base = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    s ? Number(s) : 0,
  );
  return formatNaive(new Date(base + minutes * 60_000));
}

/** Format a Date's UTC fields as a floating "YYYY-MM-DDTHH:MM:SS" string. */
function formatNaive(date: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())}` +
    `T${p(date.getUTCHours())}:${p(date.getUTCMinutes())}:${p(date.getUTCSeconds())}`
  );
}

/** The day after a YYYY-MM-DD date, as YYYY-MM-DD (all-day events are exclusive-end). */
export function nextDay(dateYmd: string): string {
  const [y, mo, d] = dateYmd.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (mo ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/**
 * Turn a raw due-time string into start/end values for a calendar event.
 * `durationMinutes` applies only to timed events.
 */
export function toEventTimes(due: string, durationMinutes: number): EventTimes {
  const value = due.trim();

  if (isAllDay(value)) {
    const day = datePart(value);
    return { allDay: true, start: day, end: nextDay(day) };
  }

  if (isAbsolute(value)) {
    const startMs = Date.parse(value);
    const end = new Date(startMs + durationMinutes * 60_000).toISOString();
    return { allDay: false, start: value, end };
  }

  // Floating wall-clock time.
  return { allDay: false, start: value, end: addMinutesToNaive(value, durationMinutes) };
}
