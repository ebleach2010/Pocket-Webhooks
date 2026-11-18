import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Appointment } from '../services/google';
import type { NormalizedActionItem } from '../webhooks/types';
import { calendarHandler } from './calendar';
import type { HandlerContext } from './types';

const silentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child() {
    return this;
  },
};

function makeStore() {
  const processed = new Set<string>();
  return {
    hasProcessed: (k: string) => processed.has(k),
    record: vi.fn(async (e: { dedupeKey: string; result: string }) => {
      if (e.result === 'created') processed.add(e.dedupeKey);
    }),
    recentAudit: () => [],
  };
}

function makeCtx(opts: {
  actionItems?: NormalizedActionItem[];
  matchedTriggers?: Record<string, string[]>;
  autoPromoteTimedReminders?: boolean;
  autoPromoteAllDayReminders?: boolean;
  store?: ReturnType<typeof makeStore>;
  createEvent?: (a: Appointment) => Promise<{ id: string }>;
  extractorEnabled?: boolean;
  extractAppointments?: (text: string, date: string) => Promise<Appointment[]>;
}): HandlerContext {
  const store = opts.store ?? makeStore();
  const ctx = {
    event: 'summary.completed',
    recording: { id: 'rec-1', createdAt: '2026-07-30T12:00:00.000Z' },
    actionItems: opts.actionItems ?? [],
    summary: 'summary text',
    matchedTriggers: opts.matchedTriggers ?? {},
    getText: async () => 'summary text',
    config: { timezone: 'America/Boise' },
    triggers: {
      calendar: {
        triggerPhrases: [],
        autoPromoteTimedReminders: opts.autoPromoteTimedReminders ?? true,
        autoPromoteAllDayReminders: opts.autoPromoteAllDayReminders ?? false,
      },
    },
    logger: silentLogger,
    store,
    services: {
      calendar: { createEvent: vi.fn(opts.createEvent ?? (async () => ({ id: 'evt-1' }))) },
      pockey: { enabled: false, getTranscript: async () => undefined },
      extractor: {
        enabled: opts.extractorEnabled ?? false,
        extractAppointments: vi.fn(opts.extractAppointments ?? (async () => [])),
      },
    },
  };
  return ctx as unknown as HandlerContext;
}

const timedReminder: NormalizedActionItem = {
  id: 'a1',
  actionType: 'create_reminder',
  title: 'Eye appointment with Dr. McAdams',
  due: '2026-08-04T11:15:00',
};

const allDayReminder: NormalizedActionItem = {
  id: 'a2',
  actionType: 'create_reminder',
  title: 'Clear out apartment items',
  due: '2026-07-30T00:00:00.000Z',
};

describe('calendarHandler.canHandle', () => {
  it('is true when a timed reminder can auto-promote', () => {
    expect(calendarHandler.canHandle(makeCtx({ actionItems: [timedReminder] }))).toBe(true);
  });

  it('is false for an all-day reminder when auto-promote-all-day is off and no trigger', () => {
    expect(calendarHandler.canHandle(makeCtx({ actionItems: [allDayReminder] }))).toBe(false);
  });

  it('is true when a calendar trigger phrase was matched', () => {
    expect(calendarHandler.canHandle(makeCtx({ matchedTriggers: { calendar: ['add to my calendar'] } }))).toBe(true);
  });
});

describe('calendarHandler.run', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates one event from a timed reminder', async () => {
    const ctx = makeCtx({ actionItems: [timedReminder] });
    const res = await calendarHandler.run(ctx);
    expect(res).toMatchObject({ created: 1, skipped: 0, errors: 0 });
    expect(ctx.services.calendar.createEvent).toHaveBeenCalledOnce();
  });

  it('does not create an event for an all-day reminder by default', async () => {
    const ctx = makeCtx({ actionItems: [allDayReminder] });
    const res = await calendarHandler.run(ctx);
    expect(res.created).toBe(0);
    expect(ctx.services.calendar.createEvent).not.toHaveBeenCalled();
  });

  it('promotes an all-day reminder when a trigger phrase forces it', async () => {
    const ctx = makeCtx({
      actionItems: [allDayReminder],
      matchedTriggers: { calendar: ['add to my calendar'] },
    });
    const res = await calendarHandler.run(ctx);
    expect(res.created).toBe(1);
  });

  it('is idempotent across redeliveries (second run is skipped)', async () => {
    const store = makeStore();
    const first = await calendarHandler.run(makeCtx({ actionItems: [timedReminder], store }));
    expect(first.created).toBe(1);
    const second = await calendarHandler.run(makeCtx({ actionItems: [timedReminder], store }));
    expect(second).toMatchObject({ created: 0, skipped: 1 });
  });

  it('uses Claude extraction when a trigger fires with no structured item', async () => {
    const extractAppointments = vi.fn(async () => [{ title: 'Dinner', due: '2026-08-01T20:00:00' }]);
    const ctx = makeCtx({
      matchedTriggers: { calendar: ['add to my calendar'] },
      extractorEnabled: true,
      extractAppointments,
    });
    const res = await calendarHandler.run(ctx);
    expect(extractAppointments).toHaveBeenCalledOnce();
    expect(res.created).toBe(1);
  });
});
