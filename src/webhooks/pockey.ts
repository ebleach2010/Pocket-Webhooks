import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AppConfig } from '../config';
import type { Pipeline } from '../pipeline';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifySignature } from './verify';
import type { PockeyWebhookPayload } from './types';

interface RegisterOpts {
  config: AppConfig;
  pipeline: Pipeline;
}

/**
 * POST /webhooks/pockey — verify the HMAC signature against the raw body, then
 * acknowledge immediately (200) and process asynchronously so slow Google /
 * Claude calls never trip Pockey's 30s delivery timeout and trigger retries.
 */
export function registerPockeyWebhook(app: FastifyInstance, opts: RegisterOpts): void {
  app.post('/webhooks/pockey', async (req: FastifyRequest, reply: FastifyReply) => {
    const rawBody = (req.rawBody ?? '') as string;

    const verdict = verifySignature({
      rawBody,
      signatureHeader: header(req, SIGNATURE_HEADER),
      timestampHeader: header(req, TIMESTAMP_HEADER),
      secret: opts.config.pockeyWebhookSecret,
      maxSkewSeconds: opts.config.webhookMaxSkewSeconds,
    });

    if (!verdict.ok) {
      req.log.warn({ reason: verdict.reason }, 'Rejected Pockey webhook');
      return reply.code(401).send({ ok: false, error: verdict.reason });
    }

    let payload: PockeyWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as PockeyWebhookPayload;
    } catch {
      return reply.code(400).send({ ok: false, error: 'invalid_json' });
    }

    // Acknowledge first, then do the work.
    reply.code(200).send({ ok: true });

    setImmediate(() => {
      opts.pipeline
        .process(payload)
        .then((results) => {
          if (results.length > 0) {
            req.log.info({ event: payload.event, results }, 'Processed Pockey webhook');
          }
        })
        .catch((err) => {
          req.log.error({ err, event: payload.event }, 'Failed processing Pockey webhook');
        });
    });
  });
}

function header(req: FastifyRequest, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}
