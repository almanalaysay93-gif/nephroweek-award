# Automatic voting close and landing page winners

Status: design confirmed by the user. Not implemented.

## Change 1: winner posting date (confirmed by the user)

- Voting closes 21 October 2026, 7:00am Manila time. Nominations, votes, and scores lock.
- Winners are posted on the landing page 23 October 2026, 7:00am Manila time.
- The timer runs at 23 October 2026, 7:00am Manila time, not at the close.
- Decision D9: a separate announcement time. Alternatives: post at the close (original), or manual only. Why: the awarding is on 23 October.
- Public state adds `announceAt` and `announced`. Landing and award pages use `announced` for the "No awardee" list.

## 1. Understanding summary

- Build an automatic close of voting for all 14 awards at 07:00 Asia/Manila time on 21 October 2026.
- At the close, nominations, votes, and scores lock for every award.
- The automation posts the winner of each award.
- The landing page shows the winners in an Awardees section.
- Why: a fixed deadline, with no manual step on the day.
- Who: staff nominating, patients voting for Patient Choice, colleagues voting for Peer Choice, the committee, and visitors to the landing page.
- Non-goals: email notifications, a countdown timer, changes to criteria or weights, and a history archive.

## 2. Assumptions

- A1 The Apps Script time trigger runs in the project time zone, Manila, which is already set.
- A2 A time trigger can run a few minutes after its set time. It does not run to the second.
- A3 The landing page reads winners from the public service. No PIN is needed.
- A4 After the close, the service refuses writes for every award.
- A5 Publishing awardee names is intended. The award pages already show them.
- A6 Scale is small: 14 awards, about 170 staff, a few hundred rows.
- A7 A change to the backend code needs a new deployment version.
- A8 Q1 default: one Awardees section on the landing page, with one card per winning award and a link to its award page.
- A9 Q3 default: if the timer fails, the committee publishes by hand from the results page.

## 3. Open questions

- None blocking. The user confirmed the summary, assumptions, and sections 1 to 4 with "yes".

## 4. Decision log

- D1 Approach A: Apps Script time trigger in the existing backend.
  - Alternatives: approach B (close only, committee publishes), approach C (GitHub Actions cron).
  - Why A: it meets the automatic requirement, runs free, and keeps nominator data out of the public repo. B does not post winners automatically. C would need sheet data in the public repo.
- D2 All 14 awards close together at one time.
  - Alternatives: per-award close times.
  - Why: simpler to explain to staff and the committee.
- D3 Ties post all tied names together.
  - Alternatives: hold for committee, or pick one name by alphabetical order.
  - Why: no hidden choice. An unfair pick is worse than a shared win.
- D4 An award with no scored nominee shows "No awardee".
  - Why: a guessed winner would look unfair.
- D5 Lock everything at the close, including nominations, votes, and scores.
  - Alternatives: lock nominations and votes only, or lock nothing.
  - Why: posted winners must not change after posting.
- D6 The committee keeps the manual publish button, including before 7am.
  - Why: an early close is sometimes needed, and the button is the fallback if the timer fails.
- D7 The gate checks the server clock, not the browser clock.
  - Why: browser clocks can be wrong or set by the user.
- D8 The timer skips awards already published.
  - Why: this makes re-runs safe and keeps committee decisions.

## 5. Design

### 5.1 Architecture and components

- Close time: one constant in `apps-script/Code.gs`, set to `2026-10-21T07:00:00+08:00`.
- Write gate: nominate and score check the close time first, and refuse at or after the close.
- Ranking on the server: a port of `js/scoring.js`, with the same rules.
- Close handler: `closeAndPublish`, run by a time trigger at the close time.
- Trigger setup: a one-time function, run by the owner account. Running it again replaces the old trigger.
- Public state: adds the close time and the winners. Vote counts stay hidden.
- Landing page: a new Awardees section reads the winners from public state.

### 5.2 Data flow and rules

- The gate refuses writes from 07:00 on 21 October with "Voting is closed."
- The timer skips awards already in winners.
- For each remaining award, the timer ranks nominees.
- Scored awards use the weighted average. Vote awards use the vote count.
- Tied nominees at the top all become awardees together.
- An award with no scored nominee gets no winner.
- If the timer runs late, writes already stopped at 07:00.
- If the timer fails, it writes an error entry to a log row in Settings. Nothing is posted.
- Running the timer twice adds nothing new.

### 5.3 Landing page and public pages

- An Awardees section sits between the logo row and "How to nominate".
- One card per award with a winner: award title, awardee name, and a link to the award page.
- Ties show all names on one card.
- Patient Choice and Peer Choice show the name only, no vote counts.
- Before 7am: the section shows the announcement time, and no winners.
- After 7am: awards with no winner show "No awardee".
- Award pages show "Voting closed" after 7am and hide the nomination form.
- Results page shows the close time and the timer's last log entry.

### 5.4 Testing

- Shared ranking cases run against both the JavaScript ranking and the Apps Script port.
- The gate and the timer read the close time from one constant. Tests check just before and just after 07:00.
- `previewClose` returns the winners the timer would post, without writing. The committee runs it on 20 October.
- A full run uses a copy of the sheet and a separate deployment, with a close time a few minutes ahead.

### 5.5 Risks

- Wrong close date: mitigated by one constant and the preview run.
- Trigger owner leaves: mitigated by naming the owner in the README.
- Logic drift between JavaScript and Apps Script: mitigated by shared test cases.
- Forgotten redeploy: mitigated by a checklist step.
- Timer delay: writes stop at 07:00. Winners can appear a few minutes later.

### 5.6 Rollout

1. Build and test on the copy.
2. Deploy to live as a new version.
3. Install the trigger from the owner account.
4. Run the preview on 20 October.
5. Confirm the trigger is listed for 07:00 on 21 October.

## 6. Handoff

- Implementation has not started.
- Next step: an implementation plan, then build on the copy first.
