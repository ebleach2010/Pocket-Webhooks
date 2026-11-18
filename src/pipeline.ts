import type { AppConfig } from './config';
import type { Handler, HandlerContext, HandlerResult } from './handlers/types';
import { triggerPhrasesByHandler } from './handlers/registry';
import type { Logger } from './lib/logger';
import type { AnthropicExtractor } from './services/anthropic';
import type { GoogleCalendarService } from './services/google';
import type { PockeyService } from './services/pockey';
import type { Store } from './services/store';
import type { TriggerConfig } from './triggers/config';
import { matchTriggers } from './triggers/engine';
import { normalizeActionItems, summaryText, type PockeyWebhookPayload } from './webhooks/types';

/** Webhook events we act on. Others are acknowledged and ignored. */
const HANDLED_EVENTS = new Set(['summary.completed', 'action_items.regenerated']);

export interface PipelineDeps {
  config: AppConfig;
  triggers: TriggerConfig;
  logger: Logger;
  store: Store;
  handlers: Handler[];
  services: {
    calendar: GoogleCalendarService;
    pockey: PockeyService;
    extractor: AnthropicExtractor;
  };
}

export interface Pipeline {
  process(payload: PockeyWebhookPayload): Promise<HandlerResult[]>;
}

export function createPipeline(deps: PipelineDeps): Pipeline {
  const phrasesByHandler = triggerPhrasesByHandler({ calendar: deps.triggers.calendar.triggerPhrases });

  return {
    async process(payload: PockeyWebhookPayload): Promise<HandlerResult[]> {
      const event = payload.event ?? '';
      if (event && !HANDLED_EVENTS.has(event)) {
        deps.logger.debug({ event }, 'Ignoring unhandled event type');
        return [];
      }

      const recording = payload.recording;
      if (!recording?.id) {
        deps.logger.warn('Webhook payload missing recording.id; skipping');
        return [];
      }

      const summary = summaryText(payload);
      const actionItems = normalizeActionItems(payload);

      // Fetch fuller transcript once (Public API), if configured. Used for both
      // trigger matching and the Claude extraction fallback.
      const transcript = await deps.services.pockey.getTranscript(recording.id);
      const matchText = [summary, transcript].filter(Boolean).join('\n');
      const matchedTriggers = matchTriggers(matchText, phrasesByHandler);

      let cachedText: string | undefined;
      const getText = async (): Promise<string> => {
        if (cachedText === undefined) cachedText = transcript ?? summary;
        return cachedText;
      };

      const ctx: HandlerContext = {
        event,
        recording,
        actionItems,
        summary,
        matchedTriggers,
        getText,
        config: deps.config,
        triggers: deps.triggers,
        logger: deps.logger,
        store: deps.store,
        services: deps.services,
      };

      const results: HandlerResult[] = [];
      for (const handler of deps.handlers) {
        if (!handler.canHandle(ctx)) continue;
        try {
          results.push(await handler.run(ctx));
        } catch (err) {
          deps.logger.error({ err, handler: handler.name, recordingId: recording.id }, 'Handler threw');
          results.push({ handler: handler.name, created: 0, skipped: 0, errors: 1 });
        }
      }
      return results;
    },
  };
}
