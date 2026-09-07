# Meridian Learning Hub

A responsive, local-first education portal prototype for administrators and students. It runs in a browser on Windows, Linux, macOS, iOS and Android through the same responsive web app. The selected app name is **Meridian Learning Hub**; existing custom institution names remain unchanged, while the old default name is migrated safely.

## Capacity expectations

This is a browser-local demonstration, not a concurrent production service. A single browser profile can comfortably manage roughly 100–500 learner records and 10–30 administrator accounts, depending on device memory and the size of local submission metadata. `localStorage` is usually limited to around 5–10 MB per browser origin, and uploaded file object URLs are temporary; large files or many learners will reach those limits quickly.

With the optional SQLite API on a modern local machine, plan for approximately 1–10 concurrent administrators and 100–1,000 learners for a responsive demo workload. SQLite is excellent for local/small-team use, but one writer at a time and local disk/file handling become bottlenecks for simultaneous marking or uploads. For a real deployment, use a server database, object storage, API pagination, background file processing, caching, monitoring, and load testing. Exact capacity depends on hardware, file sizes, network, and workload; there is no guaranteed “no slowing down” user count without measuring the target environment.

## Run locally

```bash
cd frontend
npm install
npm start
```

In a second terminal, start the local SQLite API (optional for the browser-only demo):

```bash
cd backend
npm install
npm start
```

The API listens on `http://localhost:5000` and stores its SQLite database at
`backend/school_data/portal.sqlite`. It is deliberately local-only; no hosted
services, payment or funding integrations are included.

When the backend is running, staff sign-in uses the SQLite accounts and the
workspace shows a live SQLite connection indicator. Administrator accounts can
open **SQLite data** to inspect users, assessments, marks, and recent changes.
That page refreshes every five seconds. **CSV uploads** sends validated marks
to SQLite, while **Download marks CSV** and the 30/50/75/100 student export
links download data from the local API. If port 5000 is stopped, the browser
demo remains usable in fallback mode and clearly reports that SQLite sync is
unavailable.

### Connecting the two local ports

Start both processes and keep both terminals open:

```bash
cd backend
npm start

# in another terminal
cd frontend
$env:REACT_APP_API_BASE="http://localhost:5000"
npm start
```

The frontend sends credentials to port 5000, and the API only permits the
local frontend origins `http://localhost:3000` and `http://127.0.0.1:3000`.
The staff workspace polls the database every five seconds. A failed poll does
not overwrite the last successful display; it shows a visible connection error
and retries automatically.

The app intentionally uses `localStorage`, so it works without a database or internet. Demo accounts:

| Role | Username | Password |
| --- | --- | --- |
| Main administrator | `mainadmin` | `ChangeMe123!` |
| Administrator | `admin` | `Admin123!` |
| Temporary administrator | `tempadmin` | `TempAdmin123!` |
| Student | `student` | `Student123!` |

The sign-in screen includes a **Create an account** link for new students. Student registrations are saved in the browser for the standalone demo, while the backend also exposes SQLite-backed `POST /api/accounts/students` and `POST /api/accounts/sign-in` endpoints for local integration.

The main administrator can create/delete administrators and use **Design** to change the institution name, accent colour, background colour, text colour and portal font. Administrators can publish any file type as an assignment and edit result feedback. Students can view/download assignment entries and see their published results. Local browser storage is for demonstration only; uploaded binary files are represented by their metadata until a server storage API is connected.

Marks now follow a protected Draft → Submitted → Approved → Published → Locked workflow. This applies the SCAMPER method to publication: **Substitute** manual exposure with gated transitions, **Combine** approval with audit and notifications, **Adapt** the workflow to bulk imports, **Modify** results with weighting/publication metadata, **Put to another use** by exporting student summaries, **Eliminate** partial invalid imports, and **Reverse** the process when a correction is needed before publication. Unpublished marks are staff-only, and published/locked results notify students in the portal.

## Folder guide

- `frontend/` — React single-page portal, styling and browser-local account/content state.
- `frontend/src/App.js` — local demo screens and workflow components (Accounts, Courses, CSV uploads, Results).
- `frontend/src/App.css` — responsive layout, theme tokens, workflow badges and form styling.
- `backend/` — Express local API, upload handling, authenticated data views and SQLite database helpers.
- `backend/test/` — focused SQLite/authentication tests.
- `backend/school_data/` — runtime-only database and uploaded files (created automatically; do not commit its contents).

Unused CRA branding and the unused source logo have been removed; required favicon and manifest assets remain because the browser uses them.

## Local data endpoints

The browser uses these local endpoints (administrator endpoints require the
session cookie created by sign-in):

- `GET /api/health` — SQLite connectivity and record counts.
- `GET /` — local API status and a health-link response; private records are not exposed.
- `POST /api/accounts/sign-in` — local account sign-in and session cookie.
- `GET /admin/data` — users, marks, assessments and recent audit events.
- `POST /admin/upload-marks` — all-or-nothing CSV mark import.
- `GET /admin/marks.csv` — marks export.
- `GET /admin/students.csv?limit=30|50|75|100` — capped bulk student export.

## Automatic memo marking and privacy

For a local MVP, an automatic memo reader should be deterministic and
reviewable rather than silently calling an online AI service. Store a memo
version, rubric criteria, accepted concepts, exclusions, and mark range in
SQLite. Normalize the learner response locally (case, whitespace, spelling
rules chosen by staff), score each criterion, and save the matched evidence,
rubric version, and confidence/review flag. Require staff approval for low
confidence or free-text answers. This keeps the local demo offline and makes
every mark explainable.

For a real AI-assisted deployment, run an approved model inside the
institution's controlled environment or use a vetted provider with a
zero-retention agreement. Send only the minimum response and rubric needed for
the decision, remove names/student IDs before inference, disable training on
submitted work, encrypt transport and storage, restrict model/tool access,
log prompts and outputs for audit, and require human review for consequential
marks. Never allow the model to browse unrelated files, private accounts, or
the wider internet; use a document allow-list and a sandbox with no network
egress. AI output should be a recommendation, not an unreviewed final grade.

Current protections are deliberately explicit: passwords are bcrypt-hashed,
session cookies are HttpOnly, SQLite access is authenticated for staff, and
the API is local-origin restricted. Browser `localStorage` demo data and
ordinary SQLite names/IDs are not end-to-end encrypted in this prototype.
For sensitive real deployment data, add authenticated encryption (for example
AES-256-GCM with a key held outside the database), key rotation, encrypted
backups, OS disk encryption, least-privilege accounts, and retention/deletion
rules. Do not put encryption keys in source control or expose them to the
browser.

On a fresh database, the backend seeds a published Biology demonstration mark
for `student` (`STU-001`, 92%, `BIO-001`) plus **49 additional demo students**
(`STU-002`–`STU-050`) spread across the five sample courses and year levels
1–4, each with three assessments (`ASSESS-101/102/103`) in a mix of every
workflow status (Draft, Submitted, Approved, Published, Locked) — 148 demo
marks in total. This lets staff and student views be exercised with a
realistic volume of learners immediately, without needing to manually create
accounts first. The bulk seed only runs once (it checks for `STU-050` before
inserting), so it is safe to restart the server repeatedly without
duplicating rows. Assignment files and learner submissions remain
browser-local in this prototype. Bulk student CSV export is supported; staff
can also download every submitted file for one assignment as a single ZIP
(built client-side with JSZip from the in-browser submission data) from the
**Assignments** page's "Download all submissions (ZIP)" button. That download
now fetches every submission's file in parallel and skips (rather than
aborting on) any single missing/failed file, so bulk downloads for a class of
30–100 students stay fast and resilient to one bad blob URL. Because
submissions stay browser-local, this bundles only the files present in the
current browser session; a production deployment should store submissions
server-side and stream a real archive for every browser/device. Students
must submit assignment work as a single `.zip` archive (other file types are
rejected client-side) so multi-file projects are always packaged together and
bulk downloads are uniformly zip-based.

Marks synced from SQLite carry a database `id`; the Results workflow dropdown
now only offers the single valid next status (Draft → Submitted → Approved →
Published → Locked) and calls the authenticated `/admin/marks/:id/status` and
`/admin/marks/:id` endpoints so a change is actually saved to the database
instead of being silently overwritten by the next SQLite sync.

## Fixes from the latest scale-testing pass

- **Password reset was broken** — the SQL statement in
  `/api/accounts/password-reset/confirm` had a corrupted `UPDATE` clause and
  never actually updated the stored password hash. Fixed and covered by the
  `password reset changes the password and consumes the token` backend test.
- **Re-uploading a CSV for a mark that was still Draft/Submitted/Approved was
  wrongly rejected** as "Mark already exists", even though the intent of the
  `ON CONFLICT ... DO UPDATE` SQL was to allow correcting marks before they are
  published. Only `Published`/`Locked` marks are now protected from being
  overwritten by an import; anything earlier in the workflow can be safely
  re-imported (e.g. to fix a typo before publication).
- **Deleting a student who already had marks on file failed** with a SQLite
  `FOREIGN KEY constraint` error, because the `marks` table only cascades on
  student ID *rename* (`ON UPDATE CASCADE`), not on delete. `DELETE
  /admin/accounts/:id` now removes the student's marks first inside the same
  transaction, so account deletion never fails once a student has results.
- **Bulk submission ZIP downloads** now fetch every file in parallel with
  `Promise.allSettled` instead of one at a time, and a single failed/missing
  submission is skipped and reported instead of aborting the whole download —
  important once a class has dozens of submissions.
- **A student with zero *published* marks yet caused `/student/marks/:schoolId/:studentId`
  to return `404`.** Having only Draft/Submitted/Approved marks (or being a
  brand-new learner) is a normal empty state, not an error, but the frontend
  treated any non-2xx response as "the API is unavailable" and silently fell
  back to unreliable browser-only mode — which could look like the site
  "signed you out" or stopped syncing after a page refresh. The endpoint now
  always returns `200` with an (possibly empty) array, so the SQLite sync
  stays connected even for students who don't have published results yet.
- **Assignments and submissions now have realistic demo data out of the box**:
  four sample assignments (Orientation, Biology, Computer Science, Business)
  and five pre-canned submissions across the bulk-seeded demo students —
  several awaiting review (so the "Download all submissions (ZIP)" bulk
  button has something to bundle immediately), one closed and marked with a
  downloadable "marked ZIP" and a passing score, and one marked below the
  passing threshold to demonstrate remediation. All demo submission names,
  courses and year levels match the `STU-002`–`STU-050` accounts seeded in
  `backend/db.js`.
- **Results page search for staff**: main admins and admins now have a "Find
  student" search box on the Results page (in addition to the existing
  remediation/passing filter) so they can quickly locate one learner among
  dozens to remark, correct, or continue the publication workflow, instead of
  scrolling through every result.

### Is signing in as a different user "logging out" the previous one?

Yes — that is expected, by design, for a local single-browser demo. The
backend keeps one session cookie per browser; signing in as a new user
replaces that cookie with a new one, which ends the previous user's session
in that browser. This mirrors how most real systems behave when the same
browser is used to switch between accounts. To have two accounts signed in
at once, use two different browsers (or one regular window plus one private/
incognito window) — each keeps its own cookie jar and can hold a separate
session.

## Tests & Exams (auto-marked, separate from Assignments)

A new **Tests & Exams** page sits alongside Assignments in the main navigation
for every role. Unlike Assignments (which are file/ZIP submissions marked by
staff), Tests & Exams are short multiple-choice quizzes that are **marked
automatically the instant a student submits them** — useful for quick
subject-matter checks (e.g. a Biology concept quiz) that don't need a human
marker for the first pass.

- **Staff (admin/main-admin)** can add, edit, and delete tests from the same
  page. Each test has a title, subject, course, optional year level, a
  passing mark, a maximum number of attempts, a duration, and a list of
  multiple-choice questions with the correct answer marked.
- **Students** only see tests for their own course (and year level, if the
  test specifies one). Starting a test shows one question at a time's worth
  of options; submitting immediately scores it against the answer key and
  shows a pass/remediation notification, consistent with the existing
  60%-style passing-mark pattern used for assignment marks.
- Each attempt is recorded (attempt number, score, date); students are capped
  at the test's `maxAttempts`, and once attempts run out they're told to
  speak to their instructor about remediation instead of being able to
  retake indefinitely.
- Staff see a per-test table of every eligible student (filtered by the same
  course/year dropdowns used elsewhere) with attempts used, best score, and a
  status column (`Pending`, `Passed`, `Remediation recommended`, or
  `Failed — remediation needed` once attempts are exhausted). A search box
  narrows the table down to one student by name or student ID, the same
  pattern used on the Results page.
- Demo data ships with three ready-to-try tests — an Intro to Algorithms quiz
  (Computer Science, Year 1), a Cell Biology exam (Biology, Year 2), and a
  Business fundamentals test (Business Management, Year 1) — so the feature
  can be exercised immediately with the seeded demo students.
- Test definitions and attempts are stored under the `portal-tests` and
  `portal-test-attempts` local-storage keys and are wired into the same 1s
  local-refresh sync loop as assignments/marks, so they behave consistently
  with the rest of the portal's offline/local-only sync model.
- **A passed/failed test now counts toward the student's overall average**:
  each best attempt is written into the same `marks` list Results/Overview
  read from, tagged with a `TEST-<id>` assessment ID (separate from
  `ASSIGN-*` and CSV-imported IDs so it can't collide with an assignment or
  CSV mark for the same student). This means a test result shows up on the
  Results page exactly like an assignment mark or an imported CSV mark —
  with its own grade, pass/remediation feedback, and publish date — and
  is included in the student's total weighted percentage.

### SQLite sync check — what was found and fixed this round

While verifying the new feature, two small but real sync/display issues were
found and fixed:

1. **Test results didn't feed the passing average.** Originally, taking a
   test only wrote to the local `portal-test-attempts` key, so a passed or
   failed test never appeared on the Results page and never affected the
   student's average — even though the Tests & Exams table showed
   "Passed"/"Remediation recommended" for staff. Fixed by writing each best
   attempt into the same `marks` array used by Results/Overview (see above).
2. **The Overview page briefly showed a misleading student/results count
   right after signing in as staff.** The dashboard renders instantly from
   whatever is in `localStorage` (so the page never looks blank), but the
   real numbers come from the first SQLite `/admin/data` sync, which can
   take a second or two after login. In that gap the "Students" and "Results
   published" tiles briefly showed the old local-only demo numbers (e.g.
   "1") before flipping to the real seeded totals (e.g. "50"), which could
   look like data had gone missing. Fixed by showing "Syncing…" for those two
   tiles until `apiConnected` is confirmed true, instead of a stale number.

Both are cosmetic/consistency fixes; no data was ever actually lost — the
underlying SQLite data was always correct, only the first render of two
numbers was momentarily wrong.

## Suggested UI improvements

For the next iteration, consider:

- **Paginated learner/result tables.** With 50+ demo students the Results,
  Accounts, and Tests & Exams tables are already long; paginating or
  virtualising them (e.g. 20 rows per page) would keep the UI snappy at
  hundreds of real students without changing the data model.
- **A visible "last synced" timestamp**, not just a connected/offline dot, so
  staff can tell at a glance how fresh the numbers on screen are — useful
  now that syncing takes a second or two after login (see the Overview fix
  above).
- **Accessible colour-contrast checks** for the pass/remediation pill colours
  and dark mode, and **sortable columns** on the Tests & Exams and Results
  tables (by score, attempts, or student name) instead of only filtering.
  A compact mobile action menu (a single "⋯" menu instead of several
  side-by-side buttons) would also help on narrow screens.
- **A visual progress bar or ring for "attempts remaining"** on the student's
  Tests & Exams cards, and a small trend arrow on the Results page showing
  whether a student's average moved up or down after their latest
  test/assignment mark.
- **Grouping the Results page passing average by category** (Assignments vs
  Tests vs CSV-imported marks) in addition to the current single overall
  percentage, so students and staff can see at a glance which type of work
  is pulling the average down.

These improvements reduce visual clutter and improve usability without changing the local data model.

## How this would work in production: tests, exams, and the passing average

The demo stores test definitions and attempts in the browser (`localStorage`)
and mirrors passed/failed results into the same in-memory `marks` array used
by Assignments and CSV imports, which is enough to demonstrate the full
workflow locally. On an actual production deployment, the same feature would
be re-implemented server-side, matching the pattern already used for the
marks workflow:

1. **New SQLite tables** — `tests` (id, title, subject, course, year_level,
   passing_mark, max_attempts, duration_minutes), `test_questions` (test_id,
   question, options JSON, correct_index), and `test_attempts` (student_id,
   test_id, attempt_number, score, answers JSON, taken_at). Foreign keys back
   to `users`/`tests`, a `UNIQUE(student_id, test_id, attempt_number)`
   constraint, and indexes on `student_id`/`test_id`, mirroring the existing
   `marks` table's constraints.
2. **Server-side marking only** — the correct-answer key would never be sent
   to the browser. The student's client would only receive the questions and
   options; `POST /student/tests/:id/attempt` would accept just the chosen
   answers, look up the correct answers server-side, compute the score, and
   insert the attempt in one transaction — this prevents a student from
   reading the answer key out of browser dev tools, which the current local
   demo (correct answers embedded in the frontend bundle) does not protect
   against and is explicitly a demo-only shortcut.
3. **Feeding the passing average** — on each attempt, the same transaction
   would upsert a row into `marks` with an assessment ID like `TEST-<id>`
   (exactly as the demo does client-side), so `GET /student/marks/...` and
   `GET /admin/data` continue to be the single source of truth the Results
   page reads from, and the workflow states (Draft → Submitted → Approved →
   Published → Locked) and audit logging already built for marks apply to
   test results too — e.g. a test could be auto-marked into `Submitted` and
   still require an admin to `Approve`/`Publish` it before the student sees
   it, if a school wants a human check on auto-marked results before they're
   visible.
4. **Where the pass/fail popup would come from** — instead of the frontend
   computing `score >= passingMark` locally, the attempt endpoint's response
   would include `passed`/`remediation` flags computed from the same
   `passing_mark` column enforced by a `CHECK` constraint in the database, so
   the passing threshold can only ever be changed in one place (the test's
   row, editable by main-admin/admin) and can't drift between the frontend
   and backend.
5. **Result page display** — no change needed to the Results page's shape;
   because test results are written as ordinary `marks` rows, they appear
   automatically in the student's percentage/weighting/grade breakdown, the
   admin's remediation-vs-passing filter, and the CSV/PDF export, exactly
   like assignment or CSV-imported marks do today.

## Language toggle (South African official languages)

A **language selector** now appears on the sign-in page and in the signed-in
topbar (next to the dark/light mode toggle), letting anyone switch the UI
between English and the other 10 official South African languages: Afrikaans,
isiZulu, isiXhosa, Sepedi, Setswana, Sesotho, Xitsonga, siSwati, Tshivenda and
isiNdebele. It currently covers navigation labels, the topbar heading, the
dark/light-mode button, sign-out, and every string on the login/register/
forgot-password screens.

- **Why the previous "syncing issue" can't happen**: language choice is stored
  under a **per-account** browser key, `portal-language-<username>` (or
  `portal-language-guest` before anyone signs in), which is completely
  separate from every shared/synced key (`portal-accounts`, `portal-marks`,
  `portal-assignments`, `portal-tests`, etc.) and is **never** sent to the
  SQLite backend or included in the 5-second `/admin/data` sync or the 1-second
  local refresh loop. Practically: switching to isiZulu as `student` and then
  signing out and in as `admin` leaves `admin`'s UI in whatever language
  `admin` last chose (English by default) — it does not inherit the previous
  session's language, and marks/assignments/results data is completely
  unaffected because the feature never touches those keys.
- **Verified**: signed in as `student`, switched to isiZulu (confirmed every
  nav label, heading, and login string translated), signed out, signed in as
  `admin`, and confirmed the admin session was back to English with no trace
  of the student's language choice — while both accounts' Overview tiles still
  synced correctly from SQLite.
- **On an actual server**: the same per-account isolation principle would move
  from `localStorage` to a `language` column on the `users` table (or a small
  `user_preferences` table), set via `PUT /me/language` and returned as part of
  the session/login response, so the preference follows the account across
  devices instead of being tied to one browser — but it would remain scoped
  strictly to that one user's row, for the same reason it must never be part
  of shared sync payloads today.
- **Still to translate** (kept in English intentionally, as a starting point
  rather than a full localisation of every data-entry screen): course names,
  assignment/test content typed in by staff, and CSV/report contents — a full
  production rollout would extend the same `TRANSLATIONS` dictionary pattern
  to those screens' static labels while leaving user-entered content as typed.

## Full functional test pass and a real bug found/fixed

After the language toggle work, every page was clicked through end-to-end as
`mainadmin`, `admin`, and `student` (Overview, Accounts, CSV uploads, SQLite
data, Courses, Assignments, Tests & Exams, Results, Profile, Design) with the
backend and a production build running together, and the full backend and
frontend automated test suites were re-run.

- **Bug found and fixed**: the Results page's "Correct score" control (added
  earlier so admins can fix a mistake on a **Locked** mark) called
  `PATCH /admin/marks/:id`, but that endpoint rejected **any** edit to a
  `Published` or `Locked` mark with a 409 error — so clicking "Correct score"
  always failed silently with a "Could not update the score" notice. Fixed by
  updating the endpoint to only block edits to `Published` marks (they must be
  moved to `Locked` first, keeping the workflow meaningful) while allowing
  `Locked` marks to be corrected, exactly as the UI promises. Corrections are
  now logged as a distinct `marks_corrected` audit event (separate from the
  normal pre-publish `marks_edited` event) so every after-the-fact fix stays
  traceable. Verified live: locked a published mark, used "Correct score" to
  change 94% → 88%, and the change saved and displayed immediately.
- A regression test (`locked marks can be corrected by an admin but published
  marks cannot`) was added to `backend/test/backend.test.js` to lock this
  behaviour in — all 5 backend tests and the frontend test pass.
- Everything else checked out: nav/topbar translations, sign-out, dark mode,
  CSV bulk student downloads (30/50/75/100), assignment download/ZIP-upload
  buttons, the Tests & Exams attempt/retake limits, course/year persistence
  across a page refresh (no unexpected sign-out), and the Results workflow
  dropdown (Draft → Submitted → Approved → Published → Locked) all worked as
  expected with no console errors.

## Example mark import

Main administrators and administrators can use **CSV uploads** with this header:

```csv
studentId,assessmentId,mark
STU-001,BIO-001,92
STU-002,BIO-001,58
```


The Results screen supports adding an individual mark, filtering passing/remediation records, deleting records, moving marks through the protected workflow, correcting locked records, and recording remediation date, time, attempt count, and completion. The same passing threshold (60% by default) drives the staff and learner filters. Duplicate student/assessment marks and duplicate assignment titles within a subject are rejected.

The demo uses a common high-school grading scale: A (70–100), B (60–69), C (50–59), D (40–49), and E/U (0–39). Course and assessment records can be adapted for local GCSE, A-level, college, or university rules.

## Storage and server deployment

The browser demo stores UI data in `localStorage`. The optional backend uses SQLite commands and stores the normal SQL database file at `backend/school_data/portal.sqlite`; it is not a hosted SQL service. Runtime uploads and database files are ignored by Git.

Learner profiles now require a course choice and a unique student ID. Staff-created learners receive an explicitly labelled temporary username and `Welcome123!` password, which they can replace after signing in. Duplicate IDs and usernames are rejected before saving. After self-registration, the learner sees a dedicated **Sign in** button. The current browser storage location is shown below the workspace heading; backend records are stored in `backend/school_data/portal.sqlite`.

Every account now has a **Profile** page for changing name, username and email; learners can also update their student ID and course. Username and student-ID changes are checked against existing accounts. Only the main administrator can create another main-administrator account from **Accounts**.

The signed-in workspace displays the current date using the device locale. Student results calculate a normalized weighted average; remediation entries retain the original mark and show minimum, maximum, and average across recorded attempts. The campus initials in the loading, login, and workspace branding are generated from the configured school name.

Assignment submissions are limited to PDF/document/image/ZIP extensions and 25 MB, with executable extensions rejected before local storage. Students confirm uploads and can remove or replace a file until staff close the submission. Administrators can download the submitted file, close it, enter a final mark, and print a mark summary through the browser's **Save as PDF** dialog; the published mark is also added to the learner's Results profile with remediation feedback when below the configured threshold.

Staff can modify assignment details or mark an assignment completed. Completed assignments and assignments past their due date no longer accept student uploads. After closing a submission, staff can upload a marked feedback package as a ZIP (maximum 25 MB); the learner sees a **Download marked ZIP** button alongside the published mark. The browser demo validates extensions and size, but a production deployment should also virus-scan uploads server-side before making them downloadable.

Assignments support an explicit end date and time. Staff can delete an incorrect assignment after confirmation. Students see completed/expired assignments with a strike-through state, and a normal submission is marked completed immediately with a notice that marking is pending. If the published mark is below the passing threshold, the same submission record reopens for a remediation upload; staff can download that remediation file, enter the replacement mark, and upload a marked ZIP for the learner.

The Courses workspace now includes staff course administration. Added courses are stored locally and are available for learner enrolment and assignment/course matching. Staff submission cards retain the learner name, student ID, course, assignment, and uploaded file together so the correct work is downloaded and reviewed.

Administrators can remove administrator-added courses from the Courses page after confirmation; built-in courses are protected. Course additions/removals use the same local-storage synchronization as assignments, so another open tab refreshes without logging out.

Assignment changes are synchronized across open browser tabs without requiring sign-out (local storage events plus a short refresh interval). Staff can review each matched submission, close it, enter its mark directly on the submission card, and the result is immediately available in the learner’s Results area. Once an assignment is completed or expired, the learner cannot download/remove or replace the submitted file.

Results recalculate the grade and remediation status whenever staff change the passing percentage; saved marks are never silently reinterpreted using the old threshold. For learners: open **Results** after publication, download the summary/marked ZIP, read staff feedback, and follow the remediation deadline if shown. For staff: verify the learner, course, assessment and submission, enter a 0–100 score, add clear feedback, check the calculated threshold result, then publish and provide the marked feedback package.

### Session persistence, course selection, and the submissions table

Two long-standing local-only bugs were fixed so the SQLite-backed workspace behaves the way a real portal should:

- **Refreshing the page no longer signs anyone out.** The backend already issued an `HttpOnly` session cookie on sign-in, but nothing on the frontend used it to restore state after a reload — `App` simply reset to a blank login screen every time. A new `GET /api/accounts/me` endpoint reads the cookie via the existing `sessionUser()` helper and returns the current account if the session is still valid; the React app calls it once on mount and repopulates the signed-in user automatically. If the cookie has expired or the API is offline, the login screen is shown as before.
- **A student's chosen course and year of study now persist to SQLite**, not just to browser `localStorage`. The `users` table gained `course` and `year_level` columns, and a new `PATCH /api/accounts/course` endpoint (self-service, student-only) lets a learner set both from the **Courses** page; the change is written straight to the database, audit-logged as `student_account_changed`, and immediately reflected for admins in `/admin/data`. Previously this only ever updated local React state, so the periodic 5-second database sync silently reverted it — that race condition is now gone because the database itself is the source of truth.
- **All submissions are shown in one searchable, filterable table** on the **Assignments** page instead of being split into small cards per assignment (which became unreadable once a course had many assignments and many learners). Staff can search by student name/ID/assignment title, and filter by assignment, course, year of study, and status (open / closed-awaiting-mark / marked) — all client-side and instant. Grading, downloading, closing, and uploading marked ZIP feedback all happen inline in the table row, and the bulk "download all submissions as one ZIP" button remains available per assignment above the table.
- **Students are grouped by year of study** (1st through 6th year, since course lengths vary) using the same `year_level` field set on the Courses page; the submissions table's Year column and year filter use this to make it fast to find, say, "all 2nd-year Computer Science submissions" once a school has many learners.

### Testing a CSV import

Create a plain-text file named `sample-marks.csv` in the project folder with exactly this content:

```csv
studentId,assessmentId,mark
STU-001,BIO-001,92
STU-001,BIO-002,58
```

Start the backend and use the staff **CSV uploads** screen to select it. The browser validates the complete file before saving anything locally, and the backend performs the same all-or-nothing validation when `/admin/upload-marks` is used. Valid rows appear as Draft marks. Invalid file extensions, missing headers, blank files, malformed student/assessment IDs, non-numeric or out-of-range marks, duplicate student/assessment pairs, unknown students, and marks that already exist are rejected with an error message; no rows from a rejected batch are imported. Use UTF-8 CSV with the exact headers `studentId,assessmentId,mark` (the snake_case aliases `student_id,assessment_id` are accepted by the backend). Quoted values are supported by the browser demo for simple fields. The browser UI remains available on other devices only when the frontend is hosted and configured to call a reachable backend; the current demo itself is local-browser storage.

To make this available on an actual server: move authentication fully to the backend, set a strong `DB_PATH` outside the repository, use HTTPS and secure cookies, configure a real mail provider for password-reset delivery, use a managed database/object store for production files, add backups and migrations, restrict CORS to the frontend origin, run behind a reverse proxy/process manager, set production secrets through environment variables, and add monitoring, malware scanning and privacy/retention controls before handling student data.

## Production architecture

For a real deployment, move authentication and authorization to the backend. Store users, assignments, submissions and results in MySQL or PostgreSQL; store file bytes in S3-compatible object storage (or a protected filesystem), and store only metadata/keys in SQL. Hash passwords with Argon2 or bcrypt, use secure HTTP-only sessions, validate CSV columns and file size/type, and enforce role checks on every API route. Never ship the demo passwords or encryption key to production.

Example PostgreSQL starting point:

```sql
CREATE TABLE users (id BIGSERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('main-admin','admin','student')));
CREATE TABLE assignments (id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL,
  subject TEXT NOT NULL, due_at DATE NOT NULL, object_key TEXT NOT NULL, created_by BIGINT REFERENCES users(id));
CREATE TABLE results (id BIGSERIAL PRIMARY KEY, student_id BIGINT REFERENCES users(id),
  subject TEXT NOT NULL, score NUMERIC(5,2), grade TEXT, feedback TEXT);
```

The same tables work in MySQL after replacing `BIGSERIAL` with `BIGINT AUTO_INCREMENT`. Add migrations, backups, TLS, virus scanning and audit logs before handling real student data. Deploy the React build (`npm run build`) behind a reverse proxy and configure the API URL with an environment variable.

### Making session restore, course sync, and the submissions table production-ready

The patterns introduced in this update (`GET /api/accounts/me`, `PATCH /api/accounts/course`, and the consolidated submissions table) are demo-appropriate but would need to change for a real, multi-server deployment:

- **Sessions**: the demo keeps sessions in an in-memory `Map` inside `server.js`, so restarting the process or running more than one server instance loses every session. In production, back sessions with Redis or a database table (e.g. `express-session` with `connect-redis`/`connect-pg-simple`) so `GET /api/accounts/me` keeps working across restarts and horizontal scaling, and set `Secure`, `SameSite=Strict`, and a short rolling expiry on the cookie once served over HTTPS.
- **Course/year updates**: the self-service `PATCH /api/accounts/course` endpoint should additionally validate the course against a real `courses` table (foreign key) instead of accepting any string, and course/year changes for students already enrolled in a term should be gated behind an academic-calendar rule (e.g. no changes after add/drop deadline) rather than always allowed.
- **Submissions table at scale**: the demo filters/searches the submissions table entirely in the browser, which is fine for a few hundred rows but should move to server-side pagination, search, and filtering (e.g. `GET /admin/submissions?search=&course=&year=&status=&page=`) once a school has thousands of learners, so the browser never has to download every submission row at once.
- **File storage**: submission files and marked-ZIP feedback currently live only as in-browser object URLs (`URL.createObjectURL`), so they vanish on refresh/across devices. A production build must upload files to the backend (multer is already used for CSV) and store them in object storage (S3-compatible) or a protected uploads directory, with the submissions table linking to a stable download URL/API route instead of a blob URL.

