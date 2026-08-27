import { calendarHandler } from './calendar';
import type { Handler } from './types';

/**
 * The set of active handlers. Adding a new automation (Gmail draft, text draft,
 * journal) is a new file exporting a `Handler` plus one entry here — the webhook
 * pipeline, verification, and trigger engine are untouched.
 */
export const handlers: Handler[] = [calendarHandler];

/** Trigger phrases keyed by handler name, sourced from each handler's config. */
export function triggerPhrasesByHandler(phrases: { calendar: string[] }): Record<string, string[]> {
  return {
    calendar: phrases.calendar,
  };
}
