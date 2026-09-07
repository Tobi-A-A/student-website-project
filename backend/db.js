const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DATA_ROOT = path.resolve(__dirname, 'school_data');
fs.mkdirSync(DATA_ROOT, { recursive: true });
const db = new sqlite3.Database(process.env.DB_PATH || path.join(DATA_ROOT, 'portal.sqlite'));
db.configure('busyTimeout', 5000);

const ready = new Promise((resolve, reject) => db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL, student_id TEXT UNIQUE, role TEXT NOT NULL CHECK(role IN ('main-admin','admin','student')),
    failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until TEXT, two_factor_secret TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  // Upgrade databases created by the original demo without destroying accounts.
  db.run('ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0', () => {});
  db.run('ALTER TABLE users ADD COLUMN locked_until TEXT', () => {});
  db.run('ALTER TABLE users ADD COLUMN two_factor_secret TEXT', () => {});
  db.run('ALTER TABLE users ADD COLUMN course TEXT', () => {});
  db.run('ALTER TABLE users ADD COLUMN year_level INTEGER', () => {});
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS uq_users_student_id ON users(student_id)');
  db.run(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS assessments (id TEXT PRIMARY KEY, name TEXT NOT NULL, max_mark REAL NOT NULL DEFAULT 100 CHECK(max_mark > 0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL REFERENCES users(student_id) ON UPDATE CASCADE,
    assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE, mark REAL NOT NULL CHECK(mark >= 0),
    status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Submitted','Approved','Published','Locked')),
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, assessment_id)
  )`);
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
  try { const result = await work(); await run('COMMIT'); return result; } catch (e) { try { await run('ROLLBACK'); } catch (_) {} throw e; }
}
function audit(actorId, action, entity, entityId, details) {
  return run('INSERT INTO audit_logs(actor_id,action,entity,entity_id,details) VALUES(?,?,?,?,?)',
    [actorId || null, action, entity || null, entityId == null ? null : String(entityId), details ? JSON.stringify(details) : null]);
}
async function createStudent({ name, username, password, studentId, course, yearLevel }) {
  const hash = await bcrypt.hash(password, 12);
  const result = await run('INSERT INTO users(name,username,password,student_id,role,course,year_level) VALUES(?,?,?,?,?,?,?)', [name, username, hash, studentId, 'student', course || null, yearLevel || null]);
  return { id: result.lastID, name, username, studentId, role: 'student', course: course || null, yearLevel: yearLevel || null };
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
  return { id: user.id, name: user.name, username: user.username, studentId: user.student_id, role: user.role, course: user.course || null, yearLevel: user.year_level || null };
}
module.exports = { db, ready, run, get, all, transaction, audit, createStudent, findUser, bcrypt };
