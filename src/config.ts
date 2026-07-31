import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const schema = z.object({
  port: z.coerce.number().int().positive().default(3000),
  logLevel: z.string().default('info'),
  timezone: z.string().min(1).default('America/Boise'),

  pockeyWebhookSecret: z.string().min(1, 'POCKEY_WEBHOOK_SECRET is required'),
  pockeyApiKey: z.string().optional(),
  webhookMaxSkewSeconds: z.coerce.number().int().positive().default(300),

  google: z.object({
    clientId: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
    clientSecret: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
    refreshToken: z.string().min(1, 'GOOGLE_REFRESH_TOKEN is required'),
    redirectUri: z.string().default('http://localhost:3000/oauth2/callback'),
    calendarId: z.string().default('primary'),
    defaultEventDurationMinutes: z.coerce.number().int().positive().default(60),
  }),

  anthropic: z.object({
    apiKey: z.string().optional(),
    model: z.string().default('claude-opus-5'),
  }),

  storePath: z.string().default('data/store.json'),
});

export type AppConfig = z.infer<typeof schema>;

/**
 * Parse and validate configuration from the environment.
 *
 * `requireGoogle` is false for tooling that doesn't need Calendar creds (e.g.
 * the OAuth-minting script), which supplies its own client id/secret directly.
 */
export function loadConfig(opts: { requireGoogle?: boolean } = {}): AppConfig {
  const requireGoogle = opts.requireGoogle ?? true;

  const raw = {
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    timezone: process.env.TIMEZONE,
    pockeyWebhookSecret: process.env.POCKEY_WEBHOOK_SECRET,
    pockeyApiKey: emptyToUndefined(process.env.POCKEY_API_KEY),
    webhookMaxSkewSeconds: process.env.WEBHOOK_MAX_SKEW_SECONDS,
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? (requireGoogle ? undefined : 'unset'),
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? (requireGoogle ? undefined : 'unset'),
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? (requireGoogle ? undefined : 'unset'),
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      defaultEventDurationMinutes: process.env.DEFAULT_EVENT_DURATION_MINUTES,
    },
    anthropic: {
      apiKey: emptyToUndefined(process.env.ANTHROPIC_API_KEY),
      model: process.env.ANTHROPIC_MODEL,
    },
    storePath: process.env.STORE_PATH,
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${issues}\n\nSee .env.example for the full list.`);
  }
  return parsed.data;
}

function emptyToUndefined(v: string | undefined): string | undefined {
  return v && v.trim() !== '' ? v : undefined;
}
