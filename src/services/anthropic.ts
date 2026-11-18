import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import type { AppConfig } from '../config';
import type { Logger } from '../lib/logger';
import type { Appointment } from './google';

const extractionSchema = z.object({
  appointments: z
    .array(
      z.object({
        title: z.string().min(1),
        // Naive local wall-clock "YYYY-MM-DDTHH:MM:SS", or a date "YYYY-MM-DD"
        // for all-day. The model is told to resolve relative times against the
        // recording date + timezone we pass in.
        due: z.string().min(1),
        location: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .default([]),
});

/**
 * Optional appointment extractor. Used only when a calendar trigger phrase was
 * spoken but Pockey produced no structured action item — we ask Claude to pull
 * appointment(s) out of the free-text summary/transcript. Disabled (no-op) when
 * ANTHROPIC_API_KEY is not set.
 */
export class AnthropicExtractor {
  private readonly client: Anthropic | undefined;
  private readonly model: string;

  constructor(
    private readonly cfg: AppConfig,
    private readonly logger: Logger,
  ) {
    this.model = cfg.anthropic.model;
    this.client = cfg.anthropic.apiKey ? new Anthropic({ apiKey: cfg.anthropic.apiKey }) : undefined;
  }

  get enabled(): boolean {
    return Boolean(this.client);
  }

  async extractAppointments(text: string, recordingDateIso: string): Promise<Appointment[]> {
    if (!this.client) return [];
    if (!text.trim()) return [];

    const system =
      'You extract calendar appointments from a voice-note transcript or summary. ' +
      'Return ONLY appointments that represent a scheduled event at a specific date/time ' +
      '(meetings, doctor visits, calls, reservations). Ignore vague to-dos and reminders ' +
      'without a clear time. Resolve relative times ("tomorrow", "next Tuesday at 3") ' +
      `against the recording date ${recordingDateIso} in timezone ${this.cfg.timezone}. ` +
      'Output each "due" as a naive local wall-clock timestamp "YYYY-MM-DDTHH:MM:SS" ' +
      '(or a date "YYYY-MM-DD" for an all-day item). Do not include a timezone offset. ' +
      'Respond with a single JSON object and nothing else: ' +
      '{"appointments":[{"title","due","location"?,"notes"?}]}. ' +
      'If there are no clear appointments, return {"appointments":[]}.';

    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system,
        messages: [{ role: 'user', content: text }],
      });

      // `refusal` may not be in older SDK stop_reason unions; compare as string.
      if ((res.stop_reason as string | null) === 'refusal') {
        this.logger.warn('Claude refused appointment extraction');
        return [];
      }

      const jsonText = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();

      const parsed = extractionSchema.safeParse(JSON.parse(stripJsonFence(jsonText)));
      if (!parsed.success) {
        this.logger.warn({ issues: parsed.error.issues }, 'Claude extraction failed schema validation');
        return [];
      }
      return parsed.data.appointments;
    } catch (err) {
      this.logger.warn({ err }, 'Claude appointment extraction errored');
      return [];
    }
  }
}

/** Tolerate a ```json fenced``` reply even though we ask for raw JSON. */
function stripJsonFence(s: string): string {
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(s.trim());
  return fence?.[1] ?? s;
}
