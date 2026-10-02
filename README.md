# Meridian Learning Hub — User and Installation Manual

Meridian Learning Hub is a student web portal for administrators, lecturers and students. It covers courses, assignments, marking, tests and exams, results, student cards and a shared calendar. It runs in any modern browser on Windows, macOS, Linux, Android, iPhone and iPad. Behind it are two small programs that run on one computer:

| Part | Folder | What it does | Address |
| --- | --- | --- | --- |
| **Backend** | `backend/` | Stores all data in one SQLite database file and serves the API | http://localhost:5000 |
| **Frontend** | `frontend/` | The website people use | http://localhost:3000 |

Both must be running at the same time, each in its own terminal window.

> **How to read this manual.** Part A tells you how to install, run, test, back up and reset the portal, step by step. Part B explains everyday use for each role. Part C is the technical reference and change history for developers.

## Contents

**Part A — Installation and operation**

- [A1. What you need](#a1-what-you-need)
- [A2. Install the portal (one time)](#a2-install-the-portal-one-time)
- [A3. The three installations: real, demo and clean](#a3-the-three-installations-real-demo-and-clean)
- [A4. Try the demo installation](#a4-try-the-demo-installation)
- [A5. Test a clean installation](#a5-test-a-clean-installation)
- [A6. Run your real installation](#a6-run-your-real-installation)
- [A7. Switching between installations](#a7-switching-between-installations)
- [A8. Check what is in each installation](#a8-check-what-is-in-each-installation)
- [A9. Back up and restore](#a9-back-up-and-restore)
- [A10. Start the demo or clean installation again from zero](#a10-start-the-demo-or-clean-installation-again-from-zero)
- [A11. Fully reset your real installation (destructive)](#a11-fully-reset-your-real-installation-destructive)
- [A12. Locked out? Recover the main administrator](#a12-locked-out-recover-the-main-administrator)
- [A13. Using the portal on a phone or tablet](#a13-using-the-portal-on-a-phone-or-tablet)
- [A14. Troubleshooting](#a14-troubleshooting)
- [A15. Command cheat sheet](#a15-command-cheat-sheet)

**Part B — Using the portal**

- [B1. Who can do what](#b1-who-can-do-what)
- [B2. Main administrator: first-day setup order](#b2-main-administrator-first-day-setup-order)
- [B3. Lecturers and administrators: the assignment cycle](#b3-lecturers-and-administrators-the-assignment-cycle)
- [B4. Students: everyday use](#b4-students-everyday-use)

**Part C — Technical reference and change history**

- [Part C — Technical reference and change history](#part-c--technical-reference-and-change-history)

---

# Part A — Installation and operation

## A1. What you need

- **Node.js 18 or newer** (the LTS version from https://nodejs.org is recommended). To check, open a terminal and run `node -v`. It should print `v18…` or higher.
- **A terminal.** On Windows use *PowerShell*; on macOS and Linux use *Terminal*.
- **A modern browser:** Chrome, Edge, Firefox or Safari.
- About 1 GB of free disk space for the installed packages.

You do **not** need a database server, Docker or any online account. The database is a single file that the backend creates itself.

> Windows tip: in PowerShell, run the commands in this manual one line at a time. `&&` does not work in older PowerShell versions.

## A2. Install the portal (one time)

The frontend and backend are separate packages, and **each needs its own `npm install`**. Installing only one of them is the most common setup mistake.

1. Open a terminal in the project folder (`student-website-project`).
2. Install the backend:

   ```powershell
   cd backend
   npm install
   ```

3. Install the frontend:

   ```powershell
   cd ..\frontend
   npm install
   ```

   On macOS or Linux, write `../frontend` instead of `..\frontend`.

4. *(Optional)* To send remediation e-mails, also run `npm install nodemailer` inside `backend/` and see section 12.1 in Part C. Without it the portal works normally; e-mails just wait in the outbox.

You only repeat this step after downloading a new version of the project.

## A3. The three installations: real, demo and clean

The portal can keep **three completely separate installations** side by side. Each has its own database and its own uploaded files, so testing never touches your real records.

| Installation | Start it with | Data folder | What is inside |
| --- | --- | --- | --- |
| **Real** — your data | `npm run real` (or `npm start`) | `backend/school_data/` | Your institution's accounts, courses, assignments and marks |
| **Demo** — sample data | `npm run demo` | `backend/installs/demo/` | 53 sample accounts, 5 courses, 2 open assignments and sample results, ready to explore |
| **Clean** — empty | `npm run clean` | `backend/installs/clean/` | Nothing. Opens on the setup screen, exactly like a brand-new institution |

Important points:

- **Only one installation runs at a time**, because they all use port 5000. Stop one (press `Ctrl+C` in its terminal) before starting another.
- **Your real data is never mixed with demo data.** Demo data is refused for any database that already contains real accounts. This is deliberate: demo data contains public passwords and a second main administrator, which must never end up in a real institution's database. That is why the demo has its own folder.
- The demo and clean folders are created automatically the first time you start them. They are excluded from Git.
- When the demo installation is running, a yellow **"Demo installation"** banner appears on the sign-in screen and a **"Demo data"** label appears at the top of every page. If you see these, you are not looking at your real data.
- All commands in Part A are run from inside the `backend/` folder unless stated otherwise.

## A4. Try the demo installation

1. **Terminal 1 — start the demo backend:**

   ```powershell
   cd backend
   npm run demo
   ```

   The first start creates the sample data and prints the sign-in details. Wait until you see `Server running on port 5000`.

2. **Terminal 2 — start the website:**

   ```powershell
   cd frontend
   npm start
   ```

   Your browser opens http://localhost:3000. If it doesn't, open that address yourself.

3. **Sign in with one of the demo accounts:**

   | Role | Username | Password | Good for testing |
   | --- | --- | --- | --- |
   | Main administrator | `mainadmin` | `ChangeMe123!` | Accounts, courses, teaching groups, calendar, student cards, reports |
   | Lecturer / administrator | `admin` | `Admin123!` | Assignments, marking, memos, tests and exams for their groups |
   | Temporary administrator | `tempadmin` | `TempAdmin123!` | Limited, time-bound staff access |
   | Student (Sam Taylor, Biology Year 2) | `student` | `Student123!` | Downloading and submitting work, feedback, results, student card |
   | Other students | `student2` … `student50` | `Student123!` | Class lists, bulk marking, reports |

   These passwords are public. Never use them in a real installation.

4. **Suggested 10-minute walkthrough:**
   1. As `student`: open **Assignments**, download *Science lab report*, tick the declaration and upload any small ZIP file.
   2. Sign out. As `admin` or `mainadmin`: open **Marking**, open the submission, enter a mark (or mark against a memo), attach a marked copy if you wish, and publish it.
   3. Sign out. As `student`: the assignment now shows **Marked**, with the score, feedback, criteria and the marked copy to download.
   4. Try **Tests & Exams**, **Calendar**, **Results** and **Student Cards** as the main administrator.

The demo assignments are always dated around the day the demo was created, so they are open when you try them. If the demo is old and the dates have passed, start again from zero (A10).

To stop, press `Ctrl+C` in both terminals.

## A5. Test a clean installation

Use this to see exactly what a new institution experiences on day one.

1. **Terminal 1:**

   ```powershell
   cd backend
   npm run clean
   ```

   Use `npm run clean:fresh` instead if you want to erase a previous clean test first.

2. **Terminal 2:** `cd frontend`, then `npm start` (or simply refresh the browser if the website is still running).

3. The browser shows **Initial system setup**. Fill in your full name, a username, an optional recovery e-mail and a password (at least 8 characters), then click **Create main administrator**.
   This screen only appears while the database has no users. After this, it is gone for good.

4. Continue with the first-day setup order in [B2](#b2-main-administrator-first-day-setup-order).

A clean installation contains **no** demo accounts, no hidden fallback administrator and no sample courses.

## A6. Run your real installation

```powershell
cd backend
npm run real
```

`npm start` does the same thing. Then start the frontend in a second terminal as usual. Your data lives in `backend/school_data/`: `portal.sqlite` holds the records, and the sub-folders hold uploaded assignments, submissions, marked copies and photos.

**Back up this folder regularly (A9).**

## A7. Switching between installations

1. Press `Ctrl+C` in the backend terminal to stop the running installation.
2. Start the other one (`npm run real`, `npm run demo` or `npm run clean`).
3. Refresh the browser tab. The website notices that it is talking to a different installation and does three things:
   - it signs you out (accounts differ between installations), so sign in again;
   - it puts the previous installation's browser cache aside, including any marks still waiting to sync;
   - it restores this installation's own cache when you come back to it.

   Nothing from one installation leaks into another, and unsynced marks are not lost.

You do not need to restart the frontend when switching. Your language and dark-mode preferences are kept across all installations.

## A8. Check what is in each installation

```powershell
npm run installs
```

This prints, for each installation, its folder, size, whether it contains demo data, and how many accounts, courses, assignments, submissions and marks it holds. It only reads the databases, so it is safe to run at any time.

## A9. Back up and restore

**Make a backup** (preferably with the backend stopped):

```powershell
npm run backup            # backs up your real installation
npm run backup -- demo    # backs up the demo installation
npm run backup -- clean   # backs up the clean installation
```

Each backup is a dated folder such as `backend/backups/real-2026-10-02T11-00-54/`. It contains a consistent copy of the database plus all uploaded files. Copy important backups to another drive or to cloud storage. The `backups/` folder is excluded from Git.

**Restore a backup:**

1. Stop the backend (`Ctrl+C`).
2. Rename the current data folder (for example `school_data` → `school_data-old`) so you have a way back.
3. Copy the backup folder's contents into a new `backend/school_data/` folder (or into `installs/demo` / `installs/clean`).
4. Start the backend again and sign in.

## A10. Start the demo or clean installation again from zero

```powershell
npm run demo:fresh     # erase the demo, then recreate fresh sample data and start
npm run clean:fresh    # erase the clean test, then start empty on the setup screen
```

To erase without starting, use `node scripts/portal-install.js wipe demo` or `node scripts/portal-install.js wipe clean`.

These commands only ever delete folders inside `backend/installs/`. They refuse to touch your real installation.

Stop the running backend first. On Windows, a running backend locks the database file.

## A11. Fully reset your real installation (destructive)

> **Warning:** this permanently deletes **all** real accounts, courses, assignments, submissions, marks and uploaded files in `backend/school_data/`. Make a backup first (A9). If you only want to *test* an empty portal, use the clean installation (A5) instead. It leaves your real data untouched.

1. Stop the backend and close any program that has `portal.sqlite` open (for example DB Browser for SQLite).
2. Make a backup: `npm run backup`.
3. Run the reset. The safety switch must be set in the same terminal:

   Windows PowerShell:

   ```powershell
   cd backend
   $env:ALLOW_RESET="true"
   npm run reset-db
   Remove-Item Env:ALLOW_RESET
   ```

   macOS / Linux:

   ```bash
   cd backend
   ALLOW_RESET=true npm run reset-db
   ```

   The script lists what it is about to delete before deleting it.
4. Start the backend (`npm run real`) and open the portal. The setup screen appears. Create the first main administrator and follow [B2](#b2-main-administrator-first-day-setup-order).

Deleting `backend/school_data/portal.sqlite` by hand has the same effect on the database, but leaves old uploaded files behind. Starting the backend normally after that **never** installs demo data; demo data only ever goes into `installs/demo`.

## A12. Locked out? Recover the main administrator

If nobody can sign in as main administrator (forgotten password or locked account), stop the backend and run:

```powershell
npm run create-admin -- --name "Your Name" --username yourname --password "NewPassword123!" --reset
```

- With `--reset`, the **existing** main administrator account gets the new name, username and password. It is also unlocked and signed out on every device. Its data and permissions are kept.
- Without `--reset`, a main administrator is created only when none exists yet. Only one main administrator is allowed.
- Add `--install demo` or `--install clean` to target those installations. The default is your real installation.
- The password must be at least 8 characters. Keep the `--` after `create-admin`.

## A13. Using the portal on a phone or tablet

A phone or tablet only *opens* the website. The backend still runs on your computer.

1. Find your computer's local network address. On Windows, run `ipconfig` and look for the *IPv4 Address*, for example `192.168.1.20`.
2. Backend terminal:

   ```powershell
   $env:CORS_ORIGINS="http://localhost:3000,http://192.168.1.20:3000"
   npm run real
   ```

3. Frontend terminal:

   ```powershell
   $env:REACT_APP_API_BASE="http://192.168.1.20:5000"
   npm start
   ```

4. On the phone (on the same Wi-Fi), open `http://192.168.1.20:3000`. Allow Node.js through the Windows firewall if asked.

See sections 7–10 in Part C for responsive layouts, native mobile builds and the PWA.

## A14. Troubleshooting

| What you see | Why | What to do |
| --- | --- | --- |
| `EADDRINUSE … :5000` when starting the backend | Another installation (or an old backend) is still running | Press `Ctrl+C` in the other backend terminal, or close it, then start again |
| Website says *offline / browser fallback* or "API not connected" | The backend isn't running, or the browser address isn't allowed | Start the backend; for phones and other addresses, set `CORS_ORIGINS` (A13) |
| Sign-in suddenly fails after switching installations | Accounts differ per installation | Use the right account for that installation (demo accounts only work in the demo) |
| The setup screen appears unexpectedly | You started the clean installation, or the database is empty | Stop it and run `npm run real` for your own data. Check with `npm run installs` |
| `EBUSY` / "resource busy or locked" when wiping or resetting | The backend or a database viewer still has the file open | Stop the backend and close DB Browser, then retry |
| `Cannot find module 'express'` / `'sqlite3'` | Backend packages not installed | `cd backend`, then `npm install` |
| `Can't resolve 'jszip'` or similar in the website | Frontend packages not installed | `cd frontend`, then `npm install` |
| `sqlite3` fails to install | No prebuilt binary for your computer | Use Node 18/20/22 LTS on 64-bit; see the native-dependency note in Part C |
| Demo assignments show "Closed" | The demo was created a while ago and its dates have passed | `npm run demo:fresh` |
| Account locked after several wrong passwords | Brute-force protection | Wait for the lock to expire, ask the main administrator, or use A12 |

## A15. Command cheat sheet

Run these inside `backend/`:

| Command | What it does |
| --- | --- |
| `npm run real` / `npm start` | Start your real installation |
| `npm run demo` | Start the demo installation (creates it on first run) |
| `npm run demo:fresh` | Erase and recreate the demo, then start it |
| `npm run clean` | Start the empty test installation |
| `npm run clean:fresh` | Erase the clean test, then start it empty |
| `npm run installs` | Show what each installation contains |
| `npm run backup [-- demo\|clean]` | Back up an installation (default: real) |
| `npm run create-admin -- …` | Create or reset (`--reset`) the main administrator |
| `npm run reset-db` | Fully reset the real installation (needs `ALLOW_RESET=true`) |
| `npm test` | Run the backend automated tests |

Run these inside `frontend/`:

| Command | What it does |
| --- | --- |
| `npm start` | Start the website on http://localhost:3000 |
| `npm run build` | Build an optimised copy for a web server |
| `npm test` | Run the frontend automated tests |

---

# Part B — Using the portal

## B1. Who can do what

| Role | Can see and manage |
| --- | --- |
| **Main administrator** (one per institution) | Everything: all accounts, courses, teaching groups, the institution calendar, student cards, reports, design and branding |
| **Administrator / lecturer / teacher** | Only the course + year groups allocated to them: assignments, marking, memos, tests and exams, results, group calendar items |
| **Temporary administrator** | Like an administrator, for a limited period |
| **Student** | Their own course + year work, their results and feedback, their student card and profile, institution-wide calendar items. The student's allocated lecturer is shown on their overview |

## B2. Main administrator: first-day setup order

Do these in this order. Each step depends on the one before it.

1. **Courses** — create every course the institution offers.
2. **Accounts** — create the lecturers and administrators (and temporary administrators only if needed).
3. **Teaching groups** (on the **Courses** page) — allocate each lecturer to the exact course + year groups they teach.
4. **Learners** — add students one by one, through self-registration, or in bulk with **CSV uploads**. Give each a course, a year and a responsible lecturer.
5. **Calendar** — add institution-wide dates (terms, holidays, exam weeks).
6. **Student cards** — choose a card template; learners can then upload their photos.
7. **Check it works** — create one test assignment, refresh the page, sign out and back in, and confirm it is still there. Then delete it.

## B3. Lecturers and administrators: the assignment cycle

1. **Create** the assignment for a course + year, with opening and closing dates and a brief (file).
2. Students download the brief and submit while it is **open**. After it closes, downloading and uploading are blocked for students.
3. **Mark** in the **Marking** room. Type a mark, or mark against a memo (memos can be added and deleted there). The marking room works offline and syncs when the connection returns.
4. **Publish** the mark and, if you like, upload a marked copy. The student is notified and sees the score, feedback, criteria and marked copy. You can replace or remove the marked copy later.
5. Students who miss deadlines or fail are listed for **remediation**.

Tests and exams follow the same idea from the **Tests & Exams** page. Set opening and closing dates and times, add weighted questions, then review and mark answers.

## B4. Students: everyday use

- **Overview** shows what is due, recent results and your allocated lecturer.
- **Assignments**: download the brief while it is open, tick *I confirm this is my own work*, and upload your ZIP before the due time. After marking, open the assignment to see your score and feedback, download the marked copy and write a short reflection.
- **Tests & Exams**: start a test during its window and submit before time runs out.
- **Results** and **Reports** show your marks and progress.
- **Profile** lets you change your password and upload or delete your student-card photo.

---

# Part C — Technical reference and change history

The sections below are the original technical notes and release history. They are kept for developers and administrators who need the detail behind the manual above. Where they describe commands, Part A is the up-to-date, recommended way to do the same thing.

## 1. Project purpose
Meridian Learning Hub is a student web portal for institutional administration, teaching-group management, assignments, tests/exams, results, remediation and an institution calendar.

The application is split into a React frontend and an Express/SQLite backend. SQLite is the authoritative data store for live operational records when the backend is running.

## 2. Important data model
SQLite is the source of truth for operational academic records. The browser is not used as the authoritative store for live assignments, submissions, tests, test attempts, marks, remediation cases, calendar events, accounts, courses or teaching-group allocations.

Static values such as translations, theme defaults, grading bands and starter memo templates remain static because they are configuration/templates rather than live learner records.

## 3. Clean installation versus demo installation
> **Recommended:** use `npm run demo` and `npm run clean` (Part A, sections A3–A5). They run the demo and clean installations in their own folders (`backend/installs/…`) through the `PORTAL_DATA_DIR` setting, so your real `school_data` is never touched. The variables below are what those commands set internally.

A clean installation is the default. Demo data is opt-in only.

Clean mode:

```text
SEED_DEMO=false
SEED_COURSE_EXAMPLES=false
```

Demo mode:

```text
SEED_DEMO=true
SEED_COURSE_EXAMPLES=true
```

Changing a seed variable does not delete records already stored in SQLite. Use the full reset procedure when the installation must be returned to an empty state.

How demo seeding behaves:

- Deleting `portal.sqlite` and restarting **without** `SEED_DEMO=true` gives an empty database and the **Initial system setup** screen. No demo data is installed, so `reset-install.js` is not needed just to start fresh.
- Only the exact value `true` enables seeding. Values such as `TRUE`, `1` or `yes` are ignored.
- With `SEED_DEMO=true`, demo data is added only to an **empty** database or to an **existing demo** database. Re-running it on a demo database adds no duplicates. A demo database is identified by the `demo_seeded` row in the `install_meta` table, or for older databases by the original demo accounts.
- If the database already holds a real installation (for example, a main administrator created on the setup screen), `SEED_DEMO=true` is ignored and a warning is logged. This prevents a second main administrator with the public demo password from being added.
- The server starts listening only after seeding has finished, so the setup screen never appears while demo data is still being written.
- In PowerShell, `$env:SEED_DEMO="true"` stays set for that window. Run `Remove-Item Env:SEED_DEMO` or open a new terminal before starting a clean install.

## 4. FULL RESET / CLEAN INSTALLATION

> The short, current version of this procedure is in Part A, section A11. Back up first with `npm run backup`. To only *test* an empty portal, use `npm run clean` instead of resetting.

**Warning:** this operation permanently deletes the current local portal data under `backend/school_data/`.

### Step 1 — Stop the running backend
Close the backend process and any database viewer that has the SQLite database open.

### Step 2 — Back up anything that must be retained
Before a destructive reset, copy any required `school_data/` backups outside the project directory.

### Step 3 — Run the reset script
From the backend directory:

```powershell
cd backend
$env:ALLOW_RESET="true"
node reset-install.js
```

For a deliberately reset production environment, the safety override is required:

```bash
NODE_ENV=production ALLOW_RESET=true node reset-install.js
```

Set `ALLOW_EXTERNAL_DB_RESET=true` too only when the external database should also be removed.

### Step 4 — Start the backend
Use the command defined by the backend `package.json`, normally:

```bash
npm start
```

### Step 5 — Open the portal
Start the frontend and open the configured frontend URL, normally:

```text
http://localhost:3000
```

### Step 6 — Create the first main administrator
The setup screen creates the first main administrator. A clean reset does not create a hidden fallback administrator and does not create demo credentials.

### Step 7 — Create permanent and temporary administrators
Sign in as the main administrator and create the normal administrator/teacher/lecturer accounts. Create temporary administrator accounts only when temporary access is required.

### Step 8 — Create the course catalogue
Create each real institution course in the Courses page. New courses are stored in SQLite and become available to the relevant course selectors.

### Step 9 — Allocate teaching groups
Assign each administrator/teacher/lecturer to the exact course + year group they are responsible for. A regular administrator is then limited to those assigned groups.

### Step 10 — Create learner accounts
Create each learner and assign the correct course + year group and responsible lecturer/teacher. Students cannot change their academic course/year themselves.

### Step 11 — Set the institution calendar
Create institution-wide events as the main administrator and course/year-specific events or remediation weeks from the appropriate teaching-group scope.

### Step 12 — Create assignments and tests
Assignments and tests must be created against an existing course + year teaching group. Students only receive academic work matching their assigned course/year.

### Step 13 — Verify persistence
Create one test course, calendar event and assignment, refresh the browser, sign out/in and confirm the records remain present. Delete the temporary test records afterwards.

## 5. Calendar reset and form behaviour
The calendar form is intentionally separate from the destructive installation reset.

After a successful **Add calendar item** operation, the form is cleared immediately and the UI returns to a new-item state.

After a successful calendar edit, the form is also cleared and the edit state is closed.

The form element is captured before the asynchronous request completes so the reset does not depend on `event.currentTarget` after an `await`.

The same safe pattern is used for course creation and assignment publishing, preventing the recurring problem where a form sometimes remained filled after a successful database write.

## 6. Dynamic calendar features
The institution Calendar is database-backed and dynamically filtered by the signed-in user's scope.

Main administrators can view all calendar records and can create whole-institution or course/year events.

Regular administrators see their relevant institutional/course records and may manage only their assigned course/year groups.

Students see institution-wide events plus events assigned to their own course/year.

Calendar features include:

- previous month;
- next month;
- today;
- month view;
- agenda view;
- remediation-week event type;
- course/year audience selection;
- event description;
- event editing and deletion where authorised;
- live database refresh;
- mobile-friendly touch controls.

On narrow screens the default is an agenda-style calendar so users can read events without forcing a seven-column calendar across the phone viewport. The month view remains available and uses a controlled horizontal scroll.

## 7. Responsive web support
The frontend is designed as a responsive web application rather than depending on an operating-system-specific layout.

Supported usage targets include:

- desktop browsers;
- laptop browsers;
- tablets;
- Android phones/tablets;
- iPhone/iPad browsers;
- Windows;
- Linux;
- macOS;
- ChromeOS and other modern browser environments.

The application uses responsive CSS, flexible forms, touch-sized controls, wrapped action areas, contained table scrolling and a mobile calendar agenda.

**Tables on small screens.** Wide tables scroll sideways inside their panel instead of squeezing
columns. An older blanket `overflow-wrap: anywhere` rule let columns shrink to a single character
(names broke one letter per line), and `td.table-actions` used `display: flex`, which stacked row
buttons vertically. The V20 block at the end of `App.css` restores normal word wrapping, keeps
headers and action buttons on one line, and gives 5+ column tables a 680px minimum width.
## 8. Local network testing on a phone or tablet
For development on the same Wi-Fi network, the frontend device must be able to reach the computer running the backend.

### Step 1 — Find the host computer's LAN IP address
Example only:

```text
192.168.1.25
```

Do not copy this example literally; use the IP address of the computer running the server.

### Step 2 — Configure the frontend API URL
Set:

```text
REACT_APP_API_BASE=http://<HOST-LAN-IP>:5000
```

Example:

```text
REACT_APP_API_BASE=http://192.168.1.25:5000
```

### Step 3 — Allow the frontend origin in the backend
Set `CORS_ORIGINS` to the actual frontend origin(s), for example:

```text
CORS_ORIGINS=http://localhost:3000,http://192.168.1.25:3000
```

### Step 4 — Bind the development frontend for LAN access
Use the frontend toolchain's LAN/host option or `HOST=0.0.0.0` where supported, then open the frontend from the phone/tablet using the host computer's LAN address.

### Step 5 — Test authentication and persistence
Sign in, create/view a calendar event and confirm that the same SQLite-backed record appears from the desktop and mobile browser.

For anything beyond trusted local development, use HTTPS and a properly secured server rather than exposing a development server directly to the Internet.

## 9. Cross-platform mobile development
The portal is web-first. The same React interface can therefore run in a mobile browser without creating a separate Android or iOS codebase.

For an installable native wrapper, Capacitor can be added to an existing modern web project. Capacitor's current documentation describes support for existing web apps and native targets including iOS and Android. See:

https://capacitorjs.com/docs

### Android wrapper — recommended sequence

1. Complete and test the responsive web build first.
2. Install the Capacitor core and CLI in the frontend project:

```bash
npm install @capacitor/core @capacitor/cli
```

3. Initialise Capacitor:

```bash
npx cap init
```

4. Set the web directory to the Create React App production output, normally:

```text
build
```

5. Add Android:

```bash
npm install @capacitor/android
npx cap add android
```

6. Create a production web build:

```bash
npm run build
```

7. Synchronise the native project:

```bash
npx cap sync android
```

8. Open the Android project in Android Studio:

```bash
npx cap open android
```

9. Test on an emulator and a physical Android device before releasing.

10. Make sure the mobile build points to the deployed HTTPS API rather than `localhost` on the phone. Set `REACT_APP_API_BASE` to the real API origin before building the mobile package when the API is hosted separately.

### iOS/iPadOS wrapper — recommended sequence

1. Complete and test the same responsive web build.
2. Install Capacitor core/CLI and initialise the project as above.
3. Add iOS:

```bash
npm install @capacitor/ios
npx cap add ios
```

4. Build the React web application:

```bash
npm run build
```

5. Synchronise the iOS project:

```bash
npx cap sync ios
```

6. Open Xcode:

```bash
npx cap open ios
```

7. Test with the iOS Simulator and a physical iPhone/iPad.

8. Configure the deployed HTTPS API rather than `localhost` for the mobile build.

9. For App Store submission, follow Apple's current Xcode/SDK requirements. As of 28 April 2026, Apple states that App Store uploads must be built using Xcode 26 or later with an iOS 26 SDK or later.

A Mac with Xcode is required for native iOS/iPadOS packaging. Linux and Windows can still run the web/PWA version and can be used for Android development, but native iOS packaging is performed with Apple's Xcode environment.

## 10. Progressive Web App (PWA) path
A PWA is an installable web version of the same application. It is useful when an institution wants an app-like icon and launch experience without maintaining two separate native codebases.

The PWA deployment sequence is:

1. Build the responsive web version.
2. Serve the production frontend over HTTPS.
3. Provide a valid web app manifest with the institution name and icons.
4. Configure a service worker if offline caching/installability is required.
5. Test the installed site on Android and supported desktop browsers.
6. Test the iOS/iPadOS browser installation experience separately because browser/PWA capabilities vary by platform.

PWA installation is optional; the portal already functions as a normal responsive website.

## 11. Other operating systems
No separate desktop frontend is required for Linux, Windows, macOS or ChromeOS when the portal is used as a web application. The browser handles the presentation layer while the backend/API and SQLite database run on the server host.

For institution-wide deployment, host the React build and Express API behind HTTPS and use environment configuration for the API URL and allowed frontend origins.

## 12.1 Remediation email configuration

Email delivery is optional for a local classroom/demo run but required for external remediation email in a real deployment.

```text
SMTP_HOST=smtp.example.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=Meridian Learning Hub <no-reply@example.org>
```

For local testing without sending external messages:

```text
EMAIL_MODE=console
```

The server writes remediation messages to the `email_outbox` SQLite table before attempting delivery. Failed messages remain retryable and are limited to five attempts per queued message. A student must have a valid **trusted email** stored on their account.

## 12. API URL configuration
The frontend uses an environment-aware API base:

- local browser development falls back to `http://localhost:5000`;
- a non-local hosted frontend can use its same-origin `/api` routes;
- separate frontend/backend deployments can set `REACT_APP_API_BASE` explicitly.

The backend accepts a comma-separated `CORS_ORIGINS` list so trusted local network, hosted web and controlled mobile development origins can be configured without changing source code.

## 13. Roles and access scope
Main administrator:

- full institutional oversight;
- all course/year groups;
- institution-wide calendar management;
- administrator and temporary-administrator management.

Regular administrator/teacher/lecturer:

- only assigned course/year teaching groups;
- assignments/tests/calendar items are scoped to those groups;
- cannot create whole-institution calendar events.

Student:

- own course/year academic scope;
- institution-wide calendar items;
- calendar items allocated to the student's course/year;
- no access to other student groups.

## 14. Demo credentials
Demo credentials exist only in the demo installation (`npm run demo`). The full table is in Part A, section A4: `mainadmin` / `ChangeMe123!`, `admin` / `Admin123!`, `tempadmin` / `TempAdmin123!`, and `student` … `student50` / `Student123!`. The demo launcher also prints them when it starts.

A clean reset does not recreate these accounts.

Never use demonstration passwords for a real institution.

## 15. Testing checklist after changes

### Functional

- Create a scheduled test: verify it is hidden from student submission before the opening time, opens at the configured time, and closes after the due date/time.
- Add MCQ and long-answer questions with different marks: verify the total allocation and final percentage use the weighted mark totals.
- Submit a mixed test: verify the result remains `Awaiting staff marking` until every question is marked.
- As staff, open `Review / correct`: verify student answers, correct/model answers and editable marks are visible and saved.
- Fail a test: verify a remediation case and notification are created.
- Schedule remediation with a date/time: verify the student notification includes the schedule and an email outbox record is created when a trusted email exists.
- Reopen/close a test from the staff page: verify students can/cannot submit accordingly while staff can still edit the assessment.

- Add a course as main administrator: record appears and the course form clears.
- Add a course as regular administrator: record appears and the course form clears.
- Add a calendar event: record appears and the calendar form clears.
- Edit a calendar event: saved data appears and the edit form closes/resets.
- Cancel calendar editing: form returns to a blank new-event state.
- Delete a calendar event: record disappears from the calendar.
- Refresh: database-backed records remain.
- Sign out/in as another account: calendar scope changes correctly.
- Mobile calendar opens in Agenda mode at narrow width.
- Month view remains horizontally scrollable without widening the entire page.

### Responsive

Test at minimum:

```text
320 × 800   phone portrait
375 × 812   phone portrait
768 × 1024  tablet portrait
1024 × 768  tablet/laptop landscape
1366 × 768  laptop/desktop
1920 × 1080  desktop
```

Check navigation, forms, tables, top-bar controls, notifications, calendar month view and agenda view at each size.

### Code quality

- Run the normal frontend ESLint/build command.
- Run `node --check` for backend JavaScript files.
- Do not add `eslint-disable` comments simply to hide unused functions or variables.
- Keep live academic records database-backed.


## v4 verification status

The latest regression pass specifically checks four account classes — main administrator, regular administrator, temporary administrator, and student — against the same assignment/course/calendar/result flows. Assignment opening, closing, reopening, submission locking, course visibility, test scope, calendar scope, immediate UI state updates, refresh persistence, sign-out/sign-in persistence and reset-install behaviour are covered.

A true end-to-end `npm start`/browser test still depends on the complete project checkout, `package.json` files and installed dependencies being available. Source-level syntax, schema and isolated state tests are run against the supplied release files.

## Latest release test update — assignment downloads, completion locking and remediation

The current release candidate hardens the assignment workflow after a student download test exposed an HTTP 404. The assignment-download route already existed; the failure could occur when the SQLite record pointed at an old absolute `school_data` path after the project/runtime directory moved, or when a stored path was no longer resolvable from the current runtime folder.

The backend now stores new assignment, student-submission, and marked-feedback paths relative to `school_data/`, while the path resolver can also recover older absolute paths by locating their stable `school_data/...` portion. This avoids false 404 responses after a local project move or Codespace recreation while keeping downloads restricted to the application storage root.

Student assignment brief downloads follow the assignment window exactly: a learner can only download the brief while the assignment is open. Requests before the configured opening time, after the due date/time, or after staff mark the assignment **Completed** are rejected with a controlled message explaining which of those applies. Staff (main administrators, and administrators/teachers/lecturers assigned to the course/year group) are exempt and can download the brief in any state so they can keep authoring and moderating. A learner can still download their own submitted file after closure, since that is their own work rather than the assignment document.

When staff mark an assignment **Completed**, the backend also closes any outstanding student submissions and records a closure time. Reopening an assignment restores the assignment submission window for new/eligible work, but already-closed submissions remain closed. The student UI displays completed assignments with the existing completed styling and no replacement/removal controls.

Staff submission and remediation downloads now use the authenticated download helper in the React client. This prevents `/api/...` paths from being interpreted against the React development server and removes another source of accidental HTTP 404s, particularly in Codespaces or split frontend/backend deployments.

### Release checks performed

- Server Node syntax check: **PASS**.
- React App.js TypeScript/JSX diagnostic pass: **PASS — 0 diagnostics** using ES2022/DOM libraries and lightweight module/type shims because the supplied source snapshot does not include installed React/JSZip type packages.
- App.js named-function reference audit: **PASS — no function found only at its definition**.
- Server named-function reference audit: **PASS — no function found only at its definition**.
- CSS parse using PostCSS: **PASS**.
- Express route inventory: **85 handlers**.
- Duplicate HTTP method/path handlers: **0**.
- Frontend API request path templates checked against backend route templates: **49 checked, 0 missing**.
- Assignment download route: **PASS**.
- Assignment-submission download route: **PASS**.
- Marked-feedback download route: **PASS**.
- Student remediation download route: **PASS**.
- Assignment completion route and student-submission locking: **PASS**.
- Stable relative file-path storage and recovery of moved-project absolute paths: **PASS**.
- Protected staff download links converted from raw relative anchors to authenticated fetch/download handling: **PASS**.

The remaining HTTP 404 responses in the backend are intentional not-found responses for missing/deleted/unauthorised resources; the audit did not find a frontend API path whose corresponding backend route is missing. A full live browser/Express/SQLite click-through still has to be run in the actual repository because this source bundle does not contain the project's installed dependencies.

## Current implementation status

**Source-of-truth rule:** the backend SQLite database is authoritative for live academic data. React state represents the current screen and is replaced by authenticated API responses after writes and scheduled synchronization. Browser localStorage is not an authoritative store for assignments, submissions, tests, test attempts, marks, remediation records, calendar events, accounts, courses or teaching-group allocations.
Student account creation is routed through the local SQLite API. Students can register from the login page after initial system setup, while administrators and main administrators can create student accounts from the staff workspace. All three paths use the same SQLite-backed student creation logic.

Administrator account creation is also SQLite-backed. Main administrators can create administrator and main-administrator accounts, while administrator accounts can be marked temporary or permanent. The main administrator account cannot be deleted, and normal administrators cannot delete administrator accounts.

Profile and course information are stored in SQLite so changes persist across refreshes and are not overwritten by periodic database synchronization.

### Showcase-install status
The current application source is configured for a **clean installation by default**. Demo accounts and sample backend academic data are created only when `SEED_DEMO=true` is deliberately enabled. The frontend does not create authentication accounts; any optional frontend showcase templates must also be explicitly enabled.

A clean reset therefore starts with zero users and no demo credentials. No hidden administrator or fallback password is created.

The five course examples (Computer Science, Business Administration, Psychology, Nursing and Engineering) are controlled separately and are optional. Enable them with `SEED_COURSE_EXAMPLES=true` on the backend and `REACT_APP_SEED_COURSE_EXAMPLES=true` on the frontend when preparing a showcase installation.

## Capacity expectations

This local release is intended for development, assessment and small institutional demonstrations rather than high-concurrency production use. Live academic records are stored in SQLite; uploaded assignment files are stored in the local runtime data directory. Large cohorts, heavy simultaneous writes and large file volumes should move to a production database/object-storage architecture.

For a small local deployment, concurrency should be validated against the target hardware and file workload rather than treated as a guaranteed capacity figure. SQLite is excellent for local/small-team use, but one writer at a time and local disk/file handling become bottlenecks for simultaneous marking or uploads. For a real deployment, use a server database, object storage, API pagination, background file processing, caching, monitoring, and load testing. Exact capacity depends on hardware, file sizes, network, and workload; there is no guaranteed “no slowing down” user count without measuring the target environment.

## Installation

### Requirements

| | Minimum | Notes |
| --- | --- | --- |
| **Node.js** | 20.17 or newer | Node 22 LTS or Node 24 LTS recommended. The current SQLite native package documents prebuilt support from Node 20.17+. Check with `node --version`. |
| **npm** | Ships with Node | Use the npm version bundled with the selected Node LTS release. Check with `npm --version`. |
| **Disk** | ~600 MB | Mostly `node_modules`; the database itself is a few MB. |
| Git | any | Only needed to clone. |

Nothing else is required — no database server to install, no Docker, no accounts to
register. The database is a single SQLite file created automatically on first backend start.

### OS-specific installation and testing matrix

The portal is a web application, so the **frontend can be used from any supported modern browser**. The Node/Express/SQLite backend is the part that must be installed on a computer or server. A phone or tablet does not run the Node backend just because it opens the portal in Safari/Chrome.

| Platform | Portal in browser | Backend host | Native mobile development | Notes |
| --- | --- | --- | --- | --- |
| **Windows 10/11 x64** | Supported | Supported | Android development supported | Use PowerShell or Command Prompt. Current SQLite prebuilt targets include `win32-x64`. |
| **Windows ARM64** | Supported | Conditionally supported | Android development supported | Node supplies ARM64 builds, but the current `sqlite3` package documentation lists `win32-x64`, not Windows ARM64, among its prebuilt targets. An ARM64 install may therefore fall back to a local native build and need C++/node-gyp tooling. |
| **Linux x64** | Supported | Supported | Android development supported | Use Bash/sh. The current SQLite prebuilt targets include `linux-x64`. |
| **Linux ARM64** | Supported | Supported | Android development supported | The current SQLite prebuilt targets include `linux-arm64`. |
| **macOS Intel** | Supported | Supported | iOS + Android development, subject to current Apple/Android tooling | Node provides macOS x64 binaries; current SQLite targets include `darwin-x64`. |
| **macOS Apple Silicon** | Supported | Supported | iOS + Android development | Node and SQLite provide ARM64 binaries. |
| **ChromeOS** | Supported in browser | Prefer another host for the backend | Android tooling available through ChromeOS Linux where supported | Android Studio currently documents ChromeOS installation through the Linux environment. |
| **Android phone/tablet** | Supported in Chrome/other modern browser | **Do not install the backend on the device for this project** | Native wrapper can be built with Capacitor + Android Studio | Point the app at a reachable HTTPS backend or a trusted LAN development server. |
| **iPhone/iPad** | Supported in Safari/other modern browser | **Do not install the backend on the device for this project** | Native wrapper requires Capacitor + Xcode on macOS | Configure the mobile build to use the deployed HTTPS API, not `localhost`. |

The source audit found no hard-coded Windows drive letters, POSIX-only file commands, or OS-specific backend path separators. The backend consistently uses Node's `path.resolve`, `path.join`, and `path.basename` helpers for runtime files.

### Windows PowerShell commands

The reset operation itself is cross-platform:

`ALLOW_RESET=true` is required before the script will delete any portal data. It prints
the deletion targets first. If `DB_PATH` points outside `backend/school_data/`, the script
also requires `ALLOW_EXTERNAL_DB_RESET=true` before it will remove that database and its
SQLite sidecar files.

```powershell
cd backend
$env:ALLOW_RESET="true"
node reset-install.js
npm start
```

For the protected production-reset override in PowerShell, set environment variables before running the script:

```powershell
$env:NODE_ENV="production"
$env:ALLOW_RESET="true"
node reset-install.js
```

For a local network phone/tablet test in PowerShell, use:

```powershell
$env:REACT_APP_API_BASE="http://<HOST-LAN-IP>:5000"
$env:CORS_ORIGINS="http://localhost:3000,http://<HOST-LAN-IP>:3000"
npm start
```

### Linux/macOS shell commands

```bash
cd backend
ALLOW_RESET=true node reset-install.js
npm start
```

Production-reset override:

```bash
NODE_ENV=production ALLOW_RESET=true node reset-install.js
```

Local-network frontend configuration:

```bash
export REACT_APP_API_BASE="http://<HOST-LAN-IP>:5000"
export CORS_ORIGINS="http://localhost:3000,http://<HOST-LAN-IP>:3000"
```

### Important native-dependency note

The backend imports `sqlite3`, which contains native Node bindings. Current `sqlite3` package documentation lists prebuilt targets for Windows x64, Linux x64/ARM64, and macOS x64/ARM64. Where no prebuilt binary exists for the chosen Node/platform/architecture combination, installation can fall back to a source build and require a C++ compiler/toolchain. Do not treat an `npm install` native-build failure as an application-code syntax error; first check Node version, CPU architecture and the platform's build tools.

### Install

The project is two npm packages — `frontend/` and `backend/` — and **each needs its own
`npm install`**. Installing only one is the most common setup mistake:

```bash
git clone <your-repository-url>
cd student-website-project

# 1. Backend (the SQLite API)
cd backend
npm install
npm install nodemailer

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

Then open **http://localhost:3000**. A clean installation starts without pre-made accounts or demo academic data. For a showcase installation, deliberately enable `SEED_DEMO=true` and `SEED_COURSE_EXAMPLES=true` before starting the backend.

The normal downloaded configuration uses the clean-install defaults above. Showcase data is opt-in only with `SEED_DEMO=true` and `SEED_COURSE_EXAMPLES=true`.

### GitHub Codespaces

The Codespaces setup uses the React development server as a proxy. This is preferable to making
the SQLite API public just so the browser can reach it: the browser talks to the forwarded frontend
port **3000**, while the frontend dev server forwards `/api/*` and `/admin/*` to the backend on
`localhost:5000` inside the Codespace.

The following project changes are required:

1. In `frontend/src/App.js`, the API base should default to a relative URL:

```js
const API_BASE = (process.env.REACT_APP_API_BASE || "").replace(/\/+$/, "");
```

2. In `frontend/package.json`, add the Create React App proxy:

```json
"proxy": "http://localhost:5000"
```

3. In `backend/server.js`, use the environment-aware CORS configuration described in the patch
   supplied with this README. Normal local origins remain allowed, and HTTPS `*.app.github.dev`
   origins are allowed only when `CODESPACES=true`.

Install both packages and start both processes:

```bash
cd backend
npm install
npm start

# second terminal
cd frontend
npm install
npm start
```

Open the forwarded **port 3000** in Codespaces. Port 5000 does **not** need to be public for the
normal development workflow. Make port 3000 public only when you intentionally want other people to
access the running portal.

To choose which installation the backend uses (real, demo or clean), start it with
`npm run real`, `npm run demo` or `npm run clean` instead of `npm start` (see Part A, section A3).

The status line under the workspace heading still shows whether the API connected. If it reads
*offline/browser fallback*, check that the backend is running and that the frontend was restarted
after adding the proxy configuration.

### Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Module not found: Error: Can't resolve 'jszip'` | Dependencies were not installed in `frontend/`. Run `npm install` there. If it persists, delete `frontend/node_modules` and `frontend/package-lock.json`, then `npm install` again. |
| `Cannot find module 'express'` / `'sqlite3'` | Same problem in `backend/`. Run `npm install` inside `backend/`. |
| Portal loads but shows *offline/browser fallback* | The API is not reachable. Confirm `npm start` is running in `backend/` and that `frontend/package.json` contains `"proxy": "http://localhost:5000"`. Restart the frontend after changing the proxy. |
| `EADDRINUSE: address already in use :::5000` | Another process holds the port. Stop it, or stop the existing backend process. If you change the API to port 5001 during development, also change the CRA `proxy` to `http://localhost:5001`. |
| `npm install` fails compiling `sqlite3` | Usually an unsupported Node version. Check `node --version` is 18+; on very new or unusual platforms a prebuilt binary may not exist, so install Node 20 or 22 LTS. |
| Sign-in fails on a new install | This is expected until the first main administrator is created on the **Initial system setup** screen. If the setup screen is not appearing, stop the backend, remove `backend/school_data/`, restart the backend, and refresh the frontend. |
| Old demo accounts still appear in the browser | Clean mode clears the legacy account/content keys when they are loaded. Also clear the site's Local Storage or use a private window if an old browser tab is still holding a previous build. |
| A student can register before setup | The current backend rejects `POST /api/accounts/students` while the `users` table is empty. Restart the backend with the latest `server.js` if this route behaves differently. |

## Run locally

The frontend may display presentation-only UI preferences without the API, but live accounts, assignments, submissions, tests, marks, remediation records, courses, teaching groups and calendar events require the backend. For the normal full application, run both processes:

```bash
cd backend
npm install
npm start

# second terminal
cd frontend
npm install
npm start
```

The local SQLite API is required for SQLite-backed account, mark and staff data persistence:

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

### Showcase examples (optional)

The downloadable project supports both clean installation and optional showcase mode. The default database configuration is clean; demo accounts and sample academic records appear only when `SEED_DEMO=true` is deliberately enabled.

Backend (showcase example):

```bash
cd backend
npm start
```

The frontend is not an authentication source; live assignments, submissions, tests and attempts are obtained from the backend. Any optional frontend showcase content must be explicitly enabled and must never be treated as institutional data.

```bash
cd frontend
npm start
```

Showcase mode can be enabled explicitly with `SEED_DEMO=true` and `REACT_APP_SEED_DEMO=true`. The separate course-example setting is documented below.

### Clean installation / removing showcase data

A clean installation **is the default**. To deliberately prepare an optional showcase installation, enable the showcase seed variables documented above. To return an existing installation to a genuinely fresh state, use the full reset procedure.

With the demo flags disabled and the runtime data reset, the first-run flow is:

```text
Start backend
    ↓
SQLite database/tables created if missing
    ↓
users table contains 0 rows
    ↓
Initial system setup screen
    ↓
Create first main administrator
    ↓
Normal sign-in and portal use
    ↓
Main administrator creates real admins/students
```

### Course examples

Five course examples are available for the showcase when `SEED_COURSE_EXAMPLES=true`:

- Computer Science
- Business Administration
- Psychology
- Nursing
- Engineering

They are separate from administrator-created courses. Administrator-created courses are stored in SQLite and persist normally. The course examples are read from application configuration so they can be removed without deleting real course records.

To hide the example courses in a clean deployment, set both of these values before starting the application:

Backend:

```text
SEED_COURSE_EXAMPLES=false
```

Frontend:

```text
REACT_APP_SEED_COURSE_EXAMPLES=false
```

Restart the backend and frontend after changing the variables.

### Completely reset an existing installation

**Stop the backend first.** The supplied `backend/reset-install.js` script deletes the complete runtime data directory, including the SQLite database and uploaded files. It does not modify your application source.

```bash
cd backend
ALLOW_RESET=true node reset-install.js
npm start
```

After the restart, the database schema is recreated automatically. When `SEED_DEMO=false` remains set, the portal returns to **Initial system setup** with zero users and no showcase accounts are created.

On Windows PowerShell the command is the same:

```powershell
cd backend
$env:ALLOW_RESET="true"
node reset-install.js
npm start
```

If `reset-install.js` reports a file/permission error, make sure the backend process is stopped before running it.

### Switching an existing demo database to a genuinely fresh install

Changing `SEED_DEMO` to false prevents future seed inserts, but it does **not** delete accounts that are already stored in SQLite. For a true fresh start, stop the backend, run `ALLOW_RESET=true node reset-install.js`, then start the backend again.

The same distinction applies to the browser: a fresh backend database does not automatically remove stale `localStorage` from an old frontend build. The clean frontend now performs a **one-time browser cleanup per clean-install build revision** rather than deleting local data on every refresh. This prevents a recurring timer from wiping legitimate local edits. If an old cached tab is still running, close it, reload the new frontend, or clear that site's Local Storage.

### Initial administrator setup API

The fresh-install flow uses two unauthenticated endpoints that become harmless once the first account exists:

- `GET /api/setup/status` — reports whether setup is still required.
- `POST /api/setup/create-main-admin` — creates the first main administrator and immediately starts a normal session for that account. The endpoint re-checks that the database still contains zero users inside a transaction, so only the first request can succeed.

After the first main administrator is created, `GET /api/setup/status` reports `setupRequired: false`, the setup screen disappears, and student self-registration is enabled.

### Verification performed for this revision

The fresh-install revision was checked against the supplied source snapshot and fresh-install bundle:

- `server.js`: `node --check` passed.
- `db.js`: `node --check` passed.
- `reset-install.js`: `node --check` passed.
- `frontend/src/App.js`: TypeScript/JSX parser diagnostics reported **0 syntax diagnostics**.
- TypeScript `checkJs` reported **0 undefined-name diagnostics** (`TS2304`, `TS2552`, `TS2448`) across the supplied JS files.
- The credential scan found **0 hard-coded demo credentials in `App.js` or `server.js`**.
- Backend showcase seeding is disabled by default and can be enabled with `SEED_DEMO=true`.
- Frontend showcase content is disabled by default and can be enabled with `REACT_APP_SEED_DEMO=true`.
- Frontend authentication still has no local demo-account fallback; credentials come from the SQLite seed.
- When clean mode is explicitly selected, the browser-storage reset is **one-time per build revision**, so legitimate local edits are not deleted on every refresh.
- A browser-storage simulation confirmed stale `portal-*` data is cleared on the first clean run while unrelated keys remain and later legitimate portal data survives subsequent runs.
- The final V7 schema/index smoke executed the current `CREATE TABLE` and `CREATE INDEX` statements successfully against an isolated SQLite database.
- The reset script was executed against a temporary `school_data` directory and successfully removed it.
- The reset script refused a production reset unless `ALLOW_RESET=true` was explicitly supplied.
- The runtime database location resolves to `backend/school_data/portal.sqlite`.
- The clean-install bundle does **not** contain a `school_data` directory; that runtime directory is created by `backend/db.js` when the backend starts, and the SQLite file is then located at `backend/school_data/portal.sqlite`.

A real `npm install`, Express/SQLite process startup, browser interaction test, and end-to-end first-admin creation test still need to be run on the actual repository checkout because the source snapshot supplied for this revision does not contain `package.json`/`node_modules`. The OS compatibility pass for this release therefore combines executable source/reset tests with platform/architecture static checks; it does not claim that Windows, macOS, Android or iOS were physically booted in this Linux test environment.

## Folder guide

- `frontend/` — React single-page portal and responsive UI. Live academic data comes from the authenticated backend; browser storage is limited to presentation preferences and UI-only state.
- `frontend/src/App.js` — React portal screens and workflow components (Accounts, Courses, CSV uploads, Results).
- `frontend/src/App.css` — responsive layout, theme tokens, workflow badges and form styling.
- `backend/` — Express local API, upload handling, authenticated data views and SQLite database helpers.
- `backend/reset-install.js` — development/local script that deletes the complete runtime `school_data/` directory so the next backend start returns to the initial setup screen.
- `backend/scripts/` — operational scripts from earlier project revisions, if retained in your repository; the current first-admin flow is handled in the application itself.
- `backend/test/` — focused SQLite/authentication tests.
- `backend/school_data/` — runtime-only SQLite database and uploaded files (created automatically on backend start; do not commit its contents).

Unused CRA branding and the unused source logo have been removed; required favicon and manifest assets remain because the browser uses them.

## Local data endpoints

The browser uses these local endpoints (administrator endpoints require the
session cookie created by sign-in):

- `GET /api/setup/status` — reports whether a first-run main administrator still needs to be created.
- `POST /api/setup/create-main-admin` — creates the first main administrator while the database contains zero users and starts a session for it.
- `POST /api/accounts/students` — public student account registration backed by SQLite after initial setup is complete.
- `POST /api/accounts/sign-in` — local account sign-in and session cookie.
- `GET /api/accounts/me` — restores the current signed-in account from the session cookie. For students it also resolves the responsible lecturer (`teacherName`, `teacherAcademicYear`, and `teacherSource`).
- `GET /api/accounts/support-team` — student-facing view of the staff responsible for the signed-in learner: the allocated lecturer, the other staff teaching their course/year group, and the institute administrators. The advisor is resolved in priority order — an explicit row in `student_teacher_assignments`, otherwise a match in `staff_course_assignments` on the learner's course and year (`source: "course-team"`), so learners created outside the bulk import still see the staff teaching their course. Only name, role and username are returned; trusted recovery emails are never exposed.
- `PATCH /api/accounts/profile` — updates the signed-in user's profile information.
- Academic course/year assignment is staff-managed and persisted in the SQLite `users` record; students do not have a self-service course-change endpoint.
- `POST /admin/accounts/student` — administrator/main-administrator creation of a student account.
- `POST /admin/accounts/admin` — administrator account creation, including temporary/permanent status.
- `PATCH /admin/accounts/:id` — administrator account information updates.
- `PATCH /admin/accounts/:id/role` — administrator role management.
- `DELETE /admin/accounts/:id` — protected administrator/student account deletion.

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
the API is local-origin restricted. Presentation preferences and selected UI state may use browser `localStorage`; live academic records are stored in SQLite. Ordinary SQLite names/IDs are not end-to-end encrypted in this prototype.
For sensitive real deployment data, add authenticated encryption (for example
AES-256-GCM with a key held outside the database), key rotation, encrypted
backups, OS disk encryption, least-privilege accounts, and retention/deletion
rules. Do not put encryption keys in source control or expose them to the
browser.

When `SEED_DEMO=true` is enabled, the backend seeds a published Biology
demonstration mark for `student` (`STU-001`, 92%, `BIO-001`) plus **49
additional demo students** (`STU-002`–`STU-050`) spread across the five
sample courses and year levels 1–4, with three assessments and a mixture of
workflow statuses. Set `SEED_DEMO=false` when you want these backend examples
removed on a clean installation. Assignment files and learner submissions are stored server-side under the local
`school_data/` runtime directory in the current release. Bulk student CSV export
is supported; staff can also download every submitted file for one assignment as
a single ZIP built client-side with JSZip from authenticated server downloads
from the **Assignments** page's "Download submissions ZIP" button. That download now fetches every submission's file in parallel
and skips (rather than aborting on) any single missing/failed file, so bulk
downloads for a class of 30–100 students stay fast and resilient to one bad
server-side download route. Because submissions are stored by the local backend, the same files remain available to authorised sessions across browsers/devices that reach the same API; a production deployment should move them to protected object storage and stream archives from the server.
Students must submit assignment work as a single `.zip` archive (other file
types are rejected client-side) so multi-file projects are always packaged
together and bulk downloads are uniformly zip-based.

Marks synced from SQLite carry a database `id`; the Results workflow dropdown
now only offers the single valid next status (Draft → Submitted → Approved →
Published → Locked) and calls the authenticated `/admin/marks/:id/status` and
`/admin/marks/:id` endpoints so a change is actually saved to the database
instead of being silently overwritten by the next SQLite sync.

## Assignment open/close/reopen behaviour — v4

Assignments now use an explicit backend-controlled opening state. The normal state is governed by `start_at` and `due_date + due_time`; a staff member can close an assignment with **Mark completed**, or reopen it with **Reopen**. Reopening stores `open_override=1` in SQLite, so the learner can submit even when the original due date has passed. Closing stores `completed=1` and clears the override.

The server enforces the same rules as the UI. Students cannot download or submit before the start time, after the due time, or after staff have closed the assignment. A student submission that has itself been closed by staff cannot be overwritten by a direct API request.

### Double-account assignment test matrix

| Test | Main admin | Regular admin | Temporary admin | Student | Expected |
| --- | --- | --- | --- | --- | --- |
| Create scoped assignment | Yes | Assigned group only | Assigned group only | No | Stored in SQLite |
| View assignment | All | Assigned groups | Assigned groups | Own course/year | Scope enforced by server |
| Download before start | Yes | Yes | Yes | No | Student receives open-window error |
| Submit before start | No | No | No | No | Server rejects |
| Close assignment | Yes | Assigned group | Assigned group | No | DB state becomes completed |
| Submit after close | No | No | No | No | Server rejects |
| Reopen assignment | Yes | Assigned group | Assigned group | No | `open_override=1` and learner can submit |
| Refresh/sign out/in | Yes | Yes | Yes | Yes | State remains identical from SQLite |
| Second browser/device | Yes | Yes | Yes | Yes | Same database state and scope |

This matrix is also used for regression checks on Tests & Exams, Results, Courses, Calendar and Accounts: after a successful write, the UI must update immediately and a later backend sync must return the same record rather than reverting it.

## v4 Assignment Reliability / Regression Update

The assignment workflow now has one authoritative open/closed state in SQLite. A normal assignment opens at its configured start time and closes at its configured due date/time. Staff may explicitly close it, or reopen it; reopening sets `open_override=1`, which lets learners submit after the original due date until staff close it again.

The server enforces the same state as the interface. Learners cannot download or submit before the assignment opens, after it closes, or after staff have closed the assignment. A submission already closed by staff cannot be overwritten by a direct request to the submission endpoint.

After a successful staff action, the interface updates its local React state immediately and then performs the normal SQLite synchronization. This prevents the previous brief mismatch where an administrator changed a state in the database but their current page still displayed the old state until the next polling cycle.

### Required role regression matrix

| Workflow | Main admin | Admin | Temporary admin | Student |
| --- | --- | --- | --- | --- |
| View assignments | All | Assigned course/year | Assigned course/year | Own course/year |
| Create assignment | Any valid course/year | Assigned group only | Assigned group only | No |
| Close/reopen assignment | Yes | Assigned group | Assigned group | No |
| Download before start | Allowed | Allowed | Allowed | Rejected |
| Submit before start | No | No | No | Rejected |
| Submit after staff close | No | No | No | Rejected |
| Reopen after due date | Yes | Assigned group | Assigned group | No |
| Submit after explicit reopen | N/A | N/A | N/A | Allowed, unless the individual submission was already closed |
| Refresh / sign out / sign in | Persists | Persists | Persists | Persists |

The same four-role regression approach is applied to Courses, Calendar, Tests & Exams, Results, Accounts and remediation workflows.

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
- **Optional showcase assignments/submissions are seeded by the backend when `SEED_DEMO=true`**:
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

## Assignment deletion regression fix

The previous V5 backend did not contain the `DELETE /admin/assignments/:id` route even though the React Assignments page called it. That mismatch caused a real **404** when staff selected **Delete**. The V7 backend restores the full assignment administration route set (`POST`, `PATCH`, status `PATCH`, and `DELETE`) and makes deletion idempotent for an assignment that has already been soft-deactivated. Truly unknown assignment IDs still return a normal 404, while an already-deleted record returns success so a stale browser does not show a misleading failure.

## Tests & Exams — scheduled tests, weighted questions, staff marking and remediation

Tests & Exams are now database-backed assessments with a real opening window, per-question mark allocation and a staff marking workflow.

- **Staff test authoring:** main administrators and assigned administrators/teachers/lecturers can create, edit, close, reopen and delete tests for their authorised course/year groups.
- **Scheduled opening:** every test has an opening date/time and closing date/time. Students can submit only while the test is open, unless authorised staff temporarily reopen it. Staff can still view and edit a test outside the student window.
- **Per-question marks:** every question has its own mark allocation. The total mark is calculated from all question allocations and the final percentage is normalised from earned marks / total marks × 100.
- **Question types:** multiple-choice questions are auto-marked. Long-answer / essay questions contain a staff-only model answer or marking guide and are held for staff review.
- **Staff correction:** the staff-side table shows each student's attempt. `Review / correct` opens every question, the student's answer, the expected/model answer and an editable awarded-mark box. This lets staff correct both automatically generated marks and manually marked long answers before the final result is published.
- **Persistence:** the test definition, opening window, question marks, answers, review feedback, reviewer and final score are stored in SQLite. Refreshing or signing in from another browser does not lose the test history.
- **Demo-data consistency:** the opt-in demo seed creates SQLite course rows for the Biology, Business Management and Mechanical Engineering names used by the bulk learner/test examples, so staff can edit the seeded tests instead of hitting a course-validation error.
- **Remediation:** a result below the configured passing mark creates a remediation case. Students and relevant staff receive an in-portal notification. When a remediation date/time is scheduled, the student receives another notification containing the schedule, venue and instructions.
- **Email:** remediation messages are placed into a SQLite email outbox. In a real deployment, install `nodemailer` and configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` and `SMTP_FROM`. `EMAIL_MODE=console` can be used during local assessment testing to print the exact email instead of sending it externally. An account needs a trusted email address for delivery.
- **Remediation test attempts:** remediation attempts use the same question set and per-question mark allocation. A remediation test with essay questions remains pending until staff review all question marks.
- **Pre-written question import:** staff can choose a JSON, CSV or TXT question file from the Test & Exam editor. Imported questions are parsed in the browser, validated, then inserted into the unsaved editor as either an append or replace operation. Nothing is written to SQLite until the staff member selects **Save test / exam**. MCQs accept 2–4 options; common CSV headers such as `Question Text`, `Question Type`, `Marks`, `Option 1`, `Option 2`, `Correct Answer` and `Model Answer` are accepted.
- **Safe test editing while a learner is writing:** staff may update the saved test, including its question text, marks and maximum-attempt setting, while another learner is active. The active learner session uses an immutable question snapshot, so the learner's current attempt cannot silently change halfway through an assessment; the revised test applies to future attempts.
- **Editable numeric fields:** passing mark, maximum attempts, duration and per-question marks are controlled as editable text values in the form. Staff can clear a field, retype it and save without the interface forcing a zero or producing `NaN`; the backend performs the final numeric validation.
- **Student work recovery:** answers are auto-saved locally when the attempt changes, every 15 seconds, and on browser unload. Before submission, the student gets a confirmation dialog offering **Save work & submit**, **Submit now**, **Download recovery copy** or **Cancel**. If the server request fails, the active attempt and answers stay on screen and the local draft remains available instead of being discarded. A transient failure while restoring an existing session also no longer clears the saved draft.
- **Question-level marking feedback:** staff can enter an awarded mark and separate feedback for every question, in addition to overall feedback. Main administrators publish the reviewed result; regular administrators save the review at the `Approved` stage.

### Test/exam workflow

1. Staff create the test for an assigned course/year group.
2. Staff set the opening date/time, closing date/time, passing mark, attempt limit and duration.
3. Staff add questions and assign marks to each one. Essay questions can include a model answer or marking guidance visible only to staff.
4. On the scheduled opening time, eligible students can start the test. Before the opening time or after the closing time, the submission endpoint rejects the attempt as well as the interface disabling the button.
5. MCQ-only attempts are scored automatically. Attempts containing long answers are stored as **Awaiting staff marking**.
6. Staff open `Review / correct`, check the student's answers and enter/correct the awarded mark for every question.
7. The final percentage is saved to Results. A mark below the pass threshold creates/remains linked to a remediation case.
8. Staff schedule remediation from the Results/remediation workflow. The student is notified in the portal and an email is queued with the remediation date/time when a trusted email address is available.

For a real institution, SMTP delivery and a production job runner should be monitored separately from academic marking. The local demonstration can use `EMAIL_MODE=console` so the workflow is testable without sending messages outside the machine.

### Pre-written question file formats

**JSON** may be an array or `{ "questions": [...] }`. Each MCQ can contain `question`, `options`, `correct` and `points`; essay questions can contain `question`, `points` and `modelAnswer`.

**CSV** should use a header row. A practical example is:

```text
Question Text,Question Type,Marks,Option 1,Option 2,Option 3,Option 4,Correct Answer,Model Answer
What does CPU stand for?,mcq,2,Central Process Unit,Central Processing Unit,Computer Personal Unit,Central Processor Utility,B,
Explain recursion.,essay,5,,,,,,A function that calls itself.
```

**TXT** uses labelled question blocks, for example:

```text
Question 1: Explain recursion
Type: essay
Marks: 5
Model answer: A function that calls itself.
```

The editor validates these files before adding them to the unsaved test. A file containing fewer than two usable MCQ options, an invalid correct answer, missing question text, invalid marks, or more than four MCQ options is rejected with a visible error.


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

## Production considerations for Tests & Exams

The current release already stores test definitions, attempts, question-level marks, staff review data, final marks and remediation cases in SQLite. For an institution-wide production deployment, retain that server-side design and add production infrastructure such as a managed database, protected object storage where files are involved, HTTPS, monitored SMTP/email delivery, backups, audit retention and load testing.

The browser receives only the answer data required for the signed-in role: students do not receive the MCQ correct-answer key or staff-only essay model answers. Staff endpoints are protected by role and teaching-group authorization.

## Test & exam schedule storage (date saving fix)

Test windows are stored and exchanged as **local wall-clock strings** — `start_at` as `YYYY-MM-DDTHH:mm`, `due_date` as `YYYY-MM-DD` and `due_time` as `HH:mm` — because that is exactly what `<input type="datetime-local">` emits and the only format it will accept back.

### The closing date always saved as 2099-12-31

The staff workspace loads its tests from `/admin/data`, not `/api/tests`. That query selected the title, marks and questions but **omitted `start_at`, `due_date`, `due_time`, `completed` and `open_override`**. `testRow` then filled the gaps with its fallbacks — the current time for the opening moment and the `2099-12-31` column default for the closing date — so every test on the page showed a window that had nothing to do with the database. Opening the editor loaded those invented values into the form, and saving wrote them back as though staff had chosen them. The same omission made a closed test reappear as open after a refresh.

The fix has three parts:

1. `/admin/data` now selects the schedule and status columns.
2. `testRow` no longer invents a window. A row with no usable schedule returns empty values, which the UI reports as **“Schedule needs attention”** rather than a plausible-looking lie that can be saved back.
3. The React editor treats `2099-12-31` as *not set*, so any record that already absorbed the sentinel shows an empty closing date and cannot be saved until a real one is chosen.

### Legacy UTC values

Separately, `tests.start_at` defaults to `CURRENT_TIMESTAMP`, which is **UTC** and space-separated (`2026-10-01 14:56:54`). Any row inserted without an explicit schedule carried a UTC instant that the browser and `new Date(...)` both read as *local*, so the window was off by the UTC offset. A `Z`-suffixed ISO string is rejected outright by `datetime-local`, which renders the field **blank** and then wipes the schedule on save.

`normalizeTestDateTime` / `normalizeTestDueDate` / `normalizeTestDueTime` in `backend/server.js` normalise on **both read and write** inside `testRow`, `validateTestDates` and `testIsOpenForStudents`, and the React editor normalises before display and before `PATCH`. Existing rows therefore display correctly immediately and are rewritten the first time they are saved — no migration step is required. The demo seed now inserts explicit dates, and it also registers every course its demo data references (Computer Science and Psychology were missing, which made the seeded tests for those courses fail the course check and become uneditable).

Regression coverage lives in `backend/test/backend.test.js` (`test schedules are normalised to local wall-clock and survive a partial edit`): a row created with the SQLite defaults must come back as a local `YYYY-MM-DDTHH:mm` value; explicit dates must round-trip; a title-only `PATCH` must leave the window intact; an inverted window must be rejected with 400; `/admin/data` must carry the schedule and the closed state; and a row with no usable schedule must report empty values instead of an invented window.

### Tests & Exams page flow

* Each test card shows an availability pill — **Open now / Scheduled / Closed / Needs attention** — and the list is sorted by that status, so broken or live papers surface first.
* An availability filter sits beside the course and year filters, and staff see a banner counting tests whose schedule is unusable.
* The editor shows a live window summary (status plus duration) and blocks saving with a specific message when the opening or closing moment is missing or out of order, instead of the previous generic failure.
* **Duplicate** clones a paper with its questions, a fresh one-hour window and a `(copy)` title.
* The teaching-group lookup on save now reads the same list the editor renders, so a test belonging to a previous academic year can be opened *and* saved rather than failing with a misleading validation message.

## Student cards — templates, default design and learner photos

### Bugs fixed

* **A replaced photo never appeared.** Photo URLs were constant and cached for five minutes, so the browser kept showing the old image. URLs now carry the upload time (`…/photo?v=<updated_at>`), so a new photo always gets a new URL.
* **There was no real template choice.** Printing used whichever template happened to be open in the editor. The main administrator now marks one template as the **default**, and picks the template per print run from **Print using**. The first template is made the default automatically. If the default is deleted, the next template is promoted.
* **Unsaved edits were silently lost** when switching templates or clicking New template. The editor now shows an *Unsaved changes* badge, asks before discarding edits, and offers **Undo changes**.
* Photo-streaming errors escaped the route's `try/catch`. The preview showed `Year —` while the printed card showed `Not assigned`. Photo messages appeared at the top of the profile instead of beside the photo.
* **Reject photo** used `window.prompt()`, which some browsers and embedded webviews block. It is now an inline form.

### Learner photo flow (Profile page)

1. **Upload photo**: the file is checked (JPG/PNG/WebP, maximum 5 MB) and previewed *before* it is sent.
2. **Use this photo** saves it; **Choose a different photo** or **Cancel** backs out.
3. **Upload a new photo** replaces it at any time, and the old file is deleted from disk.
4. **Delete photo** removes it at will, after a confirmation.
5. The learner sees a live preview of their card in the institution's **default design**.

### Main-administrator tools

* Summary tiles show learners, photos uploaded, photos missing and the default design.
* Size presets: ID card 85.6 × 54, portrait 54 × 85.6, large badge 100 × 70.
* Duplicate a template, and preview the live design with any learner.
* Filter by course and photo status. Select learners to **Print selected**, or use **Print all shown**. Each card prints on its own page.
* **Missing-photo list (CSV)** to chase learners who still need to upload.
* **Reject photo** (`DELETE /admin/student-cards/students/:studentId/photo`) removes an unsuitable photo, audits the action, and notifies the learner with the optional reason.
* `POST /admin/student-cards/templates/:id/default` sets the default design. The `student_card_templates.is_default` column is added automatically on start-up.

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

The portal uses SQLite as the authoritative store for live operational records when the API is running. Accounts, courses, teaching-group allocations, assignments, assignment submissions, tests, test attempts, marks, remediation cases and calendar events are loaded from the backend. React state is only the current UI representation and is refreshed from the backend after successful writes and during periodic synchronization.

The browser may still store presentation preferences such as language, dark mode and selected UI state. Those preferences are not the source of truth for academic records.

Learner profiles require a unique student ID and an institution-controlled course/year allocation. Students cannot change their academic scope themselves. Passwords are hashed by the backend, and duplicate identities are rejected before saving.

Every account has a **Profile** page for updating permitted account information. Name and username changes are saved through the local SQLite API. Students can update permitted identity fields such as their student ID; academic course and year-of-study remain institution-controlled and are assigned by authorised staff.

Trusted email is stored in SQLite and can be updated from Profile. This address is used for remediation email delivery when SMTP is configured.

The signed-in workspace displays the current date using the device locale. Student results calculate a normalized weighted average; remediation entries retain the original mark and show minimum, maximum, and average across recorded attempts. The campus initials in the loading, login, and workspace branding are generated from the configured school name.

Assignment submissions are limited to PDF/document/image/ZIP extensions and 25 MB, with executable extensions rejected before upload and persisted by the backend. Students confirm uploads and can remove or replace a file until staff close the submission. Administrators can download the submitted file, close it, enter a final mark, and print a mark summary through the browser's **Save as PDF** dialog; the published mark is also added to the learner's Results profile with remediation feedback when below the configured threshold.

Staff can modify assignment details or mark an assignment completed. Completed assignments and assignments past their due date no longer accept student uploads. After closing a submission, staff can upload a marked feedback package as a ZIP (maximum 25 MB); the learner sees a **Download marked ZIP** button alongside the published mark. The browser demo validates extensions and size, but a production deployment should also virus-scan uploads server-side before making them downloadable.

Assignments support an explicit end date and time. Staff can delete an incorrect assignment after confirmation. Students see completed/expired assignments with a strike-through state, and a normal submission is marked completed immediately with a notice that marking is pending. If the published mark is below the passing threshold, the same submission record reopens for a remediation upload; staff can download that remediation file, enter the replacement mark, and upload a marked ZIP for the learner.

Assignment changes are written to SQLite. The current screen updates immediately from the successful API response, and the normal authenticated synchronization then refreshes other open sessions. Staff can review each matched submission, close it, enter its mark directly on the submission card, and the result is immediately available in the learner’s Results area. Once an assignment is completed, expired, or otherwise closed by the server, the learner cannot download, remove or replace the submitted file.

Results recalculate the grade and remediation status whenever staff change the passing percentage; saved marks are never silently reinterpreted using the old threshold. For learners: open **Results** after publication, download the summary/marked ZIP, read staff feedback, and follow the remediation deadline if shown. For staff: verify the learner, course, assessment and submission, enter a 0–100 score, add clear feedback, check the calculated threshold result, then publish and provide the marked feedback package.

### Course storage

The institution course catalogue is stored in SQLite and is the source used by course selectors. Additional courses created through **Course administration** are immediately returned by the API and are visible to every authorised user connected to the same database.

A student's course and year of study are stored in the SQLite `users` record and are assigned by staff during enrolment.

### Session persistence, course selection, and the submissions table

Two long-standing local-only bugs were fixed so the SQLite-backed workspace behaves the way a real portal should:

Profile updates are being handled through the same SQLite-backed account model so that name, username and student informaton are not reverted by the periodic `/admin/data` synchronization.

- **Refreshing the page no longer signs anyone out.** The backend already issued an `HttpOnly` session cookie on sign-in, but nothing on the frontend used it to restore state after a reload — `App` simply reset to a blank login screen every time. A new `GET /api/accounts/me` endpoint reads the cookie via the existing `sessionUser()` helper and returns the current account if the session is still valid; the React app calls it once on mount and repopulates the signed-in user automatically. If the cookie has expired or the API is offline, the login screen is shown as before.
- **A student's course and year of study are staff-controlled and persisted in SQLite.** The `users` record stores `course` and `year_level`; the Courses enrolment workflow writes these values through the protected administrator API. Students do not have a self-service endpoint for changing academic scope.
- **All submissions are shown in one searchable, filterable table** on the **Assignments** page instead of being split into small cards per assignment (which became unreadable once a course had many assignments and many learners). Staff can search by student name/ID/assignment title, and filter by assignment, course, year of study, and status (open / closed-awaiting-mark / marked) — all client-side and instant. Grading, downloading, closing, and uploading marked ZIP feedback all happen inline in the table row, and the bulk "download all submissions as one ZIP" button remains available per assignment above the table.
- **Students are grouped by year of study** (1st through 6th year, since course lengths vary) using the same `year_level` field set on the Courses page; the submissions table's Year column and year filter use this to make it fast to find, say, "all 2nd-year Computer Science submissions" once a school has many learners.

### Testing a CSV import

Create a plain-text file named `sample-marks.csv` in the project folder with exactly this content:

```csv
studentId,assessmentId,mark
STU-001,BIO-001,92
STU-001,BIO-002,58
```

Start the backend and use the staff **CSV uploads** screen to select it. The browser validates the complete file before upload, and the backend performs the same all-or-nothing validation when `/admin/upload-marks` is used. Valid rows appear as Draft marks. Invalid file extensions, missing headers, blank files, malformed student/assessment IDs, non-numeric or out-of-range marks, duplicate student/assessment pairs, unknown students, and marks that already exist are rejected with an error message; no rows from a rejected batch are imported. Use UTF-8 CSV with the exact headers `studentId,assessmentId,mark` (the snake_case aliases `student_id,assessment_id` are accepted by the backend). Quoted values are supported by the browser demo for simple fields. The browser UI remains available on other devices when the frontend is hosted and configured to call a reachable backend; live academic records are backend/SQLite-backed.

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

The current local implementation uses `GET /api/accounts/me` and the consolidated submissions table. Academic course/year assignment is staff-controlled and is not a student self-service feature. The following items would need to change for a real, multi-server deployment:

- **Sessions**: the demo keeps sessions in an in-memory `Map` inside `server.js`, so restarting the process or running more than one server instance loses every session. In production, back sessions with Redis or a database table (e.g. `express-session` with `connect-redis`/`connect-pg-simple`) so `GET /api/accounts/me` keeps working across restarts and horizontal scaling, and set `Secure`, `SameSite=Strict`, and a short rolling expiry on the cookie once served over HTTPS.
- **Course/year updates**: course/year changes should be performed by authorised institutional staff and should be gated behind an academic-calendar rule (for example, an add/drop deadline) and a formal enrolment workflow.
- **Submissions table at scale**: the demo filters/searches the submissions table entirely in the browser, which is fine for a few hundred rows but should move to server-side pagination, search, and filtering (e.g. `GET /admin/submissions?search=&course=&year=&status=&page=`) once a school has thousands of learners, so the browser never has to download every submission row at once.
- **File storage**: submission files and marked-ZIP feedback are currently stored by the local backend under `school_data/` and exposed through authenticated download routes. A production build should move file bytes to protected object storage or a hardened uploads service, with retention, malware scanning and access controls.

## Earlier Test & Exam / presentation improvements retained in this release

The current release retains the earlier Tests & Exams improvements for course-selector fixes, long-answer support, printable results, showcase presentation controls and the assignment code-of-conduct acknowledgement. The current Tests & Exams workflow is documented above and extends those features with scheduled opening/closing, weighted question marks, staff correction and remediation notification/email support.

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

Staff are never filtered   main admins and admins always see and can mark every assignment. The add and edit
assignment forms expose all four fields, and after saving, the portal reports how many learners will actually
receive the work so nobody publishes an assignment to an empty audience by accident.

Students see a line above their list reading *"Showing work for **Biology**   Year 2"* so it is obvious why the
list looks the way it does, and how to change it.

### 2. Missed-submission warnings lead explicitly to remediation
Two states are calculated from the deadline (`due` + `dueTime`, defaulting to 23:59):

- **At risk**   unsubmitted and due within 72 hours. Shown inline as an amber nudge.
- **Missed**   the deadline has passed and nothing was uploaded. Because staff already control the due date and
  can extend it, a lapse at this point genuinely means remediation, so the wording says so plainly.

Missed work triggers a one-off in-portal notification per assignment. Warned assignment IDs are remembered in
`localStorage` under `portal-missed-warned-<username>`, so the learner is told once rather than nagged on every
page visit. A summary banner at the top of the list counts how many assignments were missed.

### 3. Previous-year archive
Work from an earlier `academicYear` moves out of the active list into a collapsible **"Show previous years of
&lt;course&gt;"** block. Year matching is offset by how long ago the work was set   a learner in Year 2 today was in
Year 1 last year   so their own history actually appears instead of being filtered out. Each archived row shows
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

Printing reuses the project's existing approach   `window.open` plus an HTML table plus `window.print()`   so
there is no PDF library and no external service. If pop-ups are blocked the portal says so rather than failing
silently.

### Running on a real server
- **Assignments are SQLite-backed in the current revision.** The `assignments` table stores course, year, academic year, start/due window, completion state, and the `open_override` used when authorised staff reopen an assignment after its original due date.
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
- **Memos are editable in place.** Use **Add memo** to create one, **Edit memo** to change it,
  **+ Add criterion** / the per-row **Delete** button to manage criteria, and **Delete memo** to
  remove it. Criteria maxima rarely sum to exactly 100, so the released percentage is always
  normalised against the memo total — that keeps a 40-mark memo and a 100-mark memo directly
  comparable.

### Memo storage (SQLite)
Memos are stored in the `assignment_memos` table (one row per assignment; `criteria` is a JSON
array of `{id, label, max, guidance}`), so every marker allocated to the course/year sees the same
memo and it survives a browser wipe. Previously memos lived only in `localStorage`.

| Endpoint | Purpose |
| --- | --- |
| `GET /admin/memos` | Memos for assignments in the caller's teaching groups |
| `PUT /admin/memos/:assignmentId` | Create (201) or replace (200) a memo; validates labels, maxima (1–1000) and at most 50 criteria |
| `DELETE /admin/memos/:assignmentId` | Remove a memo (idempotent) |

Deleting an assignment also deletes its memo. All writes are audited (`memo_created`,
`memo_updated`, `memo_deleted`). `localStorage` (`portal-memos`) is now only a read cache for
offline marking; memo edits are disabled while the API is offline. The first time a browser
connects after this upgrade, any memo that existed only in that browser is uploaded once
(`portal-memos-migrated-v1`).

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
- **Marking drafts remain browser-local for offline work.** Memos are now in SQLite (see above); a
  `marking_drafts` table (keyed to submission + marker) would additionally let a marker start
  on a desktop and finish on a laptop, and would let a moderator review a colleague's sheet.
- **The outbox should survive a browser wipe.** Today the queue lives only in `localStorage`. For
  real invigilated marking, drafts should sync opportunistically to the server as well, so clearing
  site data cannot destroy unsent work.
- **Submission files are held as in-browser object URLs.** A real deployment stores them on disk or
  in object storage and streams them through an authenticated route, so a marker on another machine
  can open the same file.

### Returning marked work to the learner (feedback loop)
**Why marked work used to "disappear":** the API already returned `markedFileUrl` and
`markFeedback`, but the student Assignments page never rendered them — the only marked-copy button
was in the staff table. Publishing through the approval workflow also never updated the submission
row, so the learner could re-upload and overwrite a marked script.

How it works now:
1. Staff return an annotated ZIP from the **Marking room** ("Return the marked copy") or the
   Assignments table ("Return / Replace marked copy"). Returning a copy closes the submission so it
   cannot be overwritten. "Remove marked copy" withdraws a wrongly attached file.
2. The learner sees nothing — neither the score nor the marked copy — until the mark is
   **Published** (directly by the main admin, or Submitted → Approved → Published). Publishing in
   either path syncs `assignment_submissions` and sends an in-app notification. A retried
   (idempotent) release also repairs a submission row that fell out of sync.
3. The learner's Assignments page shows summary chips (to submit / awaiting marking / marked &
   returned / new marked copies) and a **feedback card**: score and pass/fail, per-criterion bars
   parsed from the marking sheet, the marker's comment, the weakest criteria to focus on, a pointer
   to any remediation task, **Download marked copy** (with a *New* badge) and a **reflection** box.
4. The first learner download is recorded (`marked_downloaded_at`) and the reflection is stored in
   SQLite (`reflection`, max 4000 characters). Staff see both in the Assignments table and the
   marking pane; the Marking room's *Recently released* / *Release history* tables now list every
   published result from SQLite (not only ones released from the current browser) with the real
   marker's name and the learner's download status.
5. The Overview lists a learner's own work as *Submitted* or *Marked · NN%* rather than *To do*.

Server timestamps (`CURRENT_TIMESTAMP`, stored in UTC without a zone) are displayed through a shared
`serverTime()` helper so they appear in the viewer's local time.

Covered by the backend test *"marked work reaches the learner only once published, with download
receipt and reflection"*.

## Full-site design and feature regression sweep

The design and regression notes below document fixes from earlier revisions. For this V7 release, the final executable source-level regression suite was rerun against the supplied files; a live browser walkthrough and package build are not claimed because the supplied source snapshot does not include the project dependencies.

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

For any real deployment, run the API with `SEED_DEMO=false` and build the frontend with
`REACT_APP_SEED_DEMO=false`, so no showcase learners or demo passwords are created. Also disable
course examples with `SEED_COURSE_EXAMPLES=false` and `REACT_APP_SEED_COURSE_EXAMPLES=false`.
Create the first administrator through the portal's **Initial system setup** screen. The setup
endpoint creates the first main administrator only while the `users` table is empty. See the
`SHOWCASE_EXAMPLES_REMOVE.txt` file for the full procedure. **Never ship `ChangeMe123!` /
`Admin123!` / `Student123!` to a live system.**

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

External services are optional for the local build: SMTP is used for remediation email delivery when configured, and password-reset email can likewise be connected to an email provider. The academic database, test marking and remediation workflow remain self-contained in the application stack.

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

### Verification performed

This revision was rechecked as an integrated V7 Test & Exam and assignment release using the supplied V5 source snapshot as the starting point and the final V7 replacements generated from it:

- Server, database and reset scripts passed `node --check`.
- The React `App.js` passed the TypeScript/JSX parser check with **0 syntax diagnostics**.
- The latest focused release suite passed **88/88** checks covering the assignment 404 regression, assignment deletion semantics, Test & Exam CRUD routes, weighted question scoring, JSON/CSV/TXT imports and invalid-import rejection, student answer-key protection, staff snapshot marking, question-level feedback, max-attempt editing/validation, draft recovery/autosave, role/account permissions, CSS collision checks, and reset safety.
- The SQLite schema/index smoke test passed, including the new test-attempt session, question snapshot, question-feedback and email-outbox fields. The isolated schema check continues to verify the current table/index definitions without requiring a separate SQLite server.
- The remediation email helper check passed for invalid addresses, console delivery and duplicate-message deduplication.
- The reset-install check passed normal reset, idempotence, production protection and explicit production override.
- CSS brace structure and README code fences were also checked.

A real `npm install`, Express/SQLite startup, browser click-through, physical Windows/macOS/Android/iOS testing and external SMTP delivery still require the actual repository checkout and runtime services because the supplied source snapshot does not contain the project package manifests or installed dependencies. Those tests are therefore not claimed as executed here.

## Academic-year calendar, assessment history and bulk learner onboarding

The Calendar now has an explicit **academic-year selector** for staff and students. Administrators can move into future academic years (including the following year) and the staff view loads the teaching course/year groups allocated for that selected year. Main administrators can schedule institution-wide events for a chosen academic year; regular administrators remain restricted to their own assigned course/year groups.

For learners, the Calendar includes read-only history for the learner's course/year across all available academic years. Previous assignments and tests/exams appear in the calendar using assessment labels, while staff-created calendar events remain separate and editable only by authorised staff.

Student onboarding now supports two controlled paths without duplicating authentication logic:

1. **Individual learner creation:** the existing Courses page creates one learner through `/admin/accounts/student` and requires a course, year, responsible teacher and trusted email.
2. **Bulk learner import:** the Accounts page accepts a CSV containing `name, username, password, studentId, trustedEmail, course, yearLevel, teacherUsername, academicYear`. The backend validates the entire file before creating anything, rejects duplicate usernames/student IDs, confirms the teacher is assigned to the course/year, and creates all accounts in one transaction. A failed validation therefore does not leave half an imported class in the database.

Student self-registration is available from the sign-in page after the first main administrator has completed initial setup. A learner enters their name, student ID, trusted email, course, year of study, username and password. The backend validates the course against the current catalogue, prevents duplicate usernames/student IDs, rate-limits registration attempts, hashes the password with the existing bcrypt workflow, and stores the account in SQLite. Teacher/lecturer group allocation remains an administrator responsibility.

### Regression checks for this release

The release was checked for:

- academic-year navigation from past through future years;
- staff teaching-group loading for the selected future year;
- main-admin institution-wide calendar permissions;
- regular-admin course/year calendar permissions;
- student visibility of historical assignments and tests/exams;
- read-only treatment of synthetic assessment calendar entries;
- calendar create/edit/delete route presence and role protection;
- bulk CSV required-column validation;
- duplicate username and student-ID detection within a file and against SQLite;
- teacher/course/year allocation validation;
- atomic bulk import behavior (no partial commit after validation failure);
- individual and bulk account flows using the same `createStudent` database validation;
- responsive calendar-year and import controls at narrow widths;
- Node syntax and JSX parsing of the packaged source.

A real `npm install`, live Express/SQLite boot, browser click-through and SMTP delivery still require the full repository checkout with its package manifests and installed dependencies. Those are not claimed as executed from the source-only snapshot.


## Student self-registration

The sign-in page now includes **New student? Create an account**. This is a real SQLite-backed account-creation workflow, not a browser-only/localStorage account.

Registration requires:

- Full name
- Student ID
- Trusted email
- Course from the live course catalogue
- Year of study (1–6)
- Username
- Password and confirmation

The backend accepts the public registration request only after at least one user exists, so a clean installation still begins with the first main-administrator setup screen. Registration is rate-limited and validates duplicate usernames/student IDs, password length, Student ID format, email format, course existence and year level before writing the new student account.

After the account is created, the username/password are placed back into the sign-in form so the learner can sign in normally. The student account is always created with the `student` role. No public registration field can create an administrator account or grant staff permissions. Lecturer/teacher allocation remains staff-managed.

## Current release revision — academic-year calendar and learner onboarding

The current tested release extends the existing academic workflow without creating a second authentication system.

### Academic-year calendar

Staff can use the Calendar year selector to move backwards or forwards through academic years. The selected year is used to load the staff member's teaching allocations from SQLite. Main administrators can see all allocated course/year groups for the selected year; regular administrators see only their own teaching allocations.

The Calendar now displays a compact **Teaching assignments for this year** summary, so a staff member can immediately see which course and year they are assigned to before scheduling an event.

Student Calendar browsing is read-only for assessment history. Students can select previous academic years to see assignments and tests/exams from earlier years in their course. For the current academic year, assessment entries are limited to the student's current year of study. Future-year tests/assignments are not exposed to students merely because they exist in the database.

### Learner account creation

Student self-registration is now part of the normal authentication workflow. It is exposed only after initial administrator setup is complete; staff still control lecturer/group allocation.

The portal has two supported learner-creation paths:

- **One learner at a time:** the existing Courses page account-creation function is retained. The administrator selects the course, year of study, academic year and responsible teacher/lecturer. The backend verifies that the selected teacher is allocated to that exact teaching group before the account is created.
- **Many learners at once:** the Accounts page accepts a CSV import. The importer uses the same validation rules as individual creation, checks duplicates before committing changes, verifies teacher/course/year allocation, supports `academicYear`, and commits the batch atomically.

The student then uses the normal sign-in screen with the credentials supplied by the institution. This avoids duplicating password, session and account-validation logic.

### Import format

The CSV importer accepts flexible header spacing/capitalisation, including variants such as `Student ID` and `teacher username`. Required data are the learner's name, username, password, student ID, course and year of study; the responsible teacher must also be supplied as `teacherUsername` or `teacherId`. `trustedEmail` and `academicYear` are recommended.

Malformed CSV structures return a controlled validation response rather than an unhandled server error. Uploads are limited to 25 MB and a single import is limited to 1,000 learner rows.

### Current verification status

The current source-only regression pass completed **52/52 targeted checks**:

- 3 Node syntax checks: `server.js`, `db.js`, `reset-install.js`;
- 1 React JSX parser check with 0 diagnostics;
- 39 route, feature, CSS and SQLite schema/index checks;
- 4 executable question-import fixture checks (JSON, two-option CSV, TXT, invalid-input rejection);
- 5 SQLite behavioural checks covering historical/current assessment visibility, future teaching-group lookup, out-of-scope staff protection, assignment soft deletion and duplicate-account protection.

The exact project's CRA ESLint command was not executed because the supplied source snapshot does not include the repository's installed ESLint dependency. The hook changes were reviewed specifically against the warnings previously reported by CRA, including the stable draft-key callback and its dependency list.

A live `npm install`, production build, Express/SQLite startup, browser click-through, physical device testing and external SMTP delivery still require the complete repository checkout and its dependency manifests. These are not claimed as executed from the source-only snapshot.
