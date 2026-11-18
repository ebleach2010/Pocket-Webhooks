/**
 * Pockey webhook payload types.
 *
 * The webhook envelope carries `event`, `timestamp`, `user`, `recording`, and
 * `summarizations` (summary markdown + action items). The exact action-item
 * shape varies between the webhook payload and the Public API, so we parse
 * loosely and normalize (see `normalizeActionItems`).
 */

export interface PockeyRecording {
  id: string;
  title?: string;
  duration?: number;
  language?: string;
  createdAt?: string;
}

/** Raw action item as it may appear in either the webhook or the Public API. */
export interface RawActionItem {
  actionItemId?: string;
  id?: string;
  globalActionItemId?: string;
  actionType?: string;
  type?: string;
  label?: string;
  title?: string;
  context?: string;
  dueDate?: string | null;
  dueDateTime?: string | null;
  status?: string;
  isCompleted?: boolean;
  payload?: {
    reminder?: { title?: string; dueDateTime?: string | null } | null;
    email?: unknown;
    message?: unknown;
  } | null;
}

export interface PockeyWebhookPayload {
  event?: string;
  timestamp?: string;
  user?: { id?: string; email?: string } | null;
  recording?: PockeyRecording | null;
  summarizations?: {
    summary?: string | null;
    summaryMarkdown?: string | null;
    actionItems?: RawActionItem[] | null;
  } | null;
  actionItems?: RawActionItem[] | null;
}

/** A normalized action item with the fields the handlers actually use. */
export interface NormalizedActionItem {
  id: string;
  actionType: string;
  title: string;
  context?: string;
  /** Best available due time (naive, absolute, or date-only), if any. */
  due?: string;
  status?: string;
}

/** Pull action items from wherever Pockey put them and normalize each one. */
export function normalizeActionItems(payload: PockeyWebhookPayload): NormalizedActionItem[] {
  const raw = payload.summarizations?.actionItems ?? payload.actionItems ?? [];
  const items: NormalizedActionItem[] = [];

  for (const r of raw) {
    const title = firstNonEmpty(r.title, r.label, r.payload?.reminder?.title);
    if (!title) continue;

    const due = firstNonEmpty(
      r.payload?.reminder?.dueDateTime ?? undefined,
      r.dueDateTime ?? undefined,
      r.dueDate ?? undefined,
    );

    items.push({
      id: firstNonEmpty(r.actionItemId, r.id, r.globalActionItemId) ?? title,
      actionType: firstNonEmpty(r.actionType, r.type) ?? 'unknown',
      title,
      ...(r.context ? { context: r.context } : {}),
      ...(due ? { due } : {}),
      ...(r.status ? { status: r.status } : {}),
    });
  }
  return items;
}

/** Summary text from whichever field Pockey populated. */
export function summaryText(payload: PockeyWebhookPayload): string {
  return firstNonEmpty(payload.summarizations?.summaryMarkdown, payload.summarizations?.summary) ?? '';
}

function firstNonEmpty(...vals: Array<string | null | undefined>): string | undefined {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return undefined;
}
