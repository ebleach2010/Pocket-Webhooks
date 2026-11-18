/**
 * Send a correctly-signed sample Pockey webhook to a locally-running server,
 * for end-to-end testing without Pockey.
 *
 *   npm run dev                 # in one terminal
 *   npm run send-test-webhook   # in another
 *
 * Flags:
 *   --trigger   Send a summary containing a calendar trigger phrase and NO
 *               structured action item (exercises the Claude fallback path;
 *               requires ANTHROPIC_API_KEY on the server).
 *
 * Re-run it to confirm idempotency: the second delivery should be "skipped".
 */
import { createHmac } from 'node:crypto';

import { config as loadEnv } from 'dotenv';

loadEnv();

function daysFromNow(days: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  // Naive local wall-clock, matching Pockey's un-zoned format.
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(hour)}:${p(minute)}:00`;
}

function buildPayload(useTrigger: boolean): unknown {
  const recording = {
    id: `test-rec-${useTrigger ? 'trigger' : 'auto'}-fixed`,
    title: useTrigger ? 'Dinner reservation note' : 'Schedule visit for contact prescription',
    createdAt: new Date().toISOString(),
    language: 'English',
  };

  if (useTrigger) {
    return {
      event: 'summary.completed',
      timestamp: new Date().toISOString(),
      recording,
      summarizations: {
        summary:
          'Eric said: add to my calendar dinner with Ariel at Chandler\'s ' +
          `tomorrow at 8 PM. (${daysFromNow(1, 20, 0)})`,
        actionItems: [],
      },
    };
  }

  return {
    event: 'summary.completed',
    timestamp: new Date().toISOString(),
    recording,
    summarizations: {
      summary: 'Eric scheduled an eye appointment for a new contact lens prescription.',
      actionItems: [
        {
          actionItemId: 'test-appt-1',
          actionType: 'create_reminder',
          label: 'Eye appointment with Dr. McAdams',
          context: 'Eye appointment for a new contact lens prescription.',
          payload: {
            reminder: {
              title: 'Eye appointment with Dr. McAdams for contact lens prescription',
              dueDateTime: daysFromNow(3, 11, 15),
            },
          },
        },
      ],
    },
  };
}

async function main(): Promise<void> {
  const secret = process.env.POCKEY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('POCKEY_WEBHOOK_SECRET must be set (same value the server uses).');
    process.exit(1);
  }
  const port = process.env.PORT ?? '3000';
  const url = `http://localhost:${port}/webhooks/pockey`;
  const useTrigger = process.argv.includes('--trigger');

  const rawBody = JSON.stringify(buildPayload(useTrigger));
  const timestamp = String(Date.now());
  const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-heypocket-signature': `HMAC-SHA256 ${signature}`,
      'x-heypocket-timestamp': timestamp,
    },
    body: rawBody,
  });

  console.log(`POST ${url} → ${res.status}`);
  console.log(await res.text());
  console.log(
    '\nCheck the server logs for the created event, then GET ' +
      `http://localhost:${port}/audit to see the audit trail.`,
  );
}

void main();
