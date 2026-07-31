# Pocket-Webhooks

Trigger-word automations for **Pockey** (the [Pocket](https://heypocketai.com) AI voice recorder). This service receives Pockey webhooks, matches **trigger words** in your dictations, and turns them into real events.

**v1 does one thing:** scan dictated appointments and add them to **Google Calendar**. The codebase is built as a pluggable pipeline so email-draft, text-draft, and journal handlers can be added later without touching the core.

---

## How it works

```
Pockey ──HMAC-signed POST──▶ /webhooks/pockey
                                  │
                                  ▼
                verify signature (timing-safe) + reject stale timestamps
                                  ▼
                parse payload → normalize action items + summary
                                  ▼
                trigger engine (config/triggers.json)  ─▶ handler registry
                                  │                            │
                                  └─ Hybrid auto-promotion ────┤
                                                               ▼
                                                   Calendar handler → Google Calendar
                                  ▼
                 200 OK (acked immediately; work runs right after)
```

Pockey already extracts structured **action items** (reminders with a title + due time) from each recording and includes them in the `summary.completed` webhook. The calendar handler turns those into events. Two input paths:

1. **Auto path (Hybrid posture):** every reminder with a concrete *timed* due time becomes a calendar event automatically. All-day/date-only reminders are left alone by default (they're usually to-dos, not appointments).
2. **Trigger-word path:** if you say a phrase like *"add this to my calendar"* (configured in `config/triggers.json`) but Pockey produced no structured appointment, the service asks Claude to extract the appointment from the text. This path is **optional** and only runs when `ANTHROPIC_API_KEY` is set.

Every action is de-duplicated by `(recordingId, title, time)` in a small local store, so Pockey's at-least-once retries never double-book you.

---

## Prerequisites

- Node.js 20+ (22 recommended)
- A Google account with Google Calendar
- A Pockey account with webhook access (register a personal webhook in the app's Integrations UI)

---

## Setup

### 1. Install

```bash
npm install
cp .env.example .env
```

Fill in `.env` as you complete the steps below. All variables are documented in `.env.example`.

### 2. Google Calendar OAuth

1. In the [Google Cloud Console](https://console.cloud.google.com/): create a project, **enable the Google Calendar API**, and configure the **OAuth consent screen** (User type *External*, publishing status *Testing*, and add your own Google address as a **test user**).
2. Create an **OAuth client ID**. A *Desktop app* client is simplest; if you use a *Web application* client, add `http://localhost:3000/oauth2/callback` as an authorized redirect URI.
3. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.
4. Mint a refresh token:

   ```bash
   npm run google-auth
   ```

   Open the printed URL, approve access, and copy the `GOOGLE_REFRESH_TOKEN=…` line it prints into `.env`.

### 3. Pockey webhook

1. Deploy the service (see **Deploy**) so it has a public HTTPS URL, or expose your local server with a tunnel (`cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`).
2. In the Pockey app's **Integrations** UI, add a personal webhook pointing at `https://<your-host>/webhooks/pockey` and subscribe to **`summary.completed`** (and optionally `action_items.regenerated`).
3. Copy the signing secret Pockey shows you into `POCKEY_WEBHOOK_SECRET` in `.env`.

### 4. (Optional) Claude fallback + full transcripts

- Set `ANTHROPIC_API_KEY` to enable free-text appointment extraction for the trigger-word path. `ANTHROPIC_MODEL` defaults to `claude-opus-5`; you can point it at a cheaper model (e.g. `claude-sonnet-5` / `claude-haiku-4-5`) for this lightweight task.
- Set `POCKEY_API_KEY` (a `pk_…` Public API key) to let the service fetch full transcript text; without it, trigger matching and extraction use the webhook's summary text.

---

## Run

```bash
npm run dev     # watch mode (tsx)
# or
npm run build && npm start
```

Health check: `GET /healthz`. Recent activity: `GET /audit`.

---

## Test

Unit tests:

```bash
npm test
```

End-to-end, locally, without Pockey — start the server, then send a correctly-signed sample delivery:

```bash
npm run dev              # terminal 1
npm run send-test-webhook   # terminal 2  → creates a sample appointment
```

- Check the server logs and `GET http://localhost:3000/audit` for the created event.
- Run `npm run send-test-webhook` again — the second delivery should be **skipped** (idempotency).
- `npm run send-test-webhook -- --trigger` exercises the Claude fallback path (requires `ANTHROPIC_API_KEY`).

To verify against real Google Calendar, complete the OAuth setup and confirm the event appears on your calendar with the expected time and timezone.

---

## Configuration

- **Environment** — see `.env.example` (server, timezone, Pockey secret, Google creds, optional Claude/Public-API keys).
- **Timezone** — `TIMEZONE` (default `America/Boise`) is used to interpret dictated times that have no zone, e.g. `2026-08-04T11:15:00`.
- **Trigger words & promotion rules** — `config/triggers.json`:
  - `calendar.triggerPhrases` — phrases that force calendar creation.
  - `calendar.autoPromoteTimedReminders` (default `true`) — auto-create events for timed reminders.
  - `calendar.autoPromoteAllDayReminders` (default `false`) — auto-create all-day events for date-only reminders.

---

## Deploy

The service is a portable Node HTTP server; it needs an always-on public HTTPS endpoint.

```bash
docker build -t pocket-webhooks .
docker run -p 3000:3000 --env-file .env pocket-webhooks
```

Deploys cleanly to Cloud Run, Railway, Fly.io, Render, or any container host. Set the same environment variables there (as secrets), and register the deployed `/webhooks/pockey` URL in Pockey.

> **Note on the local store:** idempotency keys and the audit log live in a JSON file (`STORE_PATH`, default `data/store.json`). On ephemeral filesystems (e.g. Cloud Run) this resets on restart. For durable dedup across restarts, mount a persistent volume or swap `src/services/store.ts` for a shared store (SQLite/Redis) — the interface is small.

---

## Security notes

- Every delivery's HMAC-SHA256 signature is verified against the raw body before anything is processed; stale timestamps are rejected (replay protection).
- Secrets live only in environment variables and are never committed (`.env` is git-ignored).
- Transcript/summary content is your private data — it's only sent to Google (to create events) and, if you enable it, to Anthropic (for extraction).
- `npm audit` reports a moderate advisory in `uuid`, pulled in transitively by `googleapis`. It is not reachable through googleapis' usage (googleapis never passes the vulnerable `buf` argument), and the only `audit fix --force` upgrade swaps it for a *worse* high-severity chain, so it's intentionally left pinned pending an upstream googleapis release.

---

## Extending (future handlers)

Each new automation is a file in `src/handlers/` exporting a `Handler` plus one entry in `src/handlers/registry.ts` and its phrases in `config/triggers.json` — the webhook, verification, and trigger engine are untouched. Planned:

- **Email drafts** → Gmail `drafts.create` (Pockey already emits `draft_email` action items).
- **Text messages** → draft-for-review handler.
- **Journal** → Claude cleanup (strip filler/repeats, fix mistranscriptions) then append a dated entry to a Google Doc.
