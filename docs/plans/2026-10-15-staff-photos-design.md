# Staff photos on winner cards and committee pages

Status: design confirmed by the user. Not implemented.

## 1. Understanding summary

- Add a staff photo next to each name.
- Public pages: the winner ring cards on the landing page and the winner card on each award page.
- Committee pages: nominee cards on the evaluate page and rows on the results page.
- Why: the awards are for people. A face makes the names real for staff and visitors.
- Who: visitors to the landing page, staff, and the committee.
- Photos come from the owner as a folder, one file per person, named "LASTNAME, FIRSTNAME".
- The owner confirms consent for each photo before sending it.
- Non-goals: uploading or editing photos in the app, and photos for all 167 staff in one step.

## 2. Assumptions

- A1 Public means the landing page and award pages. Committee pages also show photos.
- A2 The Drive folder is shared as "anyone with the link" (confirmed: reader, anyone).
- A3 The folder holds about 61 Annex photos. The total is small.
- A4 Photos are resized to 256 px square and cropped on the face.
- A5 Consent is the owner's responsibility.
- A6 A face must be clear. A photo where it is not is flagged, not published.
- A7 A backend change needs one new deployment version in Apps Script.
- A8 Photo links change in the sheet with no push needed.

## 3. Open questions

- None blocking.
- Known facts from the folder:
  - About 15 files are 6 to 12 KB and may need larger originals.
  - One file name differs from the staff list: "MACPAO, REYMUNDO" against "Raymundo M.". The override column handles it.

## 4. Decision log

- D1 Store photo links in a `Photos` tab in the sheet.
  - Alternatives: a photo file in the repository, or photo files committed to the repository.
  - Why: the committee changes photos without a push. Photo links stay out of the public code.
- D2 Photos are hosted in a Google Drive folder shared as "anyone with the link".
  - Alternatives: public repository, or served through the backend.
  - Why: photos are not bulk-downloadable from the repository. The owner chose this.
- D3 Square 256 px crop on the face. Files with an unclear face are flagged, not used.
  - Why: a consistent card layout. The owner chose "as long as the face is clear".
- D4 Rollout starts with the Annex folder.
  - Why: the owner supplied it first. Other staff follow when their photos arrive.
- D5 Name matching uses the normalized staff name, plus an override column.
  - Why: names differ in spacing, case, and spelling. The same rule as the duplicate fix.
- D6 Public data includes a photo link only for people with a Photos row. Nominator names and reasons stay private.
  - Why: the owner asked for photos, not for more data about nominators.
- D7 Staff without a photo show initials.
  - Why: the existing design, and no broken layout.
- D8 No photo upload in the app.
  - Why: the owner chose the folder option. Keeps the app simple.

## 5. Design

### 5.1 Architecture

- Sheet: a `Photos` tab with the columns Staff name, Drive file ID, Override name.
- Backend: the public data adds `photo` to each nominee and winner that has a row. Lookup is by normalized name.
- Front end: the winner ring card, the award page winner card, the evaluate nominee card, and the results row show the photo or initials.

### 5.2 Data flow and rules

- A file ID becomes a direct image address at 256 px square.
- The name match ignores case and extra spaces. The override column wins when set.
- A link that fails to load shows initials.
- Two rows for one person: the first is used and the second is reported.
- A name with no staff match is reported. The committee fixes the sheet.

### 5.3 Error handling and edge cases

- Name not in the staff list: row ignored, listed in the report.
- Drive link broken or folder private: initials shown, link listed in the report.
- Winner with no photo: name and award shown, with initials.
- Photo changed after posting: the link is read live, so the new photo shows on next load.

### 5.4 Testing

- Unit tests for name matching: case, spacing, override, and the MACPAO case.
- A test that a missing or broken photo falls back to initials on every card type.
- A test that the public data holds no nominator names or reasons.
- Visual checks on desktop and phone with a real photo and with initials.

### 5.5 Risks

- Wrong person on a photo: mitigated by the report and the committee check.
- Face too small to see: flagged on processing.
- Consent: the owner's responsibility, as agreed.

### 5.6 Rollout

1. Process the Annex folder: crop, check faces, produce the report.
2. Create the `Photos` tab and fill it.
3. Build and test the backend and front end.
4. Deploy the backend as a new version. Push the front end.
5. Visual check on the live site.

## 6. Handoff

- Implementation has not started.
- Next step: an implementation plan, then build on the test copy first.
