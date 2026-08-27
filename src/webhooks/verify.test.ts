import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verifySignature } from './verify';

const secret = 'test-secret';
const rawBody = JSON.stringify({ event: 'summary.completed', recording: { id: 'r1' } });

function sign(ts: string, body: string, key = secret): string {
  return createHmac('sha256', key).update(`${ts}.${body}`).digest('hex');
}

describe('verifySignature', () => {
  const now = 1_700_000_000_000;
  const ts = String(now);

  it('accepts a valid bare-hex signature', () => {
    const res = verifySignature({
      rawBody,
      signatureHeader: sign(ts, rawBody),
      timestampHeader: ts,
      secret,
      maxSkewSeconds: 300,
      now,
    });
    expect(res.ok).toBe(true);
  });

  it('accepts the "HMAC-SHA256 <hex>" header form', () => {
    const res = verifySignature({
      rawBody,
      signatureHeader: `HMAC-SHA256 ${sign(ts, rawBody)}`,
      timestampHeader: ts,
      secret,
      maxSkewSeconds: 300,
      now,
    });
    expect(res.ok).toBe(true);
  });

  it('rejects a signature made with the wrong secret', () => {
    const res = verifySignature({
      rawBody,
      signatureHeader: sign(ts, rawBody, 'wrong'),
      timestampHeader: ts,
      secret,
      maxSkewSeconds: 300,
      now,
    });
    expect(res).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a tampered body', () => {
    const res = verifySignature({
      rawBody: rawBody + ' ',
      signatureHeader: sign(ts, rawBody),
      timestampHeader: ts,
      secret,
      maxSkewSeconds: 300,
      now,
    });
    expect(res).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a stale timestamp', () => {
    const staleTs = String(now - 10 * 60 * 1000); // 10 minutes old
    const res = verifySignature({
      rawBody,
      signatureHeader: sign(staleTs, rawBody),
      timestampHeader: staleTs,
      secret,
      maxSkewSeconds: 300,
      now,
    });
    expect(res).toEqual({ ok: false, reason: 'stale_timestamp' });
  });

  it('rejects missing headers', () => {
    const res = verifySignature({
      rawBody,
      signatureHeader: undefined,
      timestampHeader: ts,
      secret,
      maxSkewSeconds: 300,
      now,
    });
    expect(res).toEqual({ ok: false, reason: 'missing_headers' });
  });
});
