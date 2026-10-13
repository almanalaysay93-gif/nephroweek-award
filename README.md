# Nephrology Nurses Week 2026 Awards

This web app collects nominations and automates the committee score for the SPMC Nephrology Nursing Cluster awards.
The award criteria and weights come from the Nephrology Nurses Week 2026 proposal.

## What the app does

- The home page lists 14 awards: 9 nurse awards and 5 dialysis technician awards.
- Each award has one page with the coverage, the criteria, a nomination form, and the nominee list.
- Each evaluator signs in with a name and the committee PIN.
- Each evaluator rates each criterion from 1 to 5.
- The app applies the weights and shows a total out of 100.
- The Results page ranks the nominees by the average total of all evaluators.
- The Patient Choice award and the Peer Choice award count one vote for each name.
- The committee publishes the awardees from the Results page.
- After that, each award page shows its awardee with an animation.
- A published award accepts no more nominations.

## Scoring rule

A rating of 5 earns the full weight of a criterion.
A rating of 3 on a criterion with a weight of 30 earns 18 points.
The final score of a nominee is the mean of the totals from all evaluators.
Nominees with the same score share one rank.
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
The demo committee PIN is the value of `DEMO_PIN` in `js/api.js`.

## Connect the Google Sheet

1. Create a Google Sheet.
2. Open Extensions, then Apps Script.
3. Paste the content of `apps-script/Code.gs`.
4. Open Project Settings, then Script Properties.
5. Add the property `COMMITTEE_PIN` with a PIN of 8 characters or more.
6. Select Deploy, then New deployment, then Web app.
7. Set "Execute as" to Me and "Who has access" to Anyone.
8. Copy the address that ends in `/exec`.
9. Paste the address into `ENDPOINT` in `js/config.js`.

The script creates the tabs `Nominations`, `Scores`, and `Settings` on the first request.

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
