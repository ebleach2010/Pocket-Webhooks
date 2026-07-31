import { loadConfig } from './config';
import { handlers } from './handlers/registry';
import { logger } from './lib/logger';
import { createPipeline } from './pipeline';
import { buildServer } from './server';
import { AnthropicExtractor } from './services/anthropic';
import { GoogleCalendarService } from './services/google';
import { PockeyService } from './services/pockey';
import { Store } from './services/store';
import { loadTriggerConfig } from './triggers/config';

async function main(): Promise<void> {
  const config = loadConfig();
  const triggers = loadTriggerConfig();

  const store = new Store(config.storePath, logger);
  await store.init();

  const services = {
    calendar: new GoogleCalendarService(config),
    pockey: new PockeyService(config, logger),
    extractor: new AnthropicExtractor(config, logger),
  };

  const pipeline = createPipeline({ config, triggers, logger, store, handlers, services });
  const app = buildServer({ config, pipeline, store });

  logger.info(
    {
      calendarId: config.google.calendarId,
      timezone: config.timezone,
      pockeyPublicApi: services.pockey.enabled,
      claudeFallback: services.extractor.enabled,
      handlers: handlers.map((h) => h.name),
    },
    'Starting Pocket-Webhooks',
  );

  await app.listen({ port: config.port, host: '0.0.0.0' });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
