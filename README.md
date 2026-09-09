# Meridian Learning Hub

A responsive, local-first education portal prototype for administrators and students. It runs in a browser on Windows, Linux, macOS, iOS and Android through the same responsive web app. The selected app name is **Meridian Learning Hub**; existing custom institution names remain unchanged, while the old default name is migrated safely.

## Capacity expectations

This is a browser-local demonstration, not a concurrent production service. A single browser profile can comfortably manage roughly 100–500 learner records and 10–30 administrator accounts, depending on device memory and the size of local submission metadata. `localStorage` is usually limited to around 5–10 MB per browser origin, and uploaded file object URLs are temporary; large files or many learners will reach those limits quickly.

With the optional SQLite API on a modern local machine, plan for approximately 1–10 concurrent administrators and 100–1,000 learners for a responsive demo workload. SQLite is excellent for local/small-team use, but one writer at a time and local disk/file handling become bottlenecks for simultaneous marking or uploads. For a real deployment, use a server database, object storage, API pagination, background file processing, caching, monitoring, and load testing. Exact capacity depends on hardware, file sizes, network, and workload; there is no guaranteed “no slowing down” user count without measuring the target environment.

## Installation

### Requirements

| | Minimum | Notes |
| --- | --- | --- |
| **Node.js** | 18 or newer | 20 LTS or 22 LTS recommended. Check with `node --version`. |
| **npm** | 9 or newer | Ships with Node. Check with `npm --version`. |
| **Disk** | ~600 MB | Mostly `node_modules`; the database itself is a few MB. |
| Git | any | Only needed to clone. |

Nothing else is required — no database server to install, no Docker, no accounts to
register. The database is a single SQLite file created automatically on first run.

### Install

The project is two npm packages — `frontend/` and `backend/` — and **each needs its own
`npm install`**. Installing only one is the most common setup mistake:

```bash
git clone <your-repository-url>
cd student-website-project

# 1. Backend (the SQLite API)
cd backend
npm install

# 2. Frontend (the React portal) — note the ../
cd ../frontend
npm install
```

### Run

Two terminals, both kept open:

```bash
# Terminal 1 — API on http://localhost:5000
cd backend
npm start

# Terminal 2 — portal on http://localhost:3000
cd frontend
npm start
```

Then open **http://localhost:3000** and sign in with `mainadmin` / `ChangeMe123!`.

Schools and colleges setting up for real use should follow
[Clean install: starting with no demo data](#clean-install-starting-with-no-demo-data)
instead, so no demo learners or demo passwords are ever created.

### GitHub Codespaces

Codespaces works, with one difference: the frontend must be told where the API is,
because port 5000 is not on `localhost` from the browser's point of view.

1. Run both `npm install` steps and both `npm start` commands as above.
2. Open the **Ports** panel, find port **5000**, and set its visibility to **Public**
   (right-click → Port Visibility → Public). Without this the browser is blocked from
   reaching the API and the portal falls back to offline mode.
3. Copy the forwarded URL for port 5000, then restart the frontend with it:

```bash
cd frontend
REACT_APP_API_BASE="https://<your-codespace>-5000.app.github.dev" npm start
```

The status line under the workspace heading shows whether the API connected. If it
reads *offline/browser fallback*, port 5000 is either not running or still private.

### Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Module not found: Error: Can't resolve 'jszip'` | Dependencies were not installed in `frontend/`. Run `npm install` there. If it persists, delete `frontend/node_modules` and `frontend/package-lock.json`, then `npm install` again. |
| `Cannot find module 'express'` / `'sqlite3'` | Same problem in `backend/`. Run `npm install` inside `backend/`. |
| Portal loads but shows *offline/browser fallback* | The API is not reachable. Confirm `npm start` is running in `backend/`, and on Codespaces that port 5000 is Public. |
| `EADDRINUSE: address already in use :::5000` | Another process holds the port. Stop it, or start the API on another port with `PORT=5001 npm start` and set `REACT_APP_API_BASE` to match. |
| `npm install` fails compiling `sqlite3` | Usually an unsupported Node version. Check `node --version` is 18+; on very new or unusual platforms a prebuilt binary may not exist, so install Node 20 or 22 LTS. |
| Sign-in rejects the demo passwords | The database was created with demo seeding off. Either use the account made by `npm run create-admin`, or delete `backend/school_data/portal.sqlite` and restart to regenerate the demo data. |

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

## Clean install: starting with no demo data

Everything above describes the **demo**, which deliberately ships with 50 sample learners, sample
marks, assignments, tests and the publicly documented passwords in the table above. A real school
must not inherit any of that. Two flags — one per half of the app — give you a completely empty
portal.

Demo data lives in two separate places, so **both** flags are needed:

| Where | What it seeds | Flag |
| --- | --- | --- |
| `backend/db.js` | Accounts, marks, assessments (SQLite) | `SEED_DEMO=false` |
| `frontend/src/App.js` | Assignments, submissions, memos, tests (browser `localStorage`) | `REACT_APP_SEED_DEMO=false` |

Both default to seeding, so cloning and running the project still gives you the working demo. Set
them to `false` and you get an empty portal instead.

### Setting up a clean install

**Order matters.** Run `create-admin` *before* ever starting the server normally — a plain
`npm start` creates the demo accounts on first run, and they would then have to be cleared with
`npm run reset-db`.

```bash
# 1. Backend: create the first real administrator, then start with seeding disabled
cd backend
npm install
npm run create-admin       # prompts for name, username and password (never echoed or logged)
npm run start:clean        # same as npm start, but with SEED_DEMO=false

# 2. Frontend: run without the demo assignments/tests/submissions
cd ../frontend
npm install
```

Then start the frontend with the demo flag off:

```bash
# macOS / Linux
REACT_APP_SEED_DEMO=false npm start

# Windows PowerShell
$env:REACT_APP_SEED_DEMO="false"; npm start
```

For a production build, set the same variable before `npm run build`. It is read at **build
time**, so a bundle built without it will still contain the demo assignments even if the backend
is clean.

`npm run create-admin` is the only way in on a clean install, since no accounts exist. It asks for
the password interactively rather than taking it as an argument, so it never lands in shell history
or a process listing, and stores only a bcrypt hash. It refuses duplicate usernames, passwords under
8 characters, and mismatched confirmations, and warns you if a main administrator already exists.
Both `create-admin` and `reset-db` disable seeding internally, so neither can accidentally create
demo accounts as a side effect of opening the database.

The **Demo accounts** box on the sign-in page hides itself automatically in clean mode, so the
demo passwords are never displayed to real users.

### Clearing an existing database

If you already ran the demo and want to reuse the same database file, wipe it rather than hunting
for the SQLite file:

```bash
cd backend
npm run reset-db             # shows what would be deleted, changes nothing
npm run reset-db -- --yes    # actually clears every table
npm run create-admin
```

The dry run prints the row counts first so you can see exactly what you are about to lose. The wipe
runs inside a single transaction in foreign-key-safe order, so it can never leave the database
half-cleared, and it resets the `AUTOINCREMENT` counters so a clean install starts from id 1. The
schema itself is preserved.

Deleting `backend/school_data/portal.sqlite` also works — the schema is recreated on next start.

Students will also want to clear the browser side (`localStorage`) if they previously loaded the
demo, since assignments and submissions are cached there: open DevTools → Application → Local
storage → clear, or use a private window.

### Verified behaviour

Tested from a pristine copy of the repository (no `node_modules`, no database), installed and run
exactly as a new user would:

| Check | Result |
| --- | --- |
| `npm install` + `npm run build` in `frontend/` | Compiles successfully — `jszip` installs from the lockfile |
| `npm install` + `node --test` in `backend/` | 7/7 tests pass |
| `npm run create-admin` on a fresh database | Creates exactly **one** account, no demo data |
| `npm run start:clean` | 0 marks, 0 assessments, 1 user — schema intact |
| Clean-install sign-in | The created account signs in and gets an empty workspace |
| Demo credentials on a clean install | `mainadmin` / `ChangeMe123!` rejected with **HTTP 401** |
| Default `npm start` | 53 users, 148 marks — the full demo, unchanged |
| `REACT_APP_SEED_DEMO=false` build | No demo learner names, assignments or tests in the bundle |


The main administrator can create/delete administrators and use **Design** to change the institution name, accent colour, background colour, text colour and portal font. Administrators can publish any file type as an assignment and edit result feedback. Students can view/download assignment entries and see their published results. Local browser storage is for demonstration only; uploaded binary files are represented by their metadata until a server storage API is connected.

Marks now follow a protected Draft → Submitted → Approved → Published → Locked workflow. This applies the SCAMPER method to publication: **Substitute** manual exposure with gated transitions, **Combine** approval with audit and notifications, **Adapt** the workflow to bulk imports, **Modify** results with weighting/publication metadata, **Put to another use** by exporting student summaries, **Eliminate** partial invalid imports, and **Reverse** the process when a correction is needed before publication. Unpublished marks are staff-only, and published/locked results notify students in the portal.

## Folder guide

- `frontend/` — React single-page portal, styling and browser-local account/content state.
- `frontend/src/App.js` — local demo screens and workflow components (Accounts, Courses, CSV uploads, Results).
- `frontend/src/App.css` — responsive layout, theme tokens, workflow badges and form styling.
- `backend/` — Express local API, upload handling, authenticated data views and SQLite database helpers.
- `backend/scripts/` — operational scripts: `create-admin.js` (first administrator on a clean install), `reset-db.js` (clear all data), `start-clean.js` (run the API with demo seeding off).
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

## Tests & Exams dropdown fix, essay questions, printable results, showcase image, and code of conduct

This update fixed one real bug and added five requested features:

- **Course dropdown fix (Tests & Exams edit form)**: the `courses` list used throughout the app is an array of `[name, requirement]` tuples, not `{name, requirement}` objects. The Tests & Exams test-editing form was reading `course.name` (always `undefined`) instead of destructuring the tuple, so every option in the dropdown rendered blank. Fixed to destructure `[name]` — the dropdown now shows all five course names and can be selected/saved correctly.
- **Long-answer / essay questions**: staff can now add a "Long answer / essay (staff-marked)" question alongside multiple-choice questions on any test. Essay answers are never auto-scored — if a test contains only essay questions, no mark is auto-published (avoiding a misleading 0%), and any essay answers are flagged `needsReview` for staff. Staff see a "Long-answer review" column on the per-test student table with a "View answers" button that opens a read-only panel of the student's question/answer pairs so they can mark it manually and enter the mark through the normal Results workflow.
- **Detailed, printable result summary**: "Download summary" (student view) and "Print result summary" (staff view) now open a print-ready window instead of a plain CSV. It includes the student's ID, full name, the date the sheet was generated, and — for every result row — the subject, assessment, score, grade, status, publish date, and the student's overall ranking against the whole school (e.g. "Top 12% (rank 6 of 50)"), calculated locally from all Published/Locked marks stored in SQLite. Everything is laid out as an HTML table; use the in-page "Print / Save as PDF" button (or the browser's own print dialog) to save it as a PDF — no PDF-generation library or external service is used, keeping the demo fully local.
- **School showcase image**: the Design page now has a "School showcase image" upload. The chosen image is stored as a base64 data URL as part of the saved theme (in `localStorage`, alongside the existing accent/background/font settings — never uploaded anywhere), and is shown as a soft-focus banner behind the sign-in page's welcome panel so the institution can showcase its campus.
- **Code of conduct acknowledgment**: before uploading a ZIP submission for any open assignment, students must tick "I acknowledge this is my own work" under a visible code-of-conduct notice. The upload control only becomes available once the checkbox is ticked, and the checkbox resets after each successful submission so it must be re-confirmed for every new upload.

Also extended the South African language toggle with a few more translated keys used on the Results page (download/add/delete/search/no-records/passing-status labels) across all 11 official languages. Full page-by-page translation of every remaining string (Overview, Assignments, Courses, Tests & Exams body copy, etc.) is a larger follow-up piece of work — the navigation, sign-in, topbar, and the highest-traffic Results actions are translated today, with the rest falling back to English.

Verified with `npm run build` (frontend), `node --test` (backend, 5/5 passing), `npm test` (frontend, 1/1 passing), and a live walkthrough as both `mainadmin` and `student` confirming: the course dropdown populates and saves, the essay question type and "Add long-answer question" button appear correctly, the printable summary opens without errors, the showcase image upload control renders, and the code-of-conduct checkbox gates every assignment upload.

## Course/year assignment distribution, missed-deadline remediation, archives, term reports and top achievers

### 1. Assignments are distributed by course and year of study
Every assignment now carries `course`, `yearLevel`, `academicYear` and `term`. A learner only sees work that
matches the course they chose on the **Courses** page and the year of study they are in:

| Field | Meaning | Empty value |
| --- | --- | --- |
| `course` | Which course the work belongs to | blank = every course (institution-wide work such as Orientation) |
| `yearLevel` | Which year of that course | blank = every year of that course |
| `academicYear` | The calendar year the work was set in | defaults to the current academic year |
| `term` | Term or semester label used on reports | free text |

Staff are never filtered � main admins and admins always see and can mark every assignment. The add and edit
assignment forms expose all four fields, and after saving, the portal reports how many learners will actually
receive the work so nobody publishes an assignment to an empty audience by accident.

Students see a line above their list reading *"Showing work for **Biology** � Year 2"* so it is obvious why the
list looks the way it does, and how to change it.

### 2. Missed-submission warnings lead explicitly to remediation
Two states are calculated from the deadline (`due` + `dueTime`, defaulting to 23:59):

- **At risk** � unsubmitted and due within 72 hours. Shown inline as an amber nudge.
- **Missed** � the deadline has passed and nothing was uploaded. Because staff already control the due date and
  can extend it, a lapse at this point genuinely means remediation, so the wording says so plainly.

Missed work triggers a one-off in-portal notification per assignment. Warned assignment IDs are remembered in
`localStorage` under `portal-missed-warned-<username>`, so the learner is told once rather than nagged on every
page visit. A summary banner at the top of the list counts how many assignments were missed.

### 3. Previous-year archive
Work from an earlier `academicYear` moves out of the active list into a collapsible **"Show previous years of
&lt;course&gt;"** block. Year matching is offset by how long ago the work was set � a learner in Year 2 today was in
Year 1 last year � so their own history actually appears instead of being filtered out. Each archived row shows
the academic year, term, year of study, whether a submission was recorded, the final mark and grade, and a
**Download marked ZIP** button where feedback exists.

### 4. End-of-term / semester report card (new **Reports** tab)
Staff pick a learner and a term and print a report card containing the student ID, full name, course, year of
study, issue date, a table of every subject with score, weighting, grade, pass/remediation outcome and
publication date, the weighted term average, the passing requirement, the progression decision, and their
position in the cohort.

Only **Published** and **Locked** marks are ever included, so a half-finished Draft, Submitted or Approved mark
can never leak onto a report card. Students see the same tab scoped to their own record.

### 5. Top achievers
The same weighted average powers an institution-wide leaderboard of the top 5-10 achievers (staff can adjust the
count). It appears both in the portal and on the printed report card, and the signed-in learner's own row is
highlighted. Averages are weighted by each assessment's `weighting`, so a 100%-weighted exam correctly outweighs
a 10% quiz.

Printing reuses the project's existing approach � `window.open` plus an HTML table plus `window.print()` � so
there is no PDF library and no external service. If pop-ups are blocked the portal says so rather than failing
silently.

### Running on a real server
- **Assignments are still browser-local** (`localStorage` key `portal-assignments`). In production they belong in
  an `assignments` table with foreign keys to `courses` and a year-level column, so a learner sees the same work
  on any device and staff edits reach everyone immediately.
- **`CURRENT_ACADEMIC_YEAR` is a hardcoded constant.** A real deployment should read it from an academic-calendar
  table so terms roll over without a code change.
- **Missed-deadline detection currently runs when the learner opens the portal.** On a server this should be a
  scheduled job that sweeps deadlines and writes notifications, so a learner who never logs in is still recorded
  as needing remediation and staff can report on it.
- **Report cards and the leaderboard should be computed server-side** once the cohort is large, both for speed and
  so ranking cannot be recomputed from data the browser should not hold.

## Marking room: mark against a memo, offline-safe

A dedicated **Marking** tab (main admins and admins only) where staff open a learner's submission
next to the assignment memo and score it criterion by criterion, instead of typing a single number
into a list.

### The workspace
- **Queue** — every submission in one ruled table with the student, ID, assignment, course, year,
  submission date, marking state and mark. Search by name/ID/assignment and filter by course or by
  state (*Not started* / *In progress* / *Released*), so a marker can pick up exactly where they
  left off across a large cohort.
- **Left pane: the learner's work.** Download the submission ZIP (and any remediation attempt).
  The file is already held in the browser, so this works with the API completely down.
- **Right pane: the marking sheet.** One row per memo criterion with its marking guidance, the
  marks available, and a score box that refuses anything outside `0..max`. A total row and a live
  weighted percentage sit underneath, along with a free-text feedback box for the learner.
- **Memos are editable in place.** Every criterion's label, maximum and guidance can be changed,
  new criteria added, and a memo created from scratch for an assignment that has none. Criteria
  maxima rarely sum to exactly 100, so the released percentage is always normalised against the
  memo total — that keeps a 40-mark memo and a 100-mark memo directly comparable.

### Why nothing gets lost
Three independent safeguards, because losing a marker's completed work is the worst possible
outcome for this page:

| Risk | Safeguard |
| --- | --- |
| Tab closed, refresh, crash, power loss mid-marking | **Autosave.** Every keystroke writes the sheet to `portal-marking-drafts`. Reopening the submission restores every score and comment exactly. |
| No connection while marking | **Nothing in the scoring flow touches the network.** The memo, the file and the draft are all local, so a whole class can be marked offline. |
| Connection drops at the moment of release | **Outbox.** The finished mark is written to `portal-marking-outbox` *before* any request is made, and only removed once the API confirms. It retries automatically on reconnect. |

Drafts are keyed per submission **and per marker**, so two admins marking the same class never
overwrite each other's in-progress work. The queue shows the exact time each sheet was last saved.

An outbox entry is only dropped when the server gives a *definitive* rejection — the mark is
already published with a different score, or the student does not exist. Transient failures (API
down, expired session, network glitch) keep the entry queued indefinitely and surface the last
error in the banner, so a stuck queue is diagnosable rather than silent.

### The backend side
`POST /admin/marking/release` is the point where offline work rejoins the database. It is:

1. **Idempotent** by `(studentId, assessmentId)`. The outbox retries until it gets a success, so a
   retry sent after a response was lost in flight must not create a duplicate mark.
2. **Transactional.** The assessment row and the mark row are written inside one transaction, so a
   crash mid-release can never leave a mark pointing at an assessment that does not exist.
3. **Protective.** A mark that is already `Published` or `Locked` will not be silently overwritten
   with a different score — that has to go through the normal unlock/correct workflow, which is
   audited separately.

Every release writes a `marks_published` audit entry tagged `source: "marking-room"`.

This behaviour is covered by the test *"marking room release is idempotent and protects
already-published marks"*, which replays an identical entry, asserts only one row exists, and
checks that a conflicting score and an unknown student are both refused.

### Neater report tables
The report card, top-achievers leaderboard and marking sheet now use a shared `ruled-table` style:
a full grid of cell borders, a solid accent header row, zebra striping, hover highlighting and a
ruled total row. The printed report card matches, with heavier outer borders so the table reads
clearly on paper as well as on screen. Both have dark-mode variants.

### Running on a real server
- **Memos and marking drafts are browser-local.** In production a `memos` table (keyed to the
  assignment) and a `marking_drafts` table (keyed to submission + marker) would let a marker start
  on a desktop and finish on a laptop, and would let a moderator review a colleague's sheet.
- **The outbox should survive a browser wipe.** Today the queue lives only in `localStorage`. For
  real invigilated marking, drafts should sync opportunistically to the server as well, so clearing
  site data cannot destroy unsent work.
- **Submission files are held as in-browser object URLs.** A real deployment stores them on disk or
  in object storage and streams them through an authenticated route, so a marker on another machine
  can open the same file.

## Full-site design and feature regression sweep

Every tab was driven in a real browser as all three roles, in both light and dark mode, and each
defect below was fixed and then re-verified. Backend `node --test` is **7/7**, frontend `npm test`
passes, and `npm run build` compiles clean.

### Design and accessibility

| Problem | Fix |
| --- | --- |
| **Dark mode barely worked.** `.dark-mode` is a stylesheet rule that redefines `--paper`/`--ink`, but the shell set those same variables *inline*. Inline styles always beat stylesheet rules, so the page stayed light while panels went dark — dark text on dark surfaces across all 12 admin tabs. | The shell now omits `--paper`/`--ink` entirely when dark mode is on, letting the stylesheet win. A further ~12 elements (`.eyebrow`, `.muted`, `.welcome`, `.grade`, status pills, `.conduct-box`, `.result-summary`, `.own-row`, `.demo-box`, `.submission`) got dark variants. |
| Low-contrast notification bell and trend text in light mode. | Recoloured both above the 3:1 threshold. |
| The login page ignored the configured theme font and tinted uploaded showcase images with a hardcoded teal, so a re-branded institution still looked like the default. | The font and accent now reach the login page; the image tint is derived from the accent via a `hexToRgba` helper. |

Contrast was measured programmatically rather than by eye — a harness walks every text node under
`main`, computes the relative luminance of its colour against its effective background, and flags
anything under 3:1. **19 page/role combinations now report zero failures** in dark mode.

> If you add a new theme variable, set it *in the stylesheet*, not inline on the shell, or dark mode
> will silently ignore it for the same reason.

### Functional bugs found

- **The notification bell was a dead button.** It had no `onClick`, so every notification the portal
  recorded was write-only — once its toast faded, a student could never read it again. It now opens
  a panel with an unread count, timestamps and *Clear all*.
- **Notifications leaked between accounts.** They were stored in one global list, so a student
  signing in on a shared browser saw staff-only messages about other learners. Each entry now
  records its audience and the bell filters to the signed-in user; *Clear all* only clears that
  user's own items.
- **"Forgot password" was fake.** The form printed a confirmation message and never called the
  backend, even though `POST /api/accounts/password-reset/request` and `/confirm` were fully
  implemented and tested. It is now a real two-stage flow (request token → set new password).
- **CSV import silently accepted unknown assessment IDs**, inventing junk assessments that skew
  every average. The importer now rejects them with a proper error report, unless you tick the new
  **Create missing assessments** checkbox — which is the deliberate opt-in for genuinely new work.
- **Report cards printed "—" for every grade** on marks synced from SQLite, because those rows carry
  no pre-computed letter grade. The grade is now derived from the percentage on screen and in print.

### Also verified working

Sign-in/out and session restore for all three roles; wrong-password rejection; the full
Draft → Submitted → Approved → Published → Locked workflow persisting to SQLite; locked-mark
correction; CSV transactional all-or-nothing rollback with error reports for out-of-range,
non-numeric, duplicate and missing-student rows; results search across 152 marks; bulk submissions
ZIP; the marks/students CSV and data exports; all 11 South African languages (the preference is
keyed per account, so it never leaks between users); and all seven student tabs with zero console
errors.

## Running this on a real server with SQLite

The short answer: **SQLite is a perfectly good production database for this application**, and for a
single school it is very likely the right choice. The common belief that it is "only for testing" is
wrong — but it is wrong for specific reasons worth understanding, because the things that *do* break
SQLite are exactly the things a school portal doesn't do.

### Why SQLite genuinely suits this workload

SQLite is not a server. It is a library that reads and writes one file inside your app's own process.
That removes an entire tier: no database daemon, no connection pool, no network hop, no separate
credentials, no version skew between app and database. What follows from that here:

- **Reads are fast and fully concurrent.** A read is a function call against a memory-mapped file, not
  a round trip. This portal is overwhelmingly read-heavy — students checking results, staff browsing
  submissions, the 5-second sync poll — and SQLite serves unlimited simultaneous readers.
- **The data is tiny.** A 2,000-student school with 20 assessments each is ~40,000 mark rows: a few
  megabytes. SQLite handles databases into the terabytes.
- **Writes are rare and bursty.** Marks are imported in batches and published at end of term. Even a
  large import is milliseconds of actual write time.
- **Backup is a single file**, and the whole database is one portable artefact.

The real constraint is that **SQLite allows only one writer at a time.** Concurrent writes are
serialised, and a writer blocked too long gets `SQLITE_BUSY`. That is fatal for something like a
high-traffic checkout. For a school portal, where simultaneous writes are close to non-existent, it is
a non-issue — *provided it is configured correctly*, which this demo currently is not.

### What must change before this runs on a real server

Ordered by how badly they bite. The first three are not optional.

#### 1. Enable WAL mode and a busy timeout

The single most important change, and it is two lines. By default SQLite uses a rollback journal in
which **a writer blocks every reader**. Write-Ahead Logging lets readers and one writer proceed
simultaneously, removing almost all real-world contention. The busy timeout makes a blocked writer
wait and retry instead of erroring immediately.

In [backend/db.js](./backend/db.js), alongside the existing `PRAGMA foreign_keys = ON`:

```js
db.run('PRAGMA journal_mode = WAL');     // readers no longer block on a writer
db.run('PRAGMA busy_timeout = 5000');    // wait up to 5s for the write lock instead of failing
db.run('PRAGMA synchronous = NORMAL');   // safe under WAL, much faster than FULL
db.run('PRAGMA foreign_keys = ON');      // already present - keep it, it is per-connection
```

`synchronous = NORMAL` is the correct pairing with WAL: durable against application and OS crashes,
risking only the last transaction on sudden **power loss**. `foreign_keys` deserves emphasis — it is
per-connection and **off by default**, so it must be set on every connection or the constraints
declared in the schema are silently unenforced.

#### 2. Run exactly one process

SQLite's locking does work across processes on local disk, but keeping it fast and predictable means a
single Node process owning the file:

- **Do not** run `pm2 -i max`, Node `cluster`, or several containers against one database file.
- Scale vertically. One process comfortably serves a school; the bottleneck will be Node, not SQLite.
- **Never put the database on NFS, SMB or any network share.** SQLite's locking relies on POSIX
  advisory locks, which network filesystems implement incorrectly or not at all — this is the classic
  path to a corrupted database. Local block device only.

This is the honest trade-off. If you ever need multiple app servers behind a load balancer, that is
the moment to move to PostgreSQL — not before.

#### 3. Move sessions into the database

[backend/server.js](./backend/server.js) currently holds sessions in an in-memory `Map`, so **every
restart signs everyone out**. A `sessions` table already exists in the schema and is unused; wiring it
up fixes restarts and costs nothing, since the database is in-process anyway:

```js
// on sign-in
await run('INSERT INTO sessions(id, user_id, expires_at) VALUES(?,?,?)', [token, user.id, expiresAt]);
// on each request
const row = await get(
  'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?',
  [token, new Date().toISOString()]
);
```

Add a periodic `DELETE FROM sessions WHERE expires_at < ?` so it cannot grow forever. Same for
`password_resets`.

#### 4. Cookies, secrets and origins

Over HTTPS the session cookie needs `Secure`, `HttpOnly`, `SameSite=Strict` and a rolling expiry.
Restrict CORS to the real frontend origin instead of a wildcard, and keep the database outside the
deployment directory using the `DB_PATH` variable [backend/db.js](./backend/db.js) already honours:

```bash
DB_PATH=/var/lib/meridian/portal.sqlite
```

That keeps the data clear of any directory a deploy wipes and replaces.

#### 5. Don't seed demo data into production

Run the API with `SEED_DEMO=false` (`npm run start:clean`) and build the frontend with
`REACT_APP_SEED_DEMO=false`, so no demo learners or demo passwords ever exist on the server. Create
the first administrator with `npm run create-admin`, which prompts for the password rather than
taking it as an argument. See [Clean install: starting with no demo data](#clean-install-starting-with-no-demo-data)
for the full procedure. **Never ship `ChangeMe123!` / `Admin123!` / `Student123!` to a live system.**

### Backups

Here SQLite is genuinely nicer than a client/server database — but do **not** simply `cp` the file
while the app is running, or you may copy a torn mid-transaction state. Use the online backup API,
which takes a consistent snapshot of a live database:

```bash
sqlite3 /var/lib/meridian/portal.sqlite ".backup '/var/backups/portal-$(date +%F).sqlite'"
```

Run it nightly from cron, keep ~30 days, and copy at least one off the machine. Restoring is putting
the file back and restarting — meaningfully simpler than `pg_restore`. Because the result is one
self-contained file, keeping last term's database as a permanent queryable archive is trivial.

Under WAL there are also `-wal` and `-shm` files beside the database. `.backup` handles them
correctly; a naive copy of only the main file can lose recent transactions.

### A realistic deployment

One school, one modest Linux VPS (2 vCPU / 4 GB is ample):

```
                  +----------------------------------------+
   Browser ------>| Nginx (TLS termination, static files)   |
                  |   /            -> frontend/build        |
                  |   /api, /admin -> proxy to :5000        |
                  +------------------+---------------------+
                                     |
                          +----------v-----------+
                          | Node (single process)|
                          | systemd, auto-restart|
                          +----------+-----------+
                                     | in-process, no network
                          +----------v-----------+
                          | portal.sqlite (WAL)  |
                          | + nightly .backup    |
                          +----------------------+
```

Build the frontend with `npm run build` and let Nginx serve the static files directly; run the backend
under systemd (`Restart=always`) so it survives crashes and reboots; take a certificate from Let's
Encrypt; and store uploaded files on the same disk under a path reachable only through an
authenticated route, never a public directory.

The one piece still needing an external service is **password-reset email**. Everything else in this
stack is genuinely self-contained.

### When to outgrow SQLite

Move to PostgreSQL when — and only when — one of these becomes true:

| Signal | Why SQLite stops fitting |
| --- | --- |
| More than one app server behind a load balancer | Multiple processes cannot safely share one database file |
| `SQLITE_BUSY` still appears after WAL + busy timeout | Genuine write contention has exceeded one writer |
| You need replication, hot standby or point-in-time recovery | SQLite has no built-in replication |
| Several separate services need direct database access | SQLite has no network protocol |

For a single school, none of these are likely. The schema in [backend/db.js](./backend/db.js) is
standard SQL with real foreign keys, `CHECK` constraints and indexes, so a later migration is mostly
type mapping (`INTEGER PRIMARY KEY` → `BIGSERIAL`, `TEXT` timestamps → `TIMESTAMPTZ`) rather than a
rewrite. Writing it properly now is what keeps that door open.

### Before real student data

Whatever the database, this application still needs: server-side virus scanning of uploads, a real
migration tool rather than `CREATE TABLE IF NOT EXISTS`, log aggregation and uptime monitoring, rate
limiting on authentication, and a documented retention and privacy policy. The audit log already
records the security-relevant events — but it should be shipped somewhere it cannot be edited by
whoever can edit the database.