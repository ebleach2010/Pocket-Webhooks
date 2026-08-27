/**
 * The trigger engine finds which handlers a recording activates by scanning its
 * text for configured trigger phrases. This is the "trigger words" mechanism:
 * config maps phrases -> handler, and any phrase present in the summary or
 * transcript activates that handler.
 *
 * Handlers may ALSO activate without a trigger phrase (e.g. the calendar
 * handler auto-promotes timed reminders under the Hybrid posture) — that logic
 * lives in the handler's `canHandle`, not here.
 */

export interface PhraseMatch {
  handler: string;
  phrases: string[];
}

export function matchTriggers(
  text: string,
  phrasesByHandler: Record<string, string[]>,
): Record<string, string[]> {
  const haystack = normalize(text);
  const result: Record<string, string[]> = {};

  for (const [handler, phrases] of Object.entries(phrasesByHandler)) {
    const hits = phrases.filter((p) => haystack.includes(normalize(p)));
    if (hits.length > 0) result[handler] = hits;
  }
  return result;
}

/** Lowercase and collapse whitespace/punctuation so "calendar, this!" matches "calendar this". */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
