const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// Built-in course examples are showcase content, not tenant data. They are served from the
// backend only when SEED_COURSE_EXAMPLES is not explicitly set to false. Newly created courses
// are stored permanently in SQLite.
const COURSE_EXAMPLES = [
  { name: 'Computer Science', requirement: 'Maths, English, and logical problem-solving; often a programming project.' },
  { name: 'Business Administration', requirement: 'English, basic Maths, and an interest in finance, management, or enterprise.' },
  { name: 'Psychology', requirement: 'English, Biology or Social Science, plus strong research and essay skills.' },
  { name: 'Nursing', requirement: 'Biology or Health Science, Maths, English, DBS/background checks, and an interview.' },
  { name: 'Engineering', requirement: 'Advanced Maths and Physics/Chemistry, with practical problem-solving skills.' },
];
const USE_COURSE_EXAMPLES = process.env.SEED_COURSE_EXAMPLES !== 'false';

const DATA_ROOT = path.resolve(__dirname, 'school_data');
fs.mkdirSync(DATA_ROOT, { recursive: true });
const db = new sqlite3.Database(process.env.DB_PATH || path.join(DATA_ROOT, 'portal.sqlite'));
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
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  // Upgrade databases created by the original demo without destroying accounts.
  db.run('ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0', () => { });
  db.run('ALTER TABLE users ADD COLUMN temporary INTEGER NOT NULL DEFAULT 0', () => {});
  db.run('ALTER TABLE users ADD COLUMN locked_until TEXT', () => { });
  db.run('ALTER TABLE users ADD COLUMN two_factor_secret TEXT', () => { });
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
    academic_year INTEGER NOT NULL DEFAULT 2026 CHECK(academic_year BETWEEN 2000 AND 2100),
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
    academic_year INTEGER NOT NULL DEFAULT 2026 CHECK(academic_year BETWEEN 2000 AND 2100),
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

  // Central test/exam attempt history. Test definitions remain in the existing portal UI, but
  // each submitted learner attempt is persisted here so administrators can report on results
  // across accounts and browser sessions without relying on one device's localStorage.
  db.run(`CREATE TABLE IF NOT EXISTS test_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id TEXT NOT NULL,
    student_id TEXT NOT NULL REFERENCES users(student_id) ON UPDATE CASCADE ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL CHECK(attempt_number > 0 AND attempt_number <= 10),
    score REAL NOT NULL CHECK(score >= 0 AND score <= 100),
    correct INTEGER NOT NULL DEFAULT 0 CHECK(correct >= 0),
    total INTEGER NOT NULL DEFAULT 0 CHECK(total >= 0),
    needs_review INTEGER NOT NULL DEFAULT 0 CHECK(needs_review IN (0,1)),
    passed INTEGER,
    essay_answers TEXT,
    is_remediation INTEGER NOT NULL DEFAULT 0 CHECK(is_remediation IN (0,1)),
    taken_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(test_id, student_id, attempt_number)
  )`);
  db.run('ALTER TABLE test_attempts ADD COLUMN is_remediation INTEGER NOT NULL DEFAULT 0', () => {});
  db.run('CREATE INDEX IF NOT EXISTS idx_test_attempts_student ON test_attempts(student_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_test_attempts_test ON test_attempts(test_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_test_attempts_taken ON test_attempts(taken_at)');

  db.run(`CREATE TABLE IF NOT EXISTS marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL REFERENCES users(student_id) ON UPDATE CASCADE,
    assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE, mark REAL NOT NULL CHECK(mark >= 0),
    passing_mark REAL NOT NULL DEFAULT 60 CHECK(passing_mark >= 0 AND passing_mark <= 100),
    feedback TEXT,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Submitted','Approved','Published','Locked')),
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, assessment_id)
  )`);
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

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, entity TEXT, entity_id TEXT, details TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS password_resets (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0)`);
  db.run('CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_marks_assessment ON marks(assessment_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)', err => err ? reject(err) : resolve());
}));

ready.then(async () => {
  // A fresh clone should be able to come up completely empty, so a real school never inherits
  // fake learners or the publicly documented demo passwords. SEED_DEMO controls this:
  //   SEED_DEMO=false  -> clean install: no accounts, no marks, nothing.
  //   SEED_DEMO=true   -> opt-in demo accounts/data for a classroom showcase.
  // On a clean install the first administrator is created through the in-app initial setup screen.
  // Clean installs are the default; demo data must be explicitly enabled with SEED_DEMO=true.
  if (process.env.SEED_DEMO === 'false') return;
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
  const demoTeachingGroups = [
    ['admin', 'Computer Science', 1, 2026],
    ['admin', 'Biology', 2, 2026],
    ['tempadmin', 'Psychology', 1, 2026],
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
});

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
  for (let i = 2; i <= 50; i++) {
    const studentId = `STU-${String(i).padStart(3, '0')}`;
    const name = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
    const username = `student${i}`;
    const course = courseList[i % courseList.length];
    const yearLevel = (i % 4) + 1;
    const hash = bcrypt.hashSync('Student123!', 12);
    await run('INSERT OR IGNORE INTO users(name,username,password,student_id,role,course,year_level) VALUES(?,?,?,?,?,?,?)', [name, username, hash, studentId, 'student', course, yearLevel]);
    for (const assessmentId of assessmentIds) {
      const status = statuses[(i + assessmentId.length) % statuses.length];
      const mark = 40 + ((i * 7 + assessmentId.length * 3) % 61);
      await run(`INSERT OR IGNORE INTO marks(student_id,assessment_id,mark,status) VALUES(?,?,?,?)`, [studentId, assessmentId, mark, status]);
    }
  }
}


function run(sql, params = []) { return ready.then(() => new Promise((resolve, reject) => db.run(sql, params, function (e) { e ? reject(e) : resolve({ lastID: this.lastID, changes: this.changes }); }))); }
function get(sql, params = []) { return ready.then(() => new Promise((resolve, reject) => db.get(sql, params, (e, row) => e ? reject(e) : resolve(row || null)))); }
function all(sql, params = []) { return ready.then(() => new Promise((resolve, reject) => db.all(sql, params, (e, rows) => e ? reject(e) : resolve(rows)))); }
async function transaction(work) {
  await ready; await run('BEGIN IMMEDIATE');
  try { const result = await work(); await run('COMMIT'); return result; } catch (e) { try { await run('ROLLBACK'); } catch (_) { } throw e; }
}

async function createAdmin({
  name,
  username,
  password,
  role = 'admin',
  temporary = false
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
      (name, username, password, student_id, role, temporary)
     VALUES (?, ?, ?, NULL, ?, ?)`,
    [
      name.trim(),
      username.trim().toLowerCase(),
      hash,
      role,
      temporary ? 1 : 0
    ]
  );

  return {
    id: result.lastID,
    name: name.trim(),
    username: username.trim().toLowerCase(),
    role,
    temporary: Boolean(temporary)
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
  yearLevel
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
      (name, username, password, student_id, role, course, year_level)
     VALUES (?, ?, ?, ?, 'student', ?, ?)`,
    [
      name.trim(),
      normalizedUsername,
      hash,
      normalizedStudentId,
      normalizedCourse,
      parsedYearLevel
    ]
  );

  return {
    id: result.lastID,
    name: name.trim(),
    username: normalizedUsername,
    studentId: normalizedStudentId,
    role: "student",
    course: normalizedCourse,
    yearLevel: parsedYearLevel
  };
}
async function findUser(username, password) {
  const user = await get('SELECT * FROM users WHERE username = ?', [username]);
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
    yearLevel: user.year_level || null
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
