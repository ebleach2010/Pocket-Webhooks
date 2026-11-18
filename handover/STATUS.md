# Status on 2026-11-18

Markers: 🔴 live, ✅ done and waiting for the owner, 🟡 in progress, 🚨 needs the owner's answer, ‼️ blocking.

## 🔴 Live: release 11.3

Check with `curl https://thepocketadvocates.com/api/version`.

Shipped in the last two days, newest first:

| Release | What |
|---|---|
| 11.3 | The partner's Join card shows even when she has no cases of her own. |
| 11.2 | Her requests route reachable on the live server; owner's "Add her now"; plainer wording of the request. |
| 11.1 | **The owner's partner can join one of his cases** (D227): he asks, she taps Join or Not now, the client is told once. One clock per case that hands over. Blue for him, purple for her. Her hours on her own payroll line at 60%. Billing stays his. |
| 11.0 | Older monthly plan: "by the hour" carries on past the month end; bill on the saved card with one tap; the owner's clock count restarts once by the hour; calmer client screens; owner-only "Move this client to the current plan" (D228, D229). |
| 10.99 | App tour sign-in fix (D220). Not proven on the owner's iPhone; see below. |
| 10.98 | Older monthly plan: banner when hours are used, clock stops itself, 30 free minutes, owner-only lower rate (D226). |
| 10.97 | Stopping the clock always asks what was worked on when a line was picked (D224). |
| 10.96 | 15 fixes to adding and onboarding the partner (D213). |
| 10.93 to 10.95 | Earlier landing pages, public menu, "hours with clients" under names (D221 to D223). |

### Where the new controls are

| Control | Path |
|---|---|
| Add the partner to a case | Cases, open the case, Overview, card "Work this case together" |
| Add her now, Take back, Remove | Same card, once a request is waiting or she is on the case |
| Her Join and Not now | Her Today and her Cases, at the top |
| Rate for extra time on an old-plan case | The case, Overview, card "Past the month's hours: by the hour" |
| Bill extra hours | Same card |
| Do not bill this time, Give 30 free minutes | The banner at the top of the case |
| Move this client to the current plan | The case, Overview (old-plan cases only) |
| My partner on the landing page | Team, Onboarding, the partner's row |

### Two billing systems run side by side

- **Old monthly plan** (cases booked before the end of October; `fullAccess`, not `hourly`): a month with included hours. When they are used the client picks: by the hour, another month, or end. The owner bills extra time by hand with "Bill extra hours". There is one such client today.
- **Current plan** (`hourly` with `billing: 'period'`): the client sets an hour limit for every two weeks, the clock stops itself at the limit, the owner may give 30 free minutes, the client asks for more hours and the advocate accepts, suggests another number or declines. The card is billed automatically every 14 days.

## 🟡 In progress: three branches, each with a brief

All three were being worked on by background builders at the time of writing. Each branch is pushed to GitHub as `wip/<name>`. Read the brief, then `git log origin/main..wip/<name>` and the branch's own entry in `docs/DECISIONS.md` to see how far it got. **None of them has been verified or shipped. Merge `main` into each first.**

| Branch | Brief | What it is | How far |
|---|---|---|---|
| `wip/landing5` | `briefs/landing5.md` and `briefs/OWNER-landing-brief.md` | The owner's **approved landing page**: plum and rose palette, hero photo of the two of them, "Real people. Real support. In your corner.", glow, three service cards, Our Story, How It Works, FAQ. Decision D231. | Pages, menu and tests built. Final verification and the side-by-side against his reference were under way. He gave a standing go-ahead to ship the landing page once verified. |
| `wip/staffui` | `briefs/staffui.md` | **Staff screens rebuilt from his five mockups** (Today, Cases, Inbox, Team, Me), the shield page as the home of payroll, a tidy page for each person, "Add to one of my cases" on the partner's page, and several truth bugs. Decision D230. | About 70 commits. Large. Needs a careful look next to his mockups before shipping. |
| `wip/hoursattend` | `briefs/hoursattend.md` | Clients always told when hours run out, with the rate; attending an appointment becomes a free request for Full Case Management; **a new hourly agreement version** with his approved wording (no payment ahead). Decision D233. | About 40 commits. |

The owner's mockups, reference images and hero photo are his own files; ask him for them. The briefs describe every one.

## Queued, not started

In the owner's order:

1. **The partner's own app tour** (the "faster" version he chose): built around what exists once `staffui` ships. It covers tasks, safety, team chat and keeping client information in the app, the phone as a pager, how the clock charges a client, how she is paid, how she looks in chat, her role as co-advocate (care coordination calls, psychiatric support, researching next steps, attending appointments when she can), continuity when he is unwell, and a 30-second narrated clip about the helpers, a phone recorder, a webcam and a lapel microphone. He must approve the script before anything is recorded.
2. **New version of the partner's papers** for her to sign again, with three changes he approved: the "Your cases" line (she joins his cases when he adds her and she agrees, may take clients of her own at the practice's prices, 60% on any case); the rule about not mentioning the Bookkeeper or Advisor to clients; the clock line updated to one clock that hands over.
3. **The partner taking clients of her own**: 60%, the owner's prices and services, she sets only her weekly hours. After she signs the new papers.
4. **Two clocks running at once** on a shared case, each billed for its own time.
5. **Tasks** handed between the two of them.
6. **Team chat as a tab beside the client chat**, edged with a raised gold frame so it cannot be mistaken for the client chat.
7. **A required "what are you working on" line** when either of them starts the clock by hand on a shared case, visible only to the two of them.
8. **"See what they see"**: a read-only view of a real client's side for the owner.
9. **Sweep of Me and Team** for redundancy, with Sign out always last on Me (largely covered by `staffui`).
10. **Bookkeeper Beta for clients**: a plain search box over the client's own chat and uploads. No engine reads anything. Its own build, with an intro for existing clients when it goes live.
11. **Checkpoint for long cases**: the app drafts a summary of what is known, the owner corrects and approves it, and the helpers read that summary plus everything after it.
12. **Remaining findings from the 2026-11-17 sweep** (99 confirmed): app feel, client payments (3 card tries then stop), advocate pay, notifications, scale, wording. The owner has the list; the records were on the previous machine.
13. **One payroll reminder** on the 1st of each month at 8:00 am his time. Payroll stays monthly. Wanted before December 1.
14. **A one-page privacy training** for contractors, with a signature page.

## Parked on purpose

- `wip/faceid`: Face ID lock and the two iPhone app shells. Paused until the Apple Developer account exists.
- `wip/payrun`: twice-monthly payroll. He decided to keep payroll monthly. Only the reminder idea is wanted.

## 🚨 Waiting on the owner

- **Try the App tour on his iPhone** (fix shipped in 10.99). If it stops, a picture of the message; and his iOS version.
- **When his old-plan client pays a bill**, whether the one-tap payment on the saved card looked right.
- **Terms wording** for two advocates working one case as a team (see `SECURITY-CHECKLIST.md`).
- **Agreement wording shown to a client he moves to the current plan**: the new version in `wip/hoursattend` is meant to settle this; he should read the before and after of every sentence that mentions paying ahead.
- **Whether "New advocate" under the partner's hours should ever go away** (set to disappear at 50 hours). The approved landing page drops the hours display from the hero altogether.
- **A sharper photo of him** is no longer needed if the approved landing page ships, since it uses the new hero photo.
- **The account safety steps** in `Account-safety-steps.pdf`: which are done.

## Not proven

Say these plainly to the owner if they come up:

- The tour fix on a real older iPhone.
- The partner feature with two real phones at once.
- The saved-card bill with a real card.
- Release 11.2 and 11.3 shipped at his request before the full test battery had finished. The feature's own checks (58 of 58) passed; the full battery was still running on that exact code when this was written.
