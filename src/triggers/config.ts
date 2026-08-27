import { readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

const calendarSchema = z.object({
  triggerPhrases: z.array(z.string()).default([]),
  autoPromoteTimedReminders: z.boolean().default(true),
  autoPromoteAllDayReminders: z.boolean().default(false),
});

const triggerConfigSchema = z.object({
  calendar: calendarSchema.default({}),
});

export type CalendarTriggerConfig = z.infer<typeof calendarSchema>;
export type TriggerConfig = z.infer<typeof triggerConfigSchema>;

const DEFAULT_PATH = path.resolve(process.cwd(), 'config', 'triggers.json');

/** Load and validate the trigger config. Falls back to schema defaults if the
 * file is missing so the service still runs (auto-promotion only). */
export function loadTriggerConfig(filePath: string = DEFAULT_PATH): TriggerConfig {
  let raw: unknown = {};
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  return triggerConfigSchema.parse(raw);
}
