import Fastify, { type FastifyInstance } from 'fastify';

import type { AppConfig } from './config';
import type { Pipeline } from './pipeline';
import type { Store } from './services/store';
import { registerPockeyWebhook } from './webhooks/pockey';

interface BuildOpts {
  config: AppConfig;
  pipeline: Pipeline;
  store: Store;
}

export function buildServer(opts: BuildOpts): FastifyInstance {
  const app = Fastify({
    logger: { level: opts.config.logLevel },
    // Trust proxy so client info is correct behind Cloud Run / Railway / etc.
    trustProxy: true,
  });

  // Capture the raw JSON body (needed for HMAC verification) and hand the route
  // the raw string as the body; the route parses it itself.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    req.rawBody = typeof body === 'string' ? body : body.toString('utf8');
    done(null, req.rawBody);
  });

  app.get('/healthz', async () => ({ ok: true }));

  app.get('/audit', async () => ({ entries: opts.store.recentAudit(50) }));

  registerPockeyWebhook(app, { config: opts.config, pipeline: opts.pipeline });

  return app;
}
