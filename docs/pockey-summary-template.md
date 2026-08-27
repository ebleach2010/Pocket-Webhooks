# Pockey summary template — "Capture & Automate"

A custom Pockey **summary template** designed to feed this webhook service. It makes every recording's Notes come out in a clean, consistent, machine-friendly shape so trigger-word detection and appointment extraction are reliable — and it pre-stages the future email / text / journal handlers.

- **Requires** a Pockey **Pro** subscription (custom templates are Pro-only). Your account is Pro.
- **Where to add it:** Pockey app → **Settings → Summary → Summary theme → + Create new template**.
- Paste the **Name**, **Global instructions**, and each **Section** below (each section has a title + its instruction). Sections are reorderable; the order below is recommended.

> **Prefer a premade one?** Pockey ships presets (**Auto Detect**, **Meeting Summary**, **Call Summary**, …). "Auto Detect" already extracts action items, and the v1 **calendar handler works with it** because it reads Pockey's structured action items directly. The custom template below is worth it because it (a) makes the trigger-word / free-text path far more reliable and (b) lays out the email/text/journal sections you'll want when those handlers ship.

---

## How it maps to the handlers

| Template section | Handler | Status |
| --- | --- | --- |
| **Appointments** | Calendar → Google Calendar | ✅ v1 (this PR) |
| **Reminders & Tasks** | Calendar (timed ones) / general reminders | ✅ v1 |
| **Email Drafts** | Gmail draft-for-review | 🔜 future |
| **Text Messages** | Text draft-for-review | 🔜 future |
| **Journal Entry** | Journal → Google Doc | 🔜 future |

The template encodes the **Hybrid posture** and **trigger words**: Appointments are always captured when a date/time is mentioned; Email/Text/Journal sections fill **only** when you say the matching trigger phrase.

Spoken trigger phrases the template honors (keep these consistent with `config/triggers.json`):

- **Calendar:** "add to my calendar", "put this on my calendar", "schedule this", "calendar this", "make an appointment"
- **Email:** "draft an email", "write an email to…", "email <name>"
- **Text:** "text <name>", "send a message to…", "shoot a text to…"
- **Journal:** "journal entry", "dear journal", "add to my journal", "diary entry"

---

## Template — copy/paste into Pockey

### Name

```
Capture & Automate
```

### Global instructions

```
These are Eric's personal voice notes and dictations, captured on the go to drive
automations (calendar, email/text drafts, journaling). Summarize literally and
precisely: preserve exact dates, times, names, phone numbers, email addresses,
dollar amounts, and street addresses exactly as spoken — never paraphrase, guess,
or invent details. If a detail is unclear, leave it out rather than assume it.

When a time is relative ("tomorrow", "next Tuesday at 3", "in an hour"), resolve it
to an absolute date/time using this recording's date, and assume the America/Boise
timezone unless another timezone is stated.

Keep every section terse and follow its stated output format EXACTLY, including
punctuation and separators — a program reads these sections. If a section has no
content, output the single word None for that section.

Honor spoken trigger phrases. Always fill "Appointments" whenever a specific
date/time is mentioned. Fill "Email Drafts", "Text Messages", and "Journal Entry"
ONLY when Eric explicitly asks for that action (e.g. "draft an email…", "text…",
"journal entry…"). Do not create drafts, messages, or journal entries he didn't
ask for.
```

### Section 1 — Summary

Title:
```
Summary
```
Instruction:
```
One or two plain sentences capturing what this note is about. No preamble.
```

### Section 2 — Appointments

Title:
```
Appointments
```
Instruction:
```
List every appointment, meeting, call, or reservation that has a specific date or
time. Resolve relative times against the recording date (America/Boise unless
stated). Output one bullet per appointment in EXACTLY this format and nothing else:

- TITLE | WHEN | LOCATION | NOTES

Where:
- TITLE = a short event title (e.g. "Eye appointment with Dr. McAdams")
- WHEN  = "YYYY-MM-DD HH:MM" in 24-hour time for a timed event, or
          "YYYY-MM-DD (all day)" for an all-day/date-only event
- LOCATION = the place, or — if none
- NOTES = a brief context phrase, or — if none

Include only events with a real date and/or time. If there are none, output None.
```

### Section 3 — Reminders & Tasks

Title:
```
Reminders & Tasks
```
Instruction:
```
To-dos and reminders that are NOT full appointments. One bullet each in this format:

- [Assignee] - [Task] - [Due date or —]

Use "me" as the assignee when unspecified, and — when there is no due date.
If there are none, output None.
```

### Section 4 — Email Drafts

Title:
```
Email Drafts
```
Instruction:
```
ONLY if Eric explicitly asks to draft, write, or send an email. For each one,
output a block in exactly this format:

- To: <name or email address>
  Subject: <a clear subject line>
  Body: <a concise, ready-to-send draft written in Eric's first-person voice>

If Eric did not ask for an email, output None.
```

### Section 5 — Text Messages

Title:
```
Text Messages
```
Instruction:
```
ONLY if Eric explicitly asks to text or message someone. One bullet each:

- To: <name or phone number> | Message: <the exact message text, in Eric's voice>

If Eric did not ask to send a text, output None.
```

### Section 6 — Journal Entry

Title:
```
Journal Entry
```
Instruction:
```
ONLY if Eric says this is a journal or diary entry. Rewrite what he said as a clean
first-person journal entry: remove filler words ("um", "uh", "like", "you know")
and repeated/false-start phrases, and fix obvious mis-transcriptions — but keep his
meaning, details, and voice. Do NOT summarize, shorten, or add anything he didn't
say. If this is not a journal entry, output None.
```

---

## Applying it

1. Create the template in **Settings → Summary → Summary theme** as above and save it.
2. Set it as your active summary theme (or apply it per-recording, if Pockey offers that).
3. New recordings will be summarized with these sections. The webhook fires on
   `summary.completed`, and the service reads both Pockey's structured action items
   **and** this summary text — so the cleaner and more consistent the sections, the
   more reliable the automation.

## Notes on how this interacts with the service today

- **v1 calendar handler** primarily uses Pockey's structured **action items** (which are
  produced regardless of template), so it already works with any template — including
  the presets. This template mainly boosts the **trigger-word / free-text** path (the
  Claude fallback reads the summary) and keeps things tidy for the upcoming handlers.
- Because the **Appointments** section has a fixed, parseable format
  (`TITLE | WHEN | LOCATION | NOTES`), a future enhancement can parse it
  **deterministically** (no LLM needed) as an additional calendar input source. Not
  part of v1, but the template is written to make that easy.
