import { isAllDay } from '../lib/datetime';
import type { Appointment } from '../services/google';
import type { NormalizedActionItem } from '../webhooks/types';
import type { Handler, HandlerContext, HandlerResult } from './types';

const HANDLER_NAME = 'calendar';

/**
 * Turns dictated appointments into Google Calendar events.
 *
 * Two input sources (union'd, then deduped):
 *   1. Auto path (Hybrid posture): Pockey `create_reminder` action items that
 *      carry a concrete due time, gated by the autoPromote* config flags.
 *   2. Trigger-word path: if a calendar trigger phrase was spoken but produced
 *      no structured action item, Claude extracts appointment(s) from the text
 *      (only when an Anthropic key is configured).
 */
export const calendarHandler: Handler = {
  name: HANDLER_NAME,

  canHandle(ctx: HandlerContext): boolean {
    const triggered = HANDLER_NAME in ctx.matchedTriggers;
    return triggered || appointmentsFromActionItems(ctx).length > 0;
  },

  async run(ctx: HandlerContext): Promise<HandlerResult> {
    const result: HandlerResult = { handler: HANDLER_NAME, created: 0, skipped: 0, errors: 0 };
    const log = ctx.logger.child({ handler: HANDLER_NAME, recordingId: ctx.recording.id });

    const appointments = new Map<string, Appointment>();

    // 1. From structured action items.
    for (const appt of appointmentsFromActionItems(ctx)) {
      appointments.set(dedupeKey(ctx.recording.id, appt), appt);
    }

    // 2. Trigger-word fallback via Claude (only if a phrase was spoken and no
    //    structured appointment already covers this recording).
    if (HANDLER_NAME in ctx.matchedTriggers && appointments.size === 0) {
      if (ctx.services.extractor.enabled) {
        const text = await ctx.getText();
        const recordingDate = ctx.recording.createdAt ?? new Date().toISOString();
        const extracted = await ctx.services.extractor.extractAppointments(text, recordingDate);
        for (const appt of extracted) {
          appointments.set(dedupeKey(ctx.recording.id, appt), appt);
        }
        log.info({ count: extracted.length }, 'Extracted appointments from text');
      } else {
        log.warn('Calendar trigger phrase matched but no structured appointment and no ANTHROPIC_API_KEY set');
      }
    }

    for (const [key, appt] of appointments) {
      if (ctx.store.hasProcessed(key)) {
        result.skipped += 1;
        await ctx.store.record({
          at: new Date().toISOString(),
          recordingId: ctx.recording.id,
          handler: HANDLER_NAME,
          dedupeKey: key,
          summary: appt.title,
          result: 'skipped',
          detail: 'already processed',
        });
        continue;
      }

      try {
        const event = await ctx.services.calendar.createEvent(appt);
        result.created += 1;
        log.info({ eventId: event.id, title: appt.title, due: appt.due }, 'Created calendar event');
        await ctx.store.record({
          at: new Date().toISOString(),
          recordingId: ctx.recording.id,
          handler: HANDLER_NAME,
          dedupeKey: key,
          summary: appt.title,
          result: 'created',
          detail: event.htmlLink ?? event.id,
        });
      } catch (err) {
        result.errors += 1;
        log.error({ err, title: appt.title }, 'Failed to create calendar event');
        await ctx.store.record({
          at: new Date().toISOString(),
          recordingId: ctx.recording.id,
          handler: HANDLER_NAME,
          dedupeKey: key,
          summary: appt.title,
          result: 'error',
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  },
};

/** Build appointments from qualifying reminder action items, per config flags. */
function appointmentsFromActionItems(ctx: HandlerContext): Appointment[] {
  const cfg = ctx.triggers.calendar;
  const forcedByTrigger = HANDLER_NAME in ctx.matchedTriggers;
  const out: Appointment[] = [];

  for (const item of ctx.actionItems) {
    if (!isReminder(item) || !item.due) continue;

    const allDay = isAllDay(item.due);
    // A spoken trigger phrase forces promotion regardless of the auto flags.
    const allow = forcedByTrigger
      ? true
      : allDay
        ? cfg.autoPromoteAllDayReminders
        : cfg.autoPromoteTimedReminders;
    if (!allow) continue;

    out.push({
      title: item.title,
      due: item.due,
      ...(item.context ? { notes: item.context } : {}),
    });
  }
  return out;
}

function isReminder(item: NormalizedActionItem): boolean {
  return item.actionType === 'create_reminder' || item.actionType === 'unknown';
}

/** Stable key so at-least-once redelivery never creates a duplicate event. */
function dedupeKey(recordingId: string, appt: Appointment): string {
  const title = appt.title.toLowerCase().replace(/\s+/g, ' ').trim();
  const when = isAllDay(appt.due) ? appt.due.slice(0, 10) : appt.due.trim();
  return `${HANDLER_NAME}:${recordingId}:${title}:${when}`;
}
