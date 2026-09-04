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
- `backend/` — Express local API, upload handling and SQLite database helpers.
- `backend/test/` — focused SQLite/authentication tests.
- `backend/school_data/` — runtime-only database and uploaded files (created automatically; do not commit its contents).

Unused CRA branding and the unused source logo have been removed; required favicon and manifest assets remain because the browser uses them.

## Suggested UI improvements

For the next iteration, add paginated learner/result tables, a visible save status for design changes, accessible colour-contrast checks, sortable assignment columns, and a compact mobile action menu. These improvements reduce visual clutter and improve usability without changing the local data model.

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
