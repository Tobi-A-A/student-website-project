const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// Built-in course examples are showcase content, not tenant data. They are served from the
// backend only when SEED_COURSE_EXAMPLES=true. Newly created courses
// are stored permanently in SQLite.
const COURSE_EXAMPLES = [
  { name: 'Computer Science', requirement: 'Maths, English, and logical problem-solving; often a programming project.' },
  { name: 'Business Administration', requirement: 'English, basic Maths, and an interest in finance, management, or enterprise.' },
  { name: 'Psychology', requirement: 'English, Biology or Social Science, plus strong research and essay skills.' },
  { name: 'Nursing', requirement: 'Biology or Health Science, Maths, English, DBS/background checks, and an interview.' },
  { name: 'Engineering', requirement: 'Advanced Maths and Physics/Chemistry, with practical problem-solving skills.' },
];
const USE_COURSE_EXAMPLES = process.env.SEED_COURSE_EXAMPLES === 'true';

// PORTAL_DATA_DIR selects the whole installation folder: the SQLite database and every uploaded
// file live under it. The default keeps the original backend/school_data location, so existing
// installations are unaffected; the install launcher (scripts/portal-install.js) points it at
// backend/installs/demo or backend/installs/clean so test installs never touch real data.
const configuredDataDir = String(process.env.PORTAL_DATA_DIR || '').trim();
const DATA_ROOT = configuredDataDir ? path.resolve(configuredDataDir) : path.resolve(__dirname, 'school_data');
fs.mkdirSync(DATA_ROOT, { recursive: true });
const configuredDbPath = String(process.env.DB_PATH || '').trim();
const DB_PATH = configuredDbPath && configuredDbPath !== ':memory:'
  ? path.resolve(configuredDbPath)
  : (configuredDbPath === ':memory:' ? ':memory:' : path.join(DATA_ROOT, 'portal.sqlite'));
if (DB_PATH !== ':memory:') fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new sqlite3.Database(DB_PATH);
db.configure('busyTimeout', 5000);

const ready = new Promise((resolve, reject) => db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    student_id TEXT UNIQUE,
    role TEXT NOT NULL CHECK(role IN ('main-admin','admin','student')),
    temporary INTEGER NOT NULL DEFAULT 0,
    failed_attempts INTEGER NOT NULL DEFAULT 0, 
    locked_until TEXT, 
    two_factor_secret TEXT, 
    trusted_email TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  // Upgrade databases created by the original demo without destroying accounts.
  db.run('ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0', () => { });
  db.run('ALTER TABLE users ADD COLUMN temporary INTEGER NOT NULL DEFAULT 0', () => {});
  db.run('ALTER TABLE users ADD COLUMN locked_until TEXT', () => { });
  db.run('ALTER TABLE users ADD COLUMN two_factor_secret TEXT', () => { });
  db.run('ALTER TABLE users ADD COLUMN trusted_email TEXT', () => { });
  db.run('ALTER TABLE users ADD COLUMN course TEXT', () => { });
  db.run('ALTER TABLE users ADD COLUMN year_level INTEGER', () => { });

  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    requirement TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_courses_active_name ON courses(active, name)');

  db.run(`CREATE TABLE IF NOT EXISTS staff_course_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course TEXT NOT NULL,
    year_level INTEGER NOT NULL CHECK(year_level BETWEEN 1 AND 6),
    academic_year INTEGER NOT NULL DEFAULT (CAST(strftime('%Y','now') AS INTEGER)) CHECK(academic_year BETWEEN 2000 AND 2100),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course, year_level, academic_year)
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_staff_course_assignments_user ON staff_course_assignments(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_staff_course_assignments_group ON staff_course_assignments(course, year_level, academic_year)');
  // A learner has one active responsible teacher/lecturer for each academic year. This is
  // separate from staff teaching-group ownership so the main administrator can see exactly
  // who is responsible for an individual learner. Deleting the learner removes this row;
  // deleting a staff account leaves the learner without a responsible lecturer instead of
  // breaking the account.
  db.run(`CREATE TABLE IF NOT EXISTS student_teacher_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL REFERENCES users(student_id) ON UPDATE CASCADE ON DELETE CASCADE,
    teacher_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    academic_year INTEGER NOT NULL DEFAULT (CAST(strftime('%Y','now') AS INTEGER)) CHECK(academic_year BETWEEN 2000 AND 2100),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, academic_year)
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_student_teacher_student ON student_teacher_assignments(student_id, academic_year)');
  db.run('CREATE INDEX IF NOT EXISTS idx_student_teacher_teacher ON student_teacher_assignments(teacher_user_id, academic_year)');
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS uq_users_student_id ON users(student_id)');
  db.run(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS assessments (id TEXT PRIMARY KEY, name TEXT NOT NULL, max_mark REAL NOT NULL DEFAULT 100 CHECK(max_mark > 0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);

  // Central test/exam attempt history. Test definitions are database-backed so every
  // browser sees the same assessment catalogue and every submitted learner attempt is persisted here so administrators can report on results
  // across accounts and browser sessions without relying on one device's localStorage.
  db.run(`CREATE TABLE IF NOT EXISTS test_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id TEXT NOT NULL,
    student_id TEXT NOT NULL REFERENCES users(student_id) ON UPDATE CASCADE ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL CHECK(attempt_number > 0 AND attempt_number <= 10),
    score REAL NOT NULL CHECK(score >= 0 AND score <= 100),
    earned_points REAL NOT NULL DEFAULT 0 CHECK(earned_points >= 0),
    total_points REAL NOT NULL DEFAULT 0 CHECK(total_points >= 0),
    correct INTEGER NOT NULL DEFAULT 0 CHECK(correct >= 0),
    total INTEGER NOT NULL DEFAULT 0 CHECK(total >= 0),
    needs_review INTEGER NOT NULL DEFAULT 0 CHECK(needs_review IN (0,1)),
    passed INTEGER,
    essay_answers TEXT,
    question_marks_json TEXT NOT NULL DEFAULT '[]',
    answers_json TEXT NOT NULL DEFAULT '{}',
    review_feedback TEXT NOT NULL DEFAULT '',
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TEXT,
    review_question_feedback_json TEXT NOT NULL DEFAULT '[]',
    question_snapshot_json TEXT NOT NULL DEFAULT '[]',
    session_id TEXT,
    is_remediation INTEGER NOT NULL DEFAULT 0 CHECK(is_remediation IN (0,1)),
    taken_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(test_id, student_id, attempt_number)
  )`);
  db.run('ALTER TABLE test_attempts ADD COLUMN is_remediation INTEGER NOT NULL DEFAULT 0', () => {});
  db.run('ALTER TABLE test_attempts ADD COLUMN earned_points REAL NOT NULL DEFAULT 0', () => {});
  db.run('ALTER TABLE test_attempts ADD COLUMN total_points REAL NOT NULL DEFAULT 0', () => {});
  db.run('ALTER TABLE test_attempts ADD COLUMN question_marks_json TEXT NOT NULL DEFAULT \'[]\'', () => {});
  db.run('ALTER TABLE test_attempts ADD COLUMN answers_json TEXT NOT NULL DEFAULT \'{}\'', () => {});
  db.run('ALTER TABLE test_attempts ADD COLUMN review_feedback TEXT NOT NULL DEFAULT \'\'', () => {});
  db.run('ALTER TABLE test_attempts ADD COLUMN reviewed_by INTEGER', () => {});
  db.run('ALTER TABLE test_attempts ADD COLUMN reviewed_at TEXT', () => {});
  db.run("ALTER TABLE test_attempts ADD COLUMN review_question_feedback_json TEXT NOT NULL DEFAULT '[]'", () => {});
  db.run("ALTER TABLE test_attempts ADD COLUMN question_snapshot_json TEXT NOT NULL DEFAULT '[]'", () => {});
  db.run('ALTER TABLE test_attempts ADD COLUMN session_id TEXT', () => {});
  db.run('UPDATE test_attempts SET total_points=CASE WHEN total_points=0 THEN total ELSE total_points END, earned_points=CASE WHEN earned_points=0 THEN ROUND((score/100.0)*CASE WHEN total_points=0 THEN total ELSE total_points END,2) ELSE earned_points END WHERE total_points=0 OR earned_points=0', () => {});
  db.run('CREATE INDEX IF NOT EXISTS idx_test_attempts_student ON test_attempts(student_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_test_attempts_test ON test_attempts(test_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_test_attempts_taken ON test_attempts(taken_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_test_attempts_session ON test_attempts(session_id)');

  db.run(`CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    course TEXT NOT NULL,
    year_level INTEGER NOT NULL CHECK(year_level BETWEEN 1 AND 6),
    academic_year INTEGER NOT NULL CHECK(academic_year BETWEEN 2000 AND 2100),
    term TEXT NOT NULL DEFAULT '',
    start_at TEXT NOT NULL,
    due_date TEXT NOT NULL,
    due_time TEXT NOT NULL DEFAULT '23:59',
    duration INTEGER NOT NULL DEFAULT 60 CHECK(duration > 0),
    file_name TEXT,
    file_path TEXT,
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
    open_override INTEGER NOT NULL DEFAULT 0 CHECK(open_override IN (0,1)),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(title, subject, course, year_level, academic_year)
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_assignments_scope ON assignments(course, year_level, academic_year, active)');
  db.run('ALTER TABLE assignments ADD COLUMN open_override INTEGER NOT NULL DEFAULT 0', () => {});
  db.run('CREATE INDEX IF NOT EXISTS idx_assignments_owner ON assignments(owner_id)');

  db.run(`CREATE TABLE IF NOT EXISTS assignment_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users(student_id) ON UPDATE CASCADE ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed INTEGER NOT NULL DEFAULT 1 CHECK(completed IN (0,1)),
    closed INTEGER NOT NULL DEFAULT 0 CHECK(closed IN (0,1)),
    closed_at TEXT,
    mark REAL,
    mark_published_at TEXT,
    conduct_acknowledged INTEGER NOT NULL DEFAULT 0 CHECK(conduct_acknowledged IN (0,1)),
    marked_file_name TEXT,
    marked_file_path TEXT,
    marked_uploaded_at TEXT,
    UNIQUE(assignment_id, student_id)
  )`);
  // Feedback loop: when the learner first opened the returned marked copy, and their own reflection
  // on what went wrong, which staff can read when planning remediation.
  db.run('ALTER TABLE assignment_submissions ADD COLUMN marked_downloaded_at TEXT', () => {});
  db.run('ALTER TABLE assignment_submissions ADD COLUMN reflection TEXT', () => {});
  db.run('ALTER TABLE assignment_submissions ADD COLUMN reflection_updated_at TEXT', () => {});
  db.run('CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment ON assignment_submissions(assignment_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON assignment_submissions(student_id)');

  db.run(`CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    course TEXT NOT NULL,
    year_level INTEGER NOT NULL CHECK(year_level BETWEEN 1 AND 6),
    academic_year INTEGER NOT NULL CHECK(academic_year BETWEEN 2000 AND 2100),
    start_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_date TEXT NOT NULL DEFAULT '2099-12-31',
    due_time TEXT NOT NULL DEFAULT '23:59',
    completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
    open_override INTEGER NOT NULL DEFAULT 0 CHECK(open_override IN (0,1)),
    passing_mark REAL NOT NULL DEFAULT 60 CHECK(passing_mark BETWEEN 0 AND 100),
    duration_minutes INTEGER NOT NULL DEFAULT 20 CHECK(duration_minutes > 0),
    max_attempts INTEGER NOT NULL DEFAULT 2 CHECK(max_attempts BETWEEN 1 AND 10),
    questions_json TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run('ALTER TABLE tests ADD COLUMN start_at TEXT', () => {});
  db.run('ALTER TABLE tests ADD COLUMN due_date TEXT', () => {});
  db.run('ALTER TABLE tests ADD COLUMN due_time TEXT', () => {});
  db.run('ALTER TABLE tests ADD COLUMN completed INTEGER NOT NULL DEFAULT 0', () => {});
  db.run('ALTER TABLE tests ADD COLUMN open_override INTEGER NOT NULL DEFAULT 0', () => {});
  db.run(`UPDATE tests SET start_at=COALESCE(start_at,created_at,CURRENT_TIMESTAMP),
      due_date=COALESCE(due_date,'2099-12-31'), due_time=COALESCE(due_time,'23:59'),
      completed=COALESCE(completed,0), open_override=COALESCE(open_override,0)`, () => {});
  db.run('CREATE INDEX IF NOT EXISTS idx_tests_scope ON tests(course, year_level, academic_year, active)');
  db.run(`CREATE TABLE IF NOT EXISTS test_attempt_sessions (
    id TEXT PRIMARY KEY,
    test_id TEXT NOT NULL,
    student_id TEXT NOT NULL REFERENCES users(student_id) ON UPDATE CASCADE ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL CHECK(attempt_number > 0 AND attempt_number <= 10),
    is_remediation INTEGER NOT NULL DEFAULT 0 CHECK(is_remediation IN (0,1)),
    question_snapshot_json TEXT NOT NULL DEFAULT '[]',
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','submitted','cancelled','expired')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(test_id, student_id, attempt_number)
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_test_attempt_sessions_student_status ON test_attempt_sessions(student_id,status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_test_attempt_sessions_test_status ON test_attempt_sessions(test_id,status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_test_attempt_sessions_expiry ON test_attempt_sessions(expires_at,status)');

  db.run(`CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    event_type TEXT NOT NULL CHECK(event_type IN ('event','remediation-week')),
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    course TEXT,
    year_level INTEGER CHECK(year_level BETWEEN 1 AND 6),
    academic_year INTEGER NOT NULL CHECK(academic_year BETWEEN 2000 AND 2100),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_calendar_events_dates ON calendar_events(start_at, end_at, active)');
  db.run('CREATE INDEX IF NOT EXISTS idx_calendar_events_scope ON calendar_events(course, year_level, academic_year, active)');
  db.run('CREATE INDEX IF NOT EXISTS idx_calendar_events_academic_year ON calendar_events(academic_year, active, start_at)');


  db.run(`CREATE TABLE IF NOT EXISTS marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL REFERENCES users(student_id) ON UPDATE CASCADE,
    assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE, mark REAL NOT NULL CHECK(mark >= 0 AND mark <= 100),
    weighting REAL NOT NULL DEFAULT 100,
    passing_mark REAL NOT NULL DEFAULT 60 CHECK(passing_mark >= 0 AND passing_mark <= 100),
    feedback TEXT,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Submitted','Approved','Published','Locked')),
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, assessment_id)
  )`);
  db.run('ALTER TABLE marks ADD COLUMN weighting REAL NOT NULL DEFAULT 100', () => {});
  db.run('ALTER TABLE marks ADD COLUMN passing_mark REAL NOT NULL DEFAULT 60', () => {});
  db.run('ALTER TABLE marks ADD COLUMN feedback TEXT', () => {});

  db.run(`CREATE TABLE IF NOT EXISTS mark_releases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
  
    mark_id INTEGER NOT NULL
      REFERENCES marks(id) ON DELETE CASCADE,
  
    student_id TEXT NOT NULL
      REFERENCES users(student_id) ON UPDATE CASCADE,
  
    assessment_id TEXT NOT NULL
      REFERENCES assessments(id) ON DELETE CASCADE,
  
    marked_by INTEGER
      REFERENCES users(id) ON DELETE SET NULL,
  
    approved_by INTEGER
      REFERENCES users(id) ON DELETE SET NULL,
  
    status TEXT NOT NULL DEFAULT 'Awaiting Approval'
      CHECK(status IN (
        'Awaiting Approval',
        'Returned to Marker',
        'Approved',
        'Released',
        'Archived'
      )),
  
    mark REAL NOT NULL CHECK(mark >= 0 AND mark <= 100),
  
    feedback TEXT,
  
    returned_file_name TEXT,
    returned_file_path TEXT,
  
    marked_at TEXT,
    approved_at TEXT,
    released_at TEXT,
    archived_at TEXT,
  
    student_viewed_at TEXT,
    student_downloaded_at TEXT,
  
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

db.run('CREATE INDEX IF NOT EXISTS idx_mark_releases_student ON mark_releases(student_id)');
db.run('CREATE INDEX IF NOT EXISTS idx_mark_releases_mark ON mark_releases(mark_id)');
db.run('CREATE INDEX IF NOT EXISTS idx_mark_releases_status ON mark_releases(status)');
db.run('CREATE INDEX IF NOT EXISTS idx_mark_releases_released ON mark_releases(released_at)');

db.run(`CREATE TABLE IF NOT EXISTS remediations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES users(student_id) ON UPDATE CASCADE ON DELETE CASCADE,
  assessment_id TEXT NOT NULL,
  assignment_id TEXT,
  assignment_title TEXT NOT NULL,
  subject TEXT,
  reason TEXT NOT NULL DEFAULT 'failed_mark',
  original_mark REAL CHECK(original_mark IS NULL OR (original_mark >= 0 AND original_mark <= 100)),
  passing_mark REAL NOT NULL DEFAULT 60 CHECK(passing_mark >= 0 AND passing_mark <= 100),
  remediation_date TEXT,
  remediation_time TEXT,
  venue TEXT,
  instructions TEXT,
  feedback TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  attempt_limit INTEGER NOT NULL DEFAULT 1 CHECK(attempt_limit > 0),
  remediation_mark REAL CHECK(remediation_mark IS NULL OR (remediation_mark >= 0 AND remediation_mark <= 100)),
  status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','Scheduled','Submitted','Marked','Completed','Cancelled','Resolved')),
  file_name TEXT,
  file_path TEXT,
  submitted_at TEXT,
  completed_at TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, assessment_id)
)`);
db.run('CREATE INDEX IF NOT EXISTS idx_remediations_student ON remediations(student_id)');
db.run('CREATE INDEX IF NOT EXISTS idx_remediations_status ON remediations(status)');
db.run('CREATE INDEX IF NOT EXISTS idx_remediations_date ON remediations(remediation_date)');

// Individual remediation submissions are retained as attempt history. The parent remediations
// row continues to hold the current/latest submission for backwards compatibility, while this
// table makes every attempt independently addressable for staff review and authenticated download.
db.run(`CREATE TABLE IF NOT EXISTS remediation_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  remediation_id INTEGER NOT NULL REFERENCES remediations(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK(attempt_number BETWEEN 1 AND 10),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK(status IN ('Submitted','Marked','Passed','Failed','Deleted','Locked')),
  mark REAL CHECK(mark IS NULL OR (mark >= 0 AND mark <= 100)),
  passing_mark REAL CHECK(passing_mark IS NULL OR (passing_mark >= 0 AND passing_mark <= 100)),
  feedback TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  marked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  marked_at TEXT,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(remediation_id, attempt_number)
)`);
db.run('CREATE INDEX IF NOT EXISTS idx_remediation_attempts_case ON remediation_attempts(remediation_id, attempt_number)');

// Compatibility migration for installations that already had a remediation_attempts table
// created by an earlier release. CREATE TABLE IF NOT EXISTS does not modify an existing table,
// so older databases can otherwise fail as soon as the current server inserts remediation_id.
// Missing columns are added with safe defaults/nullable values so existing records are not
// destroyed or recreated. New submissions always provide the complete current schema values.
const remediationAttemptColumns = [
  ['remediation_id', 'INTEGER'],
  ['attempt_number', 'INTEGER NOT NULL DEFAULT 1'],
  ['file_name', `TEXT NOT NULL DEFAULT ''`],
  ['file_path', `TEXT NOT NULL DEFAULT ''`],
  ['status', `TEXT NOT NULL DEFAULT 'Submitted'`],
  ['mark', 'REAL'],
  ['passing_mark', 'REAL DEFAULT 60'],
  ['feedback', `TEXT NOT NULL DEFAULT ''`],
  ['submitted_at', 'TEXT'],
  ['marked_by', 'INTEGER'],
  ['marked_at', 'TEXT'],
  ['deleted_by', 'INTEGER'],
  ['deleted_at', 'TEXT'],
  ['created_at', 'TEXT']
];
for (const [column, definition] of remediationAttemptColumns) {
  db.run(`ALTER TABLE remediation_attempts ADD COLUMN ${column} ${definition}`, () => {});
}
// Recover a linkage where an older record still has the same filename/path as its parent
// remediation. This is deliberately best-effort: no artificial remediation relationship is
// invented when the old installation did not retain enough identifying information.
db.run(`UPDATE remediation_attempts
  SET remediation_id=(
    SELECT r.id FROM remediations r
    WHERE (remediation_attempts.file_path <> '' AND r.file_path=remediation_attempts.file_path)
       OR (remediation_attempts.file_name <> '' AND r.file_name=remediation_attempts.file_name)
    ORDER BY r.id DESC LIMIT 1
  )
  WHERE remediation_id IS NULL`, () => {});
db.run('CREATE INDEX IF NOT EXISTS idx_remediation_attempts_status ON remediation_attempts(status)');

// Backfill only the latest file that can actually be proven from an old remediations row.
// We do not invent missing historical files when an old installation only stored a counter.
db.run(`INSERT OR IGNORE INTO remediation_attempts(
  remediation_id, attempt_number, file_name, file_path, status, mark, passing_mark, feedback,
  submitted_at, created_at
)
SELECT
  r.id,
  CASE WHEN r.attempts > 10 THEN 10 ELSE r.attempts END,
  r.file_name,
  r.file_path,
  CASE
    WHEN r.file_name IS NULL OR r.file_path IS NULL THEN 'Submitted'
    WHEN r.remediation_mark IS NOT NULL AND r.remediation_mark >= r.passing_mark THEN 'Passed'
    WHEN r.remediation_mark IS NOT NULL AND r.remediation_mark < r.passing_mark THEN 'Failed'
    ELSE 'Submitted'
  END,
  r.remediation_mark,
  r.passing_mark,
  COALESCE(r.feedback, ''),
  COALESCE(r.submitted_at, CURRENT_TIMESTAMP),
  COALESCE(r.created_at, CURRENT_TIMESTAMP)
FROM remediations r
WHERE r.attempts > 0
  AND r.file_name IS NOT NULL
  AND r.file_path IS NOT NULL
  AND r.attempts <= 10
`);

db.run(`CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_id TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

db.run(
  'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)'
);

db.run(`CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  last_attempt_at TEXT,
  sent_at TEXT,
  last_error TEXT,
  related_type TEXT,
  related_id TEXT,
  dedupe_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
db.run('CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON email_outbox(status,created_at)');

// Main-administrator-managed student card designs. The template is deliberately data-only
// (no HTML is stored) so the frontend can safely render a controlled print layout.
db.run(`CREATE TABLE IF NOT EXISTS student_card_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title TEXT NOT NULL DEFAULT 'Student Card',
  subtitle TEXT NOT NULL DEFAULT '',
  width_mm REAL NOT NULL DEFAULT 85.6 CHECK(width_mm >= 40 AND width_mm <= 200),
  height_mm REAL NOT NULL DEFAULT 54 CHECK(height_mm >= 40 AND height_mm <= 200),
  background TEXT NOT NULL DEFAULT '#ffffff',
  accent TEXT NOT NULL DEFAULT '#0f766e',
  text_color TEXT NOT NULL DEFAULT '#17211f',
  show_photo INTEGER NOT NULL DEFAULT 1 CHECK(show_photo IN (0,1)),
  fields_json TEXT NOT NULL DEFAULT '["name","studentId","course","yearLevel","academicYear"]',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
db.run('CREATE INDEX IF NOT EXISTS idx_student_card_templates_updated ON student_card_templates(updated_at)');
// The template the main administrator has approved for printing and for the learner's own preview.
db.run('ALTER TABLE student_card_templates ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0', () => {});

db.run(`CREATE TABLE IF NOT EXISTS student_card_profiles (
  student_id TEXT PRIMARY KEY REFERENCES users(student_id) ON UPDATE CASCADE ON DELETE CASCADE,
  photo_name TEXT,
  photo_path TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
db.run('CREATE INDEX IF NOT EXISTS idx_student_card_profiles_photo ON student_card_profiles(photo_path)');

// Marking memos (rubrics). Previously these lived only in each marker's browser localStorage, so a
// memo written on one machine was invisible to every other marker and was lost if the browser was
// cleared. criteria is a JSON array of { id, label, max, guidance }.
db.run(`CREATE TABLE IF NOT EXISTS assignment_memos (
  assignment_id INTEGER PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  criteria TEXT NOT NULL DEFAULT '[]',
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, entity TEXT, entity_id TEXT, details TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS password_resets (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0)`);
  // Installation facts such as "this database was created as a demo showcase".
  db.run(`CREATE TABLE IF NOT EXISTS install_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  db.run('CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(username COLLATE NOCASE)');
  db.run('CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_marks_assessment ON marks(assessment_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)', err => err ? reject(err) : resolve());
}));

// Demo data may only go into an empty database or one that was already created as a demo.
// Without this guard, setting SEED_DEMO=true on a real installation added a second main
// administrator with the publicly documented password and dozens of fake learners.
async function demoSeedAllowed() {
  if (await get("SELECT 1 AS ok FROM install_meta WHERE key='demo_seeded'")) return true;
  const users = await get('SELECT COUNT(*) AS count FROM users');
  if (!Number(users?.count)) return true;
  // Demo databases created before the marker existed are recognised by the full set of demo accounts.
  const legacy = await get(`SELECT COUNT(*) AS count FROM users
    WHERE (username='mainadmin' AND role='main-admin') OR (username='admin' AND role='admin')
       OR (username='tempadmin' AND role='admin') OR (username='student' AND role='student' AND student_id='STU-001')`);
  return Number(legacy?.count) === 4;
}

async function seedDemoData() {
  // A fresh clone should be able to come up completely empty, so a real school never inherits
  // fake learners or the publicly documented demo passwords. SEED_DEMO controls this:
  //   SEED_DEMO=false  -> clean install: no accounts, no marks, nothing.
  //   SEED_DEMO=true   -> opt-in demo accounts/data for a classroom showcase.
  // On a clean install the first administrator is created through the in-app initial setup screen.
  // Clean installs are the default; demo data must be explicitly enabled with SEED_DEMO=true.
  if (process.env.SEED_DEMO !== 'true') return;
  if (!(await demoSeedAllowed())) {
    console.warn('SEED_DEMO=true was ignored: this database already holds a real installation. Demo data is only added to an empty database or an existing demo database.');
    return;
  }
  // Recorded first so a seed interrupted part-way can finish on the next start.
  await run("INSERT OR IGNORE INTO install_meta(key,value) VALUES('demo_seeded',?)", [new Date().toISOString()]);
  const demoAccounts = [
    ['Jordan Lee', 'mainadmin', 'ChangeMe123!', null, 'main-admin'],
    ['Avery Morgan', 'admin', 'Admin123!', null, 'admin'],
    ['Taylor Brooks', 'tempadmin', 'TempAdmin123!', null, 'admin'],
    ['Sam Taylor', 'student', 'Student123!', 'STU-001', 'student']
  ];
  for (const [name, username, password, studentId, role] of demoAccounts) {
    const hash = bcrypt.hashSync(password, 12);
    await run('INSERT OR IGNORE INTO users(name,username,password,student_id,role) VALUES(?,?,?,?,?)', [name, username, hash, studentId, role]);
  }
  // Demo learners/tests use these catalogue entries. Keeping them as real SQLite course rows
  // means the staff test-authoring validator accepts the same course names shown in the demo
  // data, rather than allowing a seeded test to exist but be impossible to edit. Computer
  // Science and Psychology belong here too: the demo teaching groups, assignments and tests
  // all reference them, so omitting them made that seeded content fail the course check.
  const demoCourses = [
    ['Computer Science', 'Maths, English, and logical problem-solving; often a programming project.'],
    ['Biology', 'Biology, Chemistry and strong scientific reasoning.'],
    ['Business Management', 'English, basic Maths and an interest in management, finance or enterprise.'],
    ['Psychology', 'English, Life Sciences and strong written communication.'],
    ['Mechanical Engineering', 'Advanced Maths, Physics and practical problem-solving.'],
  ];
  const mainAdmin = await get(`SELECT id FROM users WHERE username='mainadmin' AND role='main-admin' LIMIT 1`);
  for (const [courseName, requirement] of demoCourses) {
    await run('INSERT OR IGNORE INTO courses(name,requirement,active,created_by) VALUES(?,?,1,?)', [courseName, requirement, mainAdmin?.id || null]);
  }

  const demoTeachingGroups = [
    ['admin', 'Computer Science', 1, new Date().getFullYear()],
    ['admin', 'Biology', 2, new Date().getFullYear()],
    ['admin', 'Business Management', 1, new Date().getFullYear()],
    ['tempadmin', 'Psychology', 1, new Date().getFullYear()],
  ];
  for (const [username, course, yearLevel, academicYear] of demoTeachingGroups) {
    const teacher = await get('SELECT id FROM users WHERE username=? AND role=\'admin\'', [username]);
    if (teacher) {
      await run(
        'INSERT OR IGNORE INTO staff_course_assignments(user_id,course,year_level,academic_year) VALUES(?,?,?,?)',
        [teacher.id, course, yearLevel, academicYear]
      );
    }
  }
  await run("UPDATE users SET course='Biology', year_level=2 WHERE username='student' AND course IS NULL");
  await run('INSERT OR IGNORE INTO assessments(id,name,max_mark) VALUES(?,?,?)', ['BIO-001', 'Biology practical assessment', 100]);
  const student = await get('SELECT student_id FROM users WHERE username=?', ['student']);
  if (student?.student_id) {
    await run(`INSERT OR IGNORE INTO marks(student_id,assessment_id,mark,status) VALUES(?,?,?,'Published')`, [student.student_id, 'BIO-001', 92]);
  }
  await seedBulkDemoStudents();
  await seedDemoWorkspace();
}

// Resolves once optional demo seeding has finished (immediately on a clean install). The server
// waits for it before listening, so nobody sees a half-seeded portal or a setup screen meant
// for an empty database. A seeding failure is logged and never stops the portal from starting.
const seeded = ready.then(seedDemoData).catch((error) => {
  console.error('Demo data could not be seeded:', error.message);
});

// Every database gets a permanent random identity. Browsers cache portal data (and queued marks)
// in localStorage, so the frontend compares this id and clears its cache when the API it talks
// to is switched to a different installation (for example from the demo to a clean install).
async function installationInfo() {
  await ready;
  await run("INSERT OR IGNORE INTO install_meta(key,value) VALUES('install_id',?)", [crypto.randomUUID()]);
  const id = await get("SELECT value FROM install_meta WHERE key='install_id'");
  const demo = await get("SELECT 1 AS ok FROM install_meta WHERE key='demo_seeded'");
  return { installId: id?.value || null, demo: Boolean(demo) };
}


// Optional demo workspace records. Clean installations never create these rows.
async function seedDemoWorkspace() {
  const year = new Date().getFullYear();
  // Dates are relative to the install day so a fresh demo always has open work to submit and mark.
  const localDay = (offsetDays) => {
    const day = new Date();
    day.setDate(day.getDate() + offsetDays);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  };
  const main = await get(`SELECT id FROM users WHERE username='mainadmin' LIMIT 1`);
  const teacher = await get(`SELECT id FROM users WHERE username='admin' LIMIT 1`);
  if (!main && !teacher) return;
  const ownerId = teacher?.id || main?.id || null;
  const assignmentsDir = path.join(DATA_ROOT, 'assignments');
  fs.mkdirSync(assignmentsDir, { recursive: true });
  const demoFiles = [
    { title:'Programming project', subject:'Computer Science', course:'Computer Science', yearLevel:1, startAt:`${localDay(-3)}T09:00`, dueDate:localDay(14), duration:120, fileName:'project-brief.txt',
      body:`Meridian Learning Hub demo assignment\n\nProgramming Project\nBuild a small application that demonstrates input handling, validation and clear documentation.\n\nSubmit your completed project as one ZIP file through the student portal.` },
    { title:'Science lab report', subject:'Biology', course:'Biology', yearLevel:2, startAt:`${localDay(-1)}T10:00`, dueDate:localDay(21), duration:90, fileName:'lab-template.txt',
      body:`Meridian Learning Hub demo assignment\n\nScience Lab Report\nRecord the aim, hypothesis, method, results with units and conclusion.\n\nUse the template headings in this file when preparing your report.` }
  ];
  const assignmentCount = await get(`SELECT COUNT(*) AS count FROM assignments`);
  if (!assignmentCount?.count) {
    for (const item of demoFiles) {
      const absolute=path.join(assignmentsDir,item.fileName);
      if (!fs.existsSync(absolute)) fs.writeFileSync(absolute,item.body,'utf8');
      await run(`INSERT INTO assignments(title,subject,course,year_level,academic_year,term,start_at,due_date,due_time,duration,file_name,file_path,owner_id)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,[item.title,item.subject,item.course,item.yearLevel,year,'Term 3',item.startAt,item.dueDate,'23:59',item.duration,item.fileName,`assignments/${item.fileName}`,ownerId]);
    }
  } else {
    for (const item of demoFiles) {
      const row=await get(`SELECT id,file_path FROM assignments WHERE title=? AND academic_year=? LIMIT 1`,[item.title,year]);
      if (row) {
        const absolute=path.join(assignmentsDir,item.fileName);
        if (!fs.existsSync(absolute)) fs.writeFileSync(absolute,item.body,'utf8');
        const rel=`assignments/${item.fileName}`;
        if (!row.file_path || !fs.existsSync(path.resolve(DATA_ROOT,rel))) {
          await run(`UPDATE assignments SET file_name=?,file_path=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[item.fileName,rel,row.id]);
        }
      }
    }
  }
  const demoStudent=await get(`SELECT student_id FROM users WHERE username='student' AND role='student' LIMIT 1`);
  if (demoStudent && teacher?.id) {
    await run(`INSERT INTO student_teacher_assignments(student_id,teacher_user_id,academic_year,active)
      VALUES(?,?,?,1)
      ON CONFLICT(student_id,academic_year) DO UPDATE SET teacher_user_id=excluded.teacher_user_id,active=1,updated_at=CURRENT_TIMESTAMP`,
      [demoStudent.student_id,teacher.id,year]);
  }

  const testCount = await get(`SELECT COUNT(*) AS count FROM tests`);
  if (!testCount?.count) {
    const tests = [
      ['Intro to Algorithms quiz','Computer Science','Computer Science',1,60,20,2,[
        {question:'Which data structure uses FIFO order?',options:['Stack','Queue','Tree','Graph'],correct:1,type:'mcq',points:1},
        {question:'What is the time complexity of binary search?',options:['O(n)','O(n^2)','O(log n)','O(1)'],correct:2,type:'mcq',points:1},
        {question:'Which keyword declares a constant in JavaScript?',options:['var','let','const','static'],correct:2,type:'mcq'},
        {question:'What does CPU stand for?',options:['Central Process Unit','Central Processing Unit','Computer Personal Unit','Central Processor Utility'],correct:1,type:'mcq'}
      ]],
      ['Cell Biology exam','Biology','Biology',2,60,30,2,[
        {question:'What is the powerhouse of the cell?',options:['Nucleus','Ribosome','Mitochondria','Golgi apparatus'],correct:2,type:'mcq'},
        {question:'DNA replication occurs in which phase?',options:['G1','S','G2','M'],correct:1,type:'mcq'},
        {question:'What is the basic unit of life?',options:['Cell','Atom','Tissue','Organ'],correct:0,type:'mcq'}
      ]],
      ['Business fundamentals test','Business Management','Business Management',1,60,25,2,[
        {question:'What does ROI stand for?',options:['Rate of Interest','Return on Investment','Risk of Insolvency','Return on Income'],correct:1,type:'mcq'},
        {question:"A balance sheet reports a company's...",options:['Revenue only','Assets, liabilities, and equity','Cash flow only','Marketing plan'],correct:1,type:'mcq'},
        {question:'What is a fixed cost?',options:['Cost that changes with output','Cost that stays the same regardless of output','A one-time cost','Employee salaries only'],correct:1,type:'mcq'}
      ]]
    ];
    // Supplying the window explicitly matters: without it SQLite falls back to the column
    // defaults, so start_at becomes CURRENT_TIMESTAMP (UTC, space-separated) and due_date
    // becomes 2099-12-31 — a test that appears to open at the wrong hour and never close.
    const pad = (value) => String(value).padStart(2, '0');
    const localWallClock = (date) =>
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    const seedStart = new Date();
    seedStart.setHours(8, 0, 0, 0);
    const seedDue = new Date(seedStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    for (const [title,subject,course,yearLevel,passingMark,duration,maxAttempts,questions] of tests) {
      await run(`INSERT INTO tests(title,subject,course,year_level,academic_year,start_at,due_date,due_time,passing_mark,duration_minutes,max_attempts,questions_json,created_by)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [title,subject,course,yearLevel,year,
          localWallClock(seedStart), localWallClock(seedDue).slice(0, 10), '23:59',
          passingMark,duration,maxAttempts,JSON.stringify(questions),ownerId]);
    }
  }

  const calendarCount = await get(`SELECT COUNT(*) AS count FROM calendar_events`);
  if (!calendarCount?.count) {
    await run(`INSERT INTO calendar_events(title,description,event_type,start_at,end_at,course,year_level,academic_year,created_by)
      VALUES(?,?,?,?,?,?,?,?,?)`, [
      'Remediation Week','Scheduled remediation and academic support period.','remediation-week',
      `${year}-10-05T08:00`,`${year}-10-09T16:00`,null,null,year,ownerId
    ]);
  }
}

// Adds a larger batch of demo students (with a mix of courses/years) plus sample marks in
// every workflow status, so the portal can be exercised with many learners at once instead
// of the single seeded demo student. Safe to re-run: every insert is OR IGNORE / keyed so it
// never duplicates rows on repeated server starts.
async function seedBulkDemoStudents() {
  const marker = await get("SELECT student_id FROM users WHERE student_id='STU-050'");
  if (marker) return; // already seeded in a previous run
  const firstNames = ['Alex', 'Bailey', 'Casey', 'Drew', 'Ellis', 'Frankie', 'Gray', 'Harper', 'Indigo', 'Jules', 'Kai', 'Lane', 'Milo', 'Nico', 'Ocean', 'Parker', 'Quinn', 'Riley', 'Sage', 'Toni'];
  const lastNames = ['Anderson', 'Bennett', 'Clark', 'Diaz', 'Evans', 'Foster', 'Gibson', 'Hayes', 'Irwin', 'Jenkins'];
  const courseList = ['Computer Science', 'Business Management', 'Biology', 'Psychology', 'Mechanical Engineering'];
  const assessmentIds = ['ASSESS-101', 'ASSESS-102', 'ASSESS-103'];
  for (const id of assessmentIds) await run('INSERT OR IGNORE INTO assessments(id,name,max_mark) VALUES(?,?,?)', [id, `${id} demo assessment`, 100]);
  const statuses = ['Draft', 'Submitted', 'Approved', 'Published', 'Published', 'Locked'];
  // One hash for every demo learner: hashing at cost 12 inside the loop took ~18 seconds.
  const hash = bcrypt.hashSync('Student123!', 12);
  await transaction(async () => {
    for (let i = 2; i <= 50; i++) {
      const studentId = `STU-${String(i).padStart(3, '0')}`;
      const name = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
      const username = `student${i}`;
      const course = courseList[i % courseList.length];
      const yearLevel = (i % 4) + 1;
      await run('INSERT OR IGNORE INTO users(name,username,password,student_id,role,course,year_level) VALUES(?,?,?,?,?,?,?)', [name, username, hash, studentId, 'student', course, yearLevel]);
      for (const assessmentId of assessmentIds) {
        const status = statuses[(i + assessmentId.length) % statuses.length];
        const mark = 40 + ((i * 7 + assessmentId.length * 3) % 61);
        await run(`INSERT OR IGNORE INTO marks(student_id,assessment_id,mark,status) VALUES(?,?,?,?)`, [studentId, assessmentId, mark, status]);
      }
    }
  });
}


function run(sql, params = []) { return ready.then(() => new Promise((resolve, reject) => db.run(sql, params, function (e) { e ? reject(e) : resolve({ lastID: this.lastID, changes: this.changes }); }))); }
function get(sql, params = []) { return ready.then(() => new Promise((resolve, reject) => db.get(sql, params, (e, row) => e ? reject(e) : resolve(row || null)))); }
function all(sql, params = []) { return ready.then(() => new Promise((resolve, reject) => db.all(sql, params, (e, rows) => e ? reject(e) : resolve(rows)))); }
let transactionTail = Promise.resolve();
async function transaction(work) {
  // sqlite3 uses one connection here. Without an application-level queue, two overlapping HTTP
  // requests could both reach BEGIN IMMEDIATE before either transaction committed, producing
  // intermittent `cannot start a transaction within a transaction` errors and partial workflows.
  const previous = transactionTail;
  let release;
  transactionTail = new Promise((resolve) => { release = resolve; });
  await previous;
  try {
    await ready;
    await run('BEGIN IMMEDIATE');
    try {
      const result = await work();
      await run('COMMIT');
      return result;
    } catch (e) {
      try { await run('ROLLBACK'); } catch (_) { /* preserve original error */ }
      throw e;
    }
  } finally {
    release();
  }
}

async function createAdmin({
  name,
  username,
  password,
  role = 'admin',
  temporary = false,
  trustedEmail = null
}) {
  if (!name?.trim()) {
    throw new Error('Administrator name is required.');
  }

  if (!username?.trim()) {
    throw new Error('Administrator username is required.');
  }

  if (!password) {
    throw new Error('Administrator password is required.');
  }

  if (!['admin', 'main-admin'].includes(role)) {
    throw new Error('Invalid administrator role.');
  }

  if (role === 'main-admin') {
    const existingMainAdmin = await get(
      "SELECT id FROM users WHERE role='main-admin' LIMIT 1"
    );
    if (existingMainAdmin) {
      throw new Error('A main administrator already exists. Only one main administrator is allowed.');
    }
  }

  const existing = await get(
    'SELECT id FROM users WHERE LOWER(username) = LOWER(?)',
    [username.trim()]
  );

  if (existing) {
    throw new Error('That username already exists.');
  }

  const hash = await bcrypt.hash(password, 12);

  const result = await run(
    `INSERT INTO users
      (name, username, password, student_id, role, temporary, trusted_email)
     VALUES (?, ?, ?, NULL, ?, ?, ?)`,
    [
      name.trim(),
      username.trim().toLowerCase(),
      hash,
      role,
      temporary ? 1 : 0,
      trustedEmail ? trustedEmail.trim().toLowerCase() : null
    ]
  );

  return {
    id: result.lastID,
    name: name.trim(),
    username: username.trim().toLowerCase(),
    role,
    temporary: Boolean(temporary),
    trustedEmail: trustedEmail ? trustedEmail.trim().toLowerCase() : null
  };
}

async function deleteUser(username) {
  const account = await get(
    'SELECT id, username, role FROM users WHERE LOWER(username) = LOWER(?)',
    [username]
  );

  if (!account) {
    throw new Error('Account not found.');
  }

  if (account.role === 'main-admin') {
    throw new Error('The main administrator cannot be deleted.');
  }

  await transaction(async () => {
    await run(
      'DELETE FROM password_resets WHERE user_id = ?',
      [account.id]
    );

    await run(
      'DELETE FROM sessions WHERE user_id = ?',
      [account.id]
    );

    await run(
      'DELETE FROM users WHERE id = ?',
      [account.id]
    );
  });

  return { success: true };
}

function audit(actorId, action, entity, entityId, details) {
  return run('INSERT INTO audit_logs(actor_id,action,entity,entity_id,details) VALUES(?,?,?,?,?)',
    [actorId || null, action, entity || null, entityId == null ? null : String(entityId), details ? JSON.stringify(details) : null]);
}

function normalizeCourseName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function courseSlug(value) {
  return normalizeCourseName(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'course';
}

async function listCourses() {
  const rows = await all(`
    SELECT
      id,
      name,
      requirement,
      active,
      created_by AS createdBy,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM courses
    WHERE active=1
    ORDER BY name COLLATE NOCASE
  `);

  const examples = USE_COURSE_EXAMPLES
    ? COURSE_EXAMPLES.map((course) => ({
        id: `example-${courseSlug(course.name)}`,
        name: course.name,
        requirement: course.requirement,
        active: true,
        isDefault: true,
      }))
    : [];

  const custom = rows.map((course) => ({ ...course, isDefault: false }));
  return [...examples, ...custom].sort((a, b) => a.name.localeCompare(b.name));
}

async function findCourse(name) {
  const normalized = normalizeCourseName(name);
  if (!normalized) return null;

  if (USE_COURSE_EXAMPLES) {
    const example = COURSE_EXAMPLES.find((course) => course.name.toLowerCase() === normalized.toLowerCase());
    if (example) {
      return {
        id: `example-${courseSlug(example.name)}`,
        name: example.name,
        requirement: example.requirement,
        active: true,
        isDefault: true,
      };
    }
  }

  const row = await get(`
    SELECT
      id,
      name,
      requirement,
      active,
      created_by AS createdBy,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM courses
    WHERE LOWER(name)=LOWER(?) AND active=1
  `, [normalized]);

  return row ? { ...row, isDefault: false } : null;
}

async function createCourse({ name, requirement = '', createdBy = null }) {
  const normalizedName = normalizeCourseName(name);
  const normalizedRequirement = String(requirement || '').trim().replace(/\s+/g, ' ');
  if (!normalizedName) throw new Error('Course name is required.');
  if (!normalizedRequirement) throw new Error('Course entry requirements are required.');

  const existing = await get(
    'SELECT id, name, requirement, active, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt FROM courses WHERE LOWER(name)=LOWER(?)',
    [normalizedName]
  );
  if (existing?.active) throw new Error('That course already exists in the catalogue.');

  if (existing) {
    await run(`
      UPDATE courses
      SET requirement=?, active=1, created_by=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `, [normalizedRequirement, createdBy || null, existing.id]);
    const reactivated = await get(
      'SELECT id, name, requirement, active, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt FROM courses WHERE id=?',
      [existing.id]
    );
    return { ...reactivated, isDefault: false };
  }

  const result = await run(`
    INSERT INTO courses(name, requirement, active, created_by)
    VALUES(?,?,1,?)
  `, [normalizedName, normalizedRequirement, createdBy || null]);

  return {
    id: result.lastID,
    name: normalizedName,
    requirement: normalizedRequirement,
    active: true,
    isDefault: false,
    createdBy: createdBy || null,
    createdAt: new Date().toISOString(),
  };
}

async function deleteCourse(courseId) {
  const numericId = Number.parseInt(courseId, 10);
  if (!Number.isInteger(numericId) || numericId <= 0) throw new Error('Invalid course ID.');

  const course = await get('SELECT id, name, requirement, active, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt FROM courses WHERE id=? AND active=1', [numericId]);
  if (!course) return null;

  const [studentUse, groupUse] = await Promise.all([
    get("SELECT COUNT(*) AS count FROM users WHERE role='student' AND LOWER(course)=LOWER(?)", [course.name]),
    get("SELECT COUNT(*) AS count FROM staff_course_assignments WHERE LOWER(course)=LOWER(?) AND active=1", [course.name]),
  ]);

  if (Number(studentUse?.count || 0) > 0 || Number(groupUse?.count || 0) > 0) {
    throw new Error('This course cannot be removed while students or teaching groups are using it.');
  }

  await run('UPDATE courses SET active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?', [numericId]);
  return { ...course, active: false, isDefault: false };
}
async function createStudent({
  name,
  username,
  password,
  studentId,
  course,
  yearLevel,
  trustedEmail = null
}) {
  if (!name?.trim()) {
    throw new Error("Student name is required.");
  }

  if (!username?.trim()) {
    throw new Error("Student username is required.");
  }

  if (!password) {
    throw new Error("Student password is required.");
  }

  if (!studentId?.trim()) {
    throw new Error("Student ID is required.");
  }

  const normalizedUsername = username.trim().toLowerCase();
  const normalizedStudentId = studentId.trim();
  const normalizedCourse = course ? normalizeCourseName(course) : null;
  const parsedYearLevel = yearLevel == null || yearLevel === '' ? null : Number(yearLevel);

  if (normalizedCourse && !(await findCourse(normalizedCourse))) {
    throw new Error('The selected course does not exist in the course catalogue.');
  }
  if (parsedYearLevel !== null && (!Number.isInteger(parsedYearLevel) || parsedYearLevel < 1 || parsedYearLevel > 6)) {
    throw new Error('Year of study must be between 1 and 6.');
  }

  const existingUsername = await get(
    "SELECT id FROM users WHERE LOWER(username) = LOWER(?)",
    [normalizedUsername]
  );

  if (existingUsername) {
    throw new Error("That username already exists.");
  }

  const existingStudentId = await get(
    "SELECT id FROM users WHERE LOWER(student_id) = LOWER(?)",
    [normalizedStudentId]
  );

  if (existingStudentId) {
    throw new Error("That student ID is already registered.");
  }

  const hash = await bcrypt.hash(password, 12);

  const result = await run(
    `INSERT INTO users
      (name, username, password, student_id, role, course, year_level, trusted_email)
     VALUES (?, ?, ?, ?, 'student', ?, ?, ?)`,
    [
      name.trim(),
      normalizedUsername,
      hash,
      normalizedStudentId,
      normalizedCourse,
      parsedYearLevel,
      trustedEmail ? trustedEmail.trim().toLowerCase() : null
    ]
  );

  return {
    id: result.lastID,
    name: name.trim(),
    username: normalizedUsername,
    studentId: normalizedStudentId,
    role: "student",
    course: normalizedCourse,
    yearLevel: parsedYearLevel,
    trustedEmail: trustedEmail ? trustedEmail.trim().toLowerCase() : null
  };
}
async function findUser(username, password) {
  const user = await get('SELECT * FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1', [String(username || '').trim()]);
  if (!user || (user.locked_until && new Date(user.locked_until) > new Date())) return null;
  if (!(await bcrypt.compare(password, user.password))) {
    const failures = (user.failed_attempts || 0) + 1;
    await run('UPDATE users SET failed_attempts=?, locked_until=? WHERE id=?',
      [failures, failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null, user.id]);
    return null;
  }
  await run('UPDATE users SET failed_attempts=0, locked_until=NULL WHERE id=?', [user.id]);
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    studentId: user.student_id,
    role: user.role,
    temporary: Boolean(user.temporary),
    course: user.course || null,
    yearLevel: user.year_level || null,
    trustedEmail: user.trusted_email || null
  };
}
async function deleteMark(markId) {
  const mark = await get('SELECT * FROM marks WHERE id=?', [markId]);
  if (!mark) return null;

  await transaction(async () => {
    // Remediation rows are intentionally not a foreign key to marks, because a remediation can
    // survive certain workflow transitions. When the underlying mark is explicitly deleted,
    // however, its remediation and release history should disappear with it.
    await run(
      'DELETE FROM remediations WHERE student_id=? AND assessment_id=?',
      [mark.student_id, mark.assessment_id]
    );

    // Assignment submissions mirror the final mark for the learner-facing assignment view.
    // Clear that mirror when the canonical mark is deleted so a deleted result cannot reappear
    // from assignment_submissions on a later refresh.
    const assessmentId = String(mark.assessment_id || '');
    if (/^ASSIGN-\d+$/.test(assessmentId)) {
      await run(
        'UPDATE assignment_submissions SET mark=NULL, mark_published_at=NULL WHERE assignment_id=? AND student_id=?',
        [Number(assessmentId.slice(7)), mark.student_id]
      );
    }

    // mark_releases has ON DELETE CASCADE on mark_id, so deleting the mark also removes its
    // historical release rows automatically.
    await run('DELETE FROM marks WHERE id=?', [markId]);
  });

  return mark;
}

async function getStaffTeachingGroups(userId, academicYear = new Date().getFullYear()) {
  return all(`
    SELECT
      sc.id,
      sc.user_id AS userId,
      u.name AS staffName,
      u.username AS staffUsername,
      sc.course,
      sc.year_level AS yearLevel,
      sc.academic_year AS academicYear,
      sc.active
    FROM staff_course_assignments sc
    JOIN users u ON u.id=sc.user_id
    WHERE sc.user_id=? AND sc.active=1 AND sc.academic_year=?
    ORDER BY sc.course, sc.year_level
  `, [userId, academicYear]);
}

async function getAllStaffTeachingGroups(academicYear = new Date().getFullYear()) {
  return all(`
    SELECT
      sc.id,
      sc.user_id AS userId,
      u.name AS staffName,
      u.username AS staffUsername,
      sc.course,
      sc.year_level AS yearLevel,
      sc.academic_year AS academicYear,
      sc.active
    FROM staff_course_assignments sc
    JOIN users u ON u.id=sc.user_id
    WHERE sc.active=1 AND sc.academic_year=? AND u.role='admin'
    ORDER BY u.name, sc.course, sc.year_level
  `, [academicYear]);
}

async function getCourseYearGroups({ userId = null, academicYear = new Date().getFullYear() } = {}) {
  if (userId == null) {
    return all(`
      SELECT course, year_level AS yearLevel, COUNT(*) AS studentCount
      FROM users
      WHERE role='student' AND course IS NOT NULL AND year_level IS NOT NULL
      GROUP BY course, year_level
      ORDER BY course, year_level
    `);
  }
  return all(`
    SELECT u.course, u.year_level AS yearLevel, COUNT(*) AS studentCount
    FROM users u
    JOIN staff_course_assignments sc
      ON sc.course=u.course
     AND sc.year_level=u.year_level
     AND sc.academic_year=?
     AND sc.active=1
     AND sc.user_id=?
    WHERE u.role='student' AND u.course IS NOT NULL AND u.year_level IS NOT NULL
    GROUP BY u.course, u.year_level
    ORDER BY u.course, u.year_level
  `, [academicYear, userId]);
}

module.exports = {
  db,
  ready,
  seeded,
  installationInfo,
  DATA_ROOT,
  DB_PATH,
  run,
  get,
  all,
  transaction,
  audit,
  createStudent,
  createAdmin,
  deleteUser,
  deleteMark,
  findUser,
  getStaffTeachingGroups,
  getAllStaffTeachingGroups,
  getCourseYearGroups,
  listCourses,
  findCourse,
  createCourse,
  deleteCourse,
  bcrypt
};


