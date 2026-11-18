import type { AppConfig } from '../config';
import type { Logger } from '../lib/logger';

const PUBLIC_API_BASE = 'https://public.heypocketai.com/api/v1';

/**
 * Optional client for the Pockey Public API. Only used to fetch full transcript
 * text for the Claude fallback path. If no API key is configured, transcript
 * fetches resolve to undefined and callers fall back to the webhook summary.
 */
export class PockeyService {
  constructor(
    private readonly cfg: AppConfig,
    private readonly logger: Logger,
  ) {}

  get enabled(): boolean {
    return Boolean(this.cfg.pockeyApiKey);
  }

  async getTranscript(recordingId: string): Promise<string | undefined> {
    if (!this.cfg.pockeyApiKey) return undefined;
    try {
      const res = await fetch(`${PUBLIC_API_BASE}/public/recordings/${encodeURIComponent(recordingId)}`, {
        headers: { authorization: `Bearer ${this.cfg.pockeyApiKey}` },
      });
      if (!res.ok) {
        this.logger.warn({ status: res.status, recordingId }, 'Pockey transcript fetch failed');
        return undefined;
      }
      const body = (await res.json()) as unknown;
      return extractTranscriptText(body);
    } catch (err) {
      this.logger.warn({ err, recordingId }, 'Pockey transcript fetch errored');
      return undefined;
    }
  }
}

/**
 * The Public API response shape isn't strictly documented here, so pull text
 * from the most likely fields defensively rather than assuming one schema.
 */
function extractTranscriptText(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const data = ('data' in body ? (body as Record<string, unknown>).data : body) as Record<string, unknown>;
  if (!data || typeof data !== 'object') return undefined;

  const candidates = [data.transcript, data.transcriptText, data.text, data.notes, data.summary];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
  }
  // Segment arrays: [{ text }, ...]
  const segments = data.segments ?? data.transcriptSegments;
  if (Array.isArray(segments)) {
    const joined = segments
      .map((s) => (s && typeof s === 'object' ? (s as Record<string, unknown>).text : undefined))
      .filter((t): t is string => typeof t === 'string')
      .join(' ')
      .trim();
    if (joined) return joined;
  }
  return undefined;
}
