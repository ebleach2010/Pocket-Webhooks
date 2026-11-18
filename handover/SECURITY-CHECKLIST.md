# Security checklist: Firebase, Cloudflare, GitHub, Stripe, Google

Written 2026-11-18. This covers what protects client health information and money in this app.

Read the three rules first. They apply to any assistant helping with this.

1. Never type, paste, read out or photograph a password, key, code or token into a chat. Keys go from the site that made them straight into the owner's password manager or a Cloudflare encrypted secret.
2. If a step says "look only", change nothing. Report what is there.
3. If a screen looks different from what is written here, stop and ask. Do not guess.

**I do not know which of the owner's console steps are already done.** The printable sheet `Account-safety-steps.pdf` (2026-11-15) was written for him, and he has not confirmed any of it to me. Treat every box as open until he says otherwise.

## Part A: only the owner can do these (console clicks)

### All five accounts: Google, Cloudflare, GitHub, Stripe, Apple

- [ ] Two-step sign-in on all five, with an authenticator app or passkey (not text message codes where there is a choice).
- [ ] Backup codes saved in the password manager, with one printed copy at home.
- [ ] Recovery phone and email checked on each account. Remove any old number.
- [ ] A unique long password for each account.

### Firebase and Google (console.firebase.google.com, the project `pocket-advocate-f3148`)

- [ ] Authentication, Settings, User actions: turn on **Email enumeration protection**.
- [ ] Authentication, Sign-in method: turn off Email/Password **only after** confirming in the code that the app no longer uses it. Sign-in today is by emailed code and custom tokens. Check `public/js/auth.js` and `worker/` before telling him to switch it off.
- [ ] Look only: Authentication, Settings, Authorized domains should list `thepocketadvocates.com`. Report anything else.
- [ ] Look only: Project settings, Users and permissions. He should be the only owner. Anyone listed can read every client record.
- [ ] Google Cloud console, Billing, Budgets and alerts: a monthly budget alert at a figure that would surprise him (for example $50).
- [ ] Google Workspace admin, Security: require two-step verification for every user. Arielle now has a mailbox.
- [ ] Never create or download a new service account key. That file is a master key to the database. One already lives in Cloudflare as an encrypted secret.
- [ ] Google Cloud console, APIs and Services, Credentials: the browser API key should be restricted to the site's own web address (HTTP referrer `thepocketadvocates.com`) and to the Firebase APIs it needs. The key is public by design, but an unrestricted one can be abused on his bill.
- [ ] Firestore: turn on scheduled backups or point-in-time recovery if it is not on. Nothing in the code backs the database up.

### Cloudflare (dash.cloudflare.com, the site `thepocketadvocates.com`)

- [ ] Look only: Manage account, Members. He should be the only member.
- [ ] My profile, API tokens: delete any token he does not recognise or no longer uses. Names only, never the token itself.
- [ ] Look only: SSL/TLS, Edge certificates. "Always Use HTTPS" should be on.
- [ ] Look only: these must stay **off**, because they rewrite pages on the way to the phone and break the app's own integrity check: Email Address Obfuscation, Rocket Loader, Auto Minify, Automatic Platform Optimization.
- [ ] Look only: Security, Bots. Report whether Bot Fight Mode is on. It can put a challenge page in front of sign-in, so do not change it without testing sign-in afterwards.
- [ ] Look only: Workers and Pages, the worker `pocket-advocate`, Settings, Variables and Secrets. Every sensitive value must show as Secret or Encrypted (see the list of names in Part B).
- [ ] Where the domain was bought: registrar lock on, auto-renew on, two-step sign-in on. Whoever controls the domain controls the site and the email.
- [ ] Workers and Pages, the worker `pocket-advocate`, Settings, Build (branch control) and Domains and Routes (Preview URLs): Cloudflare builds **every branch pushed to GitHub**, not only `main`, and gives each one a preview web address on `workers.dev`. Those previews run unfinished code against the **live** database and payment settings. The addresses are hard to guess and sign-in is still required, but unfinished code should not be reachable at all. Either turn off builds for branches other than `main`, or turn off Preview URLs. Seen on 2026-11-18 when the `wip/...` branches were pushed.
- [ ] GitHub, the repository, Branches: delete the five `wip/...` branches (`wip/faceid`, `wip/hoursattend`, `wip/landing5`, `wip/payrun`, `wip/staffui`) with the bin icon on each row. Their work is saved in this package's `bundles/` folder. The assistant that pushed them was not allowed to delete branches, so the owner does this by hand. Never push unfinished work to GitHub again while branch builds or Preview URLs are on.

### GitHub (the repository `ebleach2010/pocket-advocate`)

- [ ] Look only: Settings, General. The repository must be Private.
- [ ] Look only: Settings, Collaborators. Nobody he does not recognise.
- [ ] Settings, Code security: turn on Secret scanning and Push protection.
- [ ] Settings, Branches or Rules: for `main`, block force pushes and block deletion. Do **not** tick "Require a pull request", because releases are pushed straight to `main`.
- [ ] His own Settings, Applications: review Installed GitHub Apps and Authorized OAuth Apps. Cloudflare is expected. Remove any assistant's app he no longer uses, and add the new one with access to this one repository only.

### Stripe (dashboard.stripe.com)

- [ ] Look only: Settings, Team. He should be the only person.
- [ ] Look only: Developers, Webhooks. There should be one endpoint pointing at the site. Report any other.
- [ ] Developers, API keys: no restricted or standard key he does not recognise. Names only.
- [ ] Radar rules left at their defaults unless he has a reason to change them.

## Part B: facts about the code that the next assistant needs

### Secrets the Worker reads (names only)

These are stored in Cloudflare as encrypted secrets and must never be written into the repo, a chat, or a log:

`FIREBASE_SERVICE_ACCOUNT`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `VAPID_PRIVATE_JWK`, `PAYOUT_KEY`, `ADMIN_PIN`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.

Plain settings in `wrangler.jsonc` (not secret): `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY` (the public browser key), `PUBLIC_BASE_URL`, `EMAIL_FROM`, `ADMIN_EMAIL`, `ADMIN_UID`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, `STRIPE_PORTAL_CONFIG`.

`TEAM_PREVIEW`, `HOURS_PREVIEW` and `FIRESTORE_HOST` are for local testing only and must never be set in production.

### How access is enforced

- **Two layers.** Firestore and Storage security rules decide what a signed-in browser can read directly. The Worker decides everything that goes through `/api/*`, using the Firebase service account. A change to who can see a case must be made in both and tested in both.
- **Rules are published by the Worker**, not by the push: a cron at minute 11 of each quarter hour (`worker/rules-release.js`). So a rules change takes up to 15 minutes to take effect after a release. The result is visible at `/api/diag?do=rules`, which needs a key the owner holds. Never print that key.
- **Who sees a case**: its advocate (`staffSees`), a partner the owner added who agreed (`teamSees`, `cases/{id}.team`), the client, and the owner. Contractors see only their own cases.
- **The staff pages and scripts are themselves gated**: a stranger who asks for a staff file gets a 404 (see `STAFF_ONLY` in `worker/index.js`).
- **Clients never receive anything produced by the helpers** without it passing the blindness rules. Run `tools/blindness-audit.mjs` on any change that touches what a client can read.

### Checks to run after any change to access or money

- `tools/rules/rules-check.mjs`, `tools/rules/privacy-e2e.mjs` and `tools/rules/team-rules.mjs` in the Firebase emulators.
- `node tools/suites/run.mjs` (suites named `privacy*`, `ownerasset`, `casepartner`, `periodbill`, `charge`, `stripesays` matter most here).
- Two controls in `team-rules.mjs` are marked "not yet run": the file-rules half of T3 and T4's last-message rule. Run them.

### Known gaps worth closing

- **Two real phones were never tested together** for the partner feature (release 11.1 to 11.3). It passed with one person at a time.
- **The one-tap bill on a saved card** (release 11.0) passed every test but has not been seen with a real card.
- **The Terms** say a case is shared with another advocate "when your advocate is unavailable, asks a colleague for a second opinion, or decides another advocate is a better fit" (`public/js/terms.js`, sections 6.3 and 9.3). A standing team of two is not quite any of those. The client is told when the partner joins, but the owner and his lawyer should add a line about working as a team.
- **Call and meeting recording** (a phone recorder, and Lindy.ai for Google Meet) is planned for the partner. The owner's rule is that a client is always asked before a meeting is recorded. A recording service that holds client health information should be named in the Privacy Policy; that is a question for his lawyer.
- **A written privacy training** is promised to contractors within 90 days in their papers. The one-page training document does not appear to exist yet.
- **App Check** is not used. Consider it once the native iPhone apps exist.

## Part C: handing the project to a different assistant

- Give the new assistant access through GitHub's own app or connector, limited to this one repository. Do not give it a personal access token, and never paste one into a chat.
- It does not need the Cloudflare, Firebase or Stripe dashboards to write code. Deploys happen on push to `main`.
- After the handover, remove the old assistant's access (GitHub, Settings, Applications) if it will not be used again.
- If any key was ever pasted into any chat, rotate that key. This is the one case where a secret must be replaced without waiting.
