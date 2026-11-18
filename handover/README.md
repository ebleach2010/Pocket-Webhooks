# Pocket Advocate: handover

Written 2026-11-18 for whoever picks this project up next. Read this file first, then `STATUS.md`, then `RULES.md`.

Nothing in this package is a secret. No passwords, keys, tokens, client names or private email addresses are in it, and none should ever be pasted into a chat.

## What this is

Pocket Advocate is a small US patient advocacy practice run by Eric (the owner) with his wife Arielle as a partner contractor. The product is one web app, used three ways:

- **Public site**: the landing page, service pages, booking.
- **Client app**: a client's case (Progress, Chat, Docs, More).
- **Staff app**: Today, Cases, Inbox, Team, Me, plus an owner-only "shield" page. Contractors see less than the owner.

Eric is not a developer. He uses the app on an iPhone (added to the Home Screen) and in Chrome on a MacBook, and he talks by voice-to-text. He is in chemotherapy and tires easily. Write to him in short, plain English and lead with the answer.

## Where the code is

- GitHub: `ebleach2010/pocket-advocate` (private). `main` is what is live.
- Unfinished work is on branches named `wip/...` (see `STATUS.md`). Each one has a brief in `briefs/` that says exactly what it is for.
- The project's own rule book is `CLAUDE.md` in the repo root. Read all of it before changing anything. The owner's decisions, with his words, are in `docs/DECISIONS.md` (newest first). What each test covers is in `docs/SUITES.md`.

## How it is built

- **One Cloudflare Worker** (`worker/index.js` and the files it imports) serves the static pages from `public/` and every `/api/*` route. Config: `wrangler.jsonc`. A cron fires every minute.
- **Firebase** for sign-in (Auth), the database (Firestore) and files (Storage). Security rules are `firestore.rules` and `storage.rules`.
- **Stripe** for payments (Checkout, saved cards, a billing portal).
- **Web Push** for notifications.
- No framework and no bundler. Plain HTML, CSS and JavaScript modules. `tools/build-public.mjs` copies `public/` to `dist/`.

## How a change goes live

1. Cloudflare "Workers Builds" deploys every push to `main` to production in about a minute.
2. A second branch, `staff-v2`, is pushed to the same commit at every release.
3. Check it landed: `curl https://thepocketadvocates.com/api/version` returns the tag and version.
4. **Security rules are not deployed by the push.** The Worker publishes them itself on a cron (minute 11 of each quarter hour; see `worker/rules-release.js`). After any edit to the two rules files run `node tools/rules/sync-rules.mjs`.

### What every release must change

- `worker/index.js`: `BUILD_TAG` (for example `v2026-11-18-release1103`) and `VERSION` (for example `11.3`).
- `public/js/version.js` and `public/js/changelog.js`: the same `VERSION`.
- `worker/devnotes.js`: a new first entry (`version`, `quiet: true`, `client: []`, `admin: [...]`) in plain words. No dashes, and none of the words listed in `RULES.md`.
- `tools/suites/release.mjs`: re-pinned to the new version, tag and entry, with a negative control you actually ran.
- `node tools/staff-v2/hash-client.mjs --write "why"`.

After 10.99 the numbering went to 11.0, 11.1 and so on.

## How to check a change

Run all of these before pushing to `main`. The owner's rule is that the full battery passes first.

| Check | Command |
|---|---|
| Full battery (about 280 suites) | `node tools/suites/run.mjs` |
| Staff shell | `node tools/suites/staffshell.mjs` (expects 32 passed) |
| Nothing about how the product is made reaches clients | `npx wrangler dev --port 8899 --local`, then `node tools/blindness-audit.mjs http://127.0.0.1:8899` |
| Security rules | `tools/rules/rules-check.mjs`, `privacy-e2e.mjs`, `team-rules.mjs` in the Firebase emulators (run notes are at the top of each file) |
| Walk-throughs in a real browser | the scripts in `tools/drives/` (each file's header says how to run it) |

Three suites are known to fail only when the machine is busy and pass when run alone: `buildpublic`, `rulebook` (R5) and sometimes `appfeel` or `interviewdoor`. Rerun them alone before believing a failure.

The **practice copy** lets you see the app with made-up people and no real data: open a local server with `?demo=admin` (staff) or `?demo=1` (client). The drives use it.

## Mistakes to avoid (they were all made in the last two days)

1. **A new `/api/staff/...` route must sit above the catch-all** in `worker/index.js` that hands every `/api/staff/` path to `handleAdvocates`. A route placed below it answers "Not found" on the live site while every test passes. Suite `casepartner` check C13 guards this.
2. **Test the empty account.** A page that returns early when a person has no cases never drew a card that a brand-new partner needed. Always try the zero-cases, zero-messages, brand-new-user path.
3. **Tests that call a handler directly, or use the practice copy, do not prove the live path.** Go through the Worker's real `fetch` router at least once.
4. **Never ship unchecked because it is urgent** without saying so plainly. A button shipped that way broke live twice in a row.
5. **Do not tell the owner to "close and reopen the app"** as a first answer. Check the code first.
6. **Tell the owner the exact path to every new button** when it ships (tab, then screen, then card, then button). He should never discover a control by accident.
7. **Old plan versus current plan.** Two billing systems run side by side (see `STATUS.md`). Most "it's broken" reports about hours came from a client on the old one.
8. **The disk fills up.** Test runs leave folders named `/tmp/pa-*`. Delete ones older than 90 minutes, or browsers start crashing.

## Files in this package

- `README.md`: this file.
- `STATUS.md`: what is live, what is half built and where, what is queued, and what is waiting on the owner.
- `RULES.md`: the owner's standing rules. These are not optional.
- `SECURITY-CHECKLIST.md`: the Firebase, Cloudflare, GitHub, Stripe and Google steps that still need doing, and which ones only the owner can do.
- `Account-safety-steps.pdf`: the same account steps as a printable sheet written for the owner (dated 2026-11-15).
- `briefs/`: the working brief for each unfinished branch, plus `COMMON.md` (rules every builder follows) and the owner's own landing page brief.
