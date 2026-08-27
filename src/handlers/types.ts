import type { AppConfig } from '../config';
import type { Logger } from '../lib/logger';
import type { AnthropicExtractor } from '../services/anthropic';
import type { GoogleCalendarService } from '../services/google';
import type { PockeyService } from '../services/pockey';
import type { Store } from '../services/store';
import type { TriggerConfig } from '../triggers/config';
import type { NormalizedActionItem, PockeyRecording } from '../webhooks/types';

/** Everything a handler needs to decide and act on one webhook delivery. */
export interface HandlerContext {
  event: string;
  recording: PockeyRecording;
  actionItems: NormalizedActionItem[];
  summary: string;
  /** Handler name -> matched trigger phrases (from the trigger engine). */
  matchedTriggers: Record<string, string[]>;
  /** Lazily fetch fuller transcript text (Public API), else the summary. */
  getText: () => Promise<string>;

  config: AppConfig;
  triggers: TriggerConfig;
  logger: Logger;
  store: Store;
  services: {
    calendar: GoogleCalendarService;
    pockey: PockeyService;
    extractor: AnthropicExtractor;
  };
}

export interface HandlerResult {
  handler: string;
  created: number;
  skipped: number;
  errors: number;
}

export interface Handler {
  readonly name: string;
  canHandle(ctx: HandlerContext): boolean;
  run(ctx: HandlerContext): Promise<HandlerResult>;
}
