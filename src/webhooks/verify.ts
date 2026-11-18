import { createHmac, timingSafeEqual } from 'node:crypto';

export const SIGNATURE_HEADER = 'x-heypocket-signature';
export const TIMESTAMP_HEADER = 'x-heypocket-timestamp';

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'missing_headers' | 'stale_timestamp' | 'bad_signature' };

/**
 * Verify a Pockey webhook delivery.
 *
 * Signature = HMAC-SHA256(secret, "{timestamp}.{rawBody}"), sent as
 * `X-HeyPocket-Signature` ("HMAC-SHA256 <hex>" or bare hex). `X-HeyPocket-Timestamp`
 * is a Unix time in milliseconds; we reject deliveries older than maxSkewSeconds
 * for replay protection. Comparison is timing-safe.
 */
export function verifySignature(params: {
  rawBody: string;
  signatureHeader: string | undefined;
  timestampHeader: string | undefined;
  secret: string;
  maxSkewSeconds: number;
  now?: number;
}): VerifyResult {
  const { rawBody, signatureHeader, timestampHeader, secret, maxSkewSeconds } = params;

  if (!signatureHeader || !timestampHeader) {
    return { ok: false, reason: 'missing_headers' };
  }

  const tsMs = Number(timestampHeader);
  if (!Number.isFinite(tsMs)) {
    return { ok: false, reason: 'missing_headers' };
  }
  const now = params.now ?? Date.now();
  if (Math.abs(now - tsMs) > maxSkewSeconds * 1000) {
    return { ok: false, reason: 'stale_timestamp' };
  }

  const expected = createHmac('sha256', secret).update(`${timestampHeader}.${rawBody}`).digest('hex');
  const provided = normalizeSignature(signatureHeader);

  if (!timingSafeHexEqual(expected, provided)) {
    return { ok: false, reason: 'bad_signature' };
  }
  return { ok: true };
}

/** Accept "HMAC-SHA256 <hex>", "sha256=<hex>", or a bare hex string. */
function normalizeSignature(header: string): string {
  const trimmed = header.trim();
  const spaced = trimmed.split(/\s+/);
  if (spaced.length === 2 && spaced[1]) return spaced[1].toLowerCase();
  const eq = trimmed.split('=');
  if (eq.length === 2 && eq[1]) return eq[1].toLowerCase();
  return trimmed.toLowerCase();
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}
