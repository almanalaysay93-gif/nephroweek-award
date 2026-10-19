# Nephrology Nurses Week 2026 Awards

This web app collects nominations and automates the committee score for the SPMC Nephrology Nursing Cluster awards.
The award criteria and weights come from the Nephrology Nurses Week 2026 proposal.

## What the app does

- The home page lists 14 awards: 9 nurse awards and 5 dialysis technician awards.
- Each award has one page with the coverage, the criteria, a nomination form, and the nominee list.
- Each evaluator signs in with the committee username and PIN, plus their own name for score attribution.
- Each evaluator rates each criterion from 1 to 5.
- The app applies the weights and shows a total out of 100.
- The Results page ranks the nominees by the average total of all evaluators.
- Patient Choice accepts both nurses and dialysis technicians. Each patient has one vote across the shared category.
- The Patient Choice award and the Peer Choice award count one vote for each name.
- The committee publishes the awardees from the Results page.
- After that, each award page shows its awardee with an animation.
- A published award accepts no more nominations.

## Scoring rule

A rating of 5 earns the full weight of a criterion.
A rating of 3 on a criterion with a weight of 30 earns 18 points.
The final score of a nominee is the mean of the totals from all evaluators.
Nominees with the same score share one rank.
After the voting/scoring deadline, a scored award with no valid committee scores is decided by the highest number of nominations for that category. Every nomination counts, and spacing or capitalization does not split one nominee into different people. Ties share first place. Categories with any valid committee score continue to use committee scoring; vote awards keep their one-vote-per-name rule. The automatic announcement still runs on October 23 at noon Manila time.
The rules are in `js/scoring.js`.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home page and award list |
| `award.html?id=<award>` | One page for each award |
| `evaluate.html` | Committee scoring |
| `results.html` | Automated tally and publish control |

## Run on this computer

The pages use JavaScript modules, so a browser cannot open them from a file path.
Start a local server in the project folder:

```
npx serve -l 5173 .
```

Then open `http://localhost:5173`.

While `ENDPOINT` in `js/config.js` is empty, the app is in demo mode.
In demo mode the data stays in one browser.
The demo username is `admin`. The demo committee PIN is the value of `DEMO_PIN` in `js/api.js`.

## Connect the Google Sheet

1. Create a Google Sheet.
2. Open Extensions, then Apps Script.
3. Paste the content of `apps-script/Code.gs`.
4. Open Project Settings, then Script Properties.
5. Add `COMMITTEE_USERNAME` with the value `admin`, and `COMMITTEE_PIN` with the chosen PIN of 8 characters or more. Keep credentials in Script Properties, not repository files.
6. Select Deploy, then New deployment, then Web app.
7. Set "Execute as" to Me and "Who has access" to Anyone.
8. Copy the address that ends in `/exec`.
9. Paste the address into `ENDPOINT` in `js/config.js`.

The script uses the original awards workbook identified by `SPREADSHEET_ID` in `apps-script/Code.gs`, even when deployed from another Apps Script project.
It creates any missing tabs `Nominations`, `Scores`, and `Settings` on the first request.

### Restore the original nominations after changing projects

1. Replace `Code.gs` in the current Apps Script project with the repository version.
2. Save and deploy a new version of the existing deployment, keeping its URL.
3. Run `restoreRecentNominations` from that project's editor. It copies missing submissions from the previously attached workbook into the original workbook without replacing existing records. Repeated runs do not duplicate copied submissions.
4. Refresh the awards website. Existing committee credentials stay in that project's Script Properties.

## Tests

```
node --test tests/scoring.test.mjs
```

## Data and privacy

- The site holds staff names only. Staff email addresses are not in the site.
- The public pages show nominee names and nomination counts.
- The public pages do not show who nominated, the reasons, the scores, or the vote counts.
- Only a request with the committee PIN reads the full data.

## Known limits

- Nomination is open, so a person can type a different name and nominate again.
- The committee PIN is one shared secret. Give it to evaluators only.
- The Apps Script service does not limit wrong PIN attempts, so use a long PIN.
- The service does not check a nominee name against the staff list. The page makes that check.
- The dialysis technician awards use the criteria text of the Dialysis Technician awards from the proposal.

## Certificate email automation

- Run `installAutomationTriggers` once from the current Apps Script editor and approve Drive, Slides, URL Fetch, and email permissions. Re-running it replaces only this app's two scheduled triggers.
- Certificates are emailed to `nncluster@spmcdvo.net` on **20 October 2026 at 12:00 noon Manila time**, when nominations and scoring close. The winner snapshot is kept private until the public announcement on **23 October 2026 at 12:00 noon Manila time**.
- A native Google Slides certificate template is configured in `CERT_TEMPLATE_ID`. Each certificate is attached as both PPTX and PDF, with an editable Slides link. Large sets are split into separate emails.
- `sendAwardCertificates` can retry after the email time; saved files and successfully sent batches are reused. It refuses to send before the deadline. The private `certificateEmailLog` setting records success or failure.
- Save and deploy a new version after updating `Code.gs`; the existing deployment URL and committee credentials can stay unchanged.

## Committee score saving

Score requests have a timeout. If a response is lost, the page checks the evaluator's stored ratings before retrying the same score once. Server refusals such as a closed deadline are never retried.
Unsent ratings are kept on the same browser/device, separately for each evaluator, award, and nominee. Drafts contain ratings, not the committee PIN, and are cleared after a confirmed save. A failed confirmation leaves the ratings available to retry instead of reporting them as saved.

### Score saving performance

The backend reuses workbook and tab handles within each request and reads score rows from the already-open Scores tab. Values are still read fresh while holding the same write lock; deadlines and evaluator-specific updates are unchanged. Deploy the updated `apps-script/Code.gs` as a new version of the existing web app to enable this server improvement. Keep the existing deployment URL and Script Properties.
