import { describe, expect, it } from 'vitest';

import { normalizeActionItems, summaryText, type PockeyWebhookPayload } from './types';

describe('normalizeActionItems', () => {
  it('reads the MCP-style shape (label + payload.reminder.dueDateTime)', () => {
    const payload: PockeyWebhookPayload = {
      summarizations: {
        actionItems: [
          {
            actionItemId: 'a1',
            actionType: 'create_reminder',
            label: 'Eye appointment with Dr. McAdams',
            context: 'contact lens prescription',
            payload: { reminder: { title: 'Eye appt', dueDateTime: '2026-08-04T11:15:00' } },
          },
        ],
      },
    };
    expect(normalizeActionItems(payload)).toEqual([
      {
        id: 'a1',
        actionType: 'create_reminder',
        title: 'Eye appointment with Dr. McAdams',
        context: 'contact lens prescription',
        due: '2026-08-04T11:15:00',
      },
    ]);
  });

  it('reads the webhook-doc shape (title + dueDate) from the top-level array', () => {
    const payload: PockeyWebhookPayload = {
      actionItems: [{ id: 'b2', type: 'create_reminder', title: 'Dentist', dueDate: '2026-09-01' }],
    };
    expect(normalizeActionItems(payload)).toEqual([
      { id: 'b2', actionType: 'create_reminder', title: 'Dentist', due: '2026-09-01' },
    ]);
  });

  it('skips items with no resolvable title', () => {
    const payload: PockeyWebhookPayload = {
      summarizations: { actionItems: [{ actionItemId: 'c3', dueDate: '2026-09-01' }] },
    };
    expect(normalizeActionItems(payload)).toEqual([]);
  });
});

describe('summaryText', () => {
  it('prefers markdown, falls back to summary', () => {
    expect(summaryText({ summarizations: { summaryMarkdown: '# md', summary: 'plain' } })).toBe('# md');
    expect(summaryText({ summarizations: { summary: 'plain' } })).toBe('plain');
    expect(summaryText({})).toBe('');
  });
});
