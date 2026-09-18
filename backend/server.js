const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const {
  createStudent,
  createAdmin,
  deleteUser,
  findUser,
  run,
  get,
  all,
  transaction,
  audit,
  bcrypt
} = require('./db');
const speakeasy = require('speakeasy');

const app = express();
const allowedOrigins = new Set(['http://localhost:3000', 'http://127.0.0.1:3000']);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error("Only the local frontend is allowed to connect.")
    );
  },
  credentials: true
}));
app.use(express.json());
const PORT = process.env.PORT || 5000;
const STORAGE_ROOT = path.resolve(__dirname, 'school_data');
const sessions = new Map();
const attempts = new Map();
const safeSegment = v => String(v || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { const d = path.join(STORAGE_ROOT, safeSegment(req.body.schoolId), 'uploads'); fs.mkdirSync(d, { recursive: true }); cb(null, d); },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${path.basename(file.originalname)}`)
  }), limits: { fileSize: 25 * 1024 * 1024 }
});

app.post('/admin/accounts/admin', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      username,
      password,
      temporary = false,
      role = 'admin'
    } = req.body || {};

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Administrator name is required.' });
    }

    if (typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Administrator username is required.' });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        error: 'Administrator password must be at least 8 characters.'
      });
    }

    // Only the main administrator may create another main administrator.
    if (role === 'main-admin' && req.user.role !== 'main-admin') {
      return res.status(403).json({
        error: 'Only the main administrator can create a main administrator.'
      });
    }

    const accountRole = role === 'main-admin' ? 'main-admin' : 'admin';

    const usernameValue = username.trim().toLowerCase();

    const existing = await get(
      'SELECT id FROM users WHERE LOWER(username)=LOWER(?)',
      [usernameValue]
    );

    if (existing) {
      return res.status(409).json({
        error: 'That username already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await run(
      `INSERT INTO users
       (name, username, password, student_id, role, temporary)
       VALUES (?, ?, ?, NULL, ?, ?)`,
      [
        name.trim(),
        usernameValue,
        passwordHash,
        accountRole,
        accountRole === 'main-admin' ? 0 : (temporary ? 1 : 0)
      ]
    );

    await audit(
      req.user.id,
      'admin_created',
      'user',
      result.lastID,
      {
        username: usernameValue,
        role: accountRole,
        temporary: accountRole === 'main-admin'
          ? false
          : Boolean(temporary)
      }
    );

    const created = await get(
      `SELECT
        id,
        name,
        username,
        student_id AS studentId,
        role,
        temporary,
        course,
        year_level AS yearLevel,
        created_at AS createdAt
       FROM users
       WHERE id=?`,
      [result.lastID]
    );

    created.temporary = Boolean(created.temporary);

    return res.status(201).json(created);

  } catch (error) {
    console.error('Create administrator error:', error);
    return res.status(500).json({
      error: 'Could not create administrator.'
    });
  }
});


function sessionUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers.cookie?.match(/session=([^;]+)/)?.[1];
  const item = token && sessions.get(token);
  if (!item || item.expires < Date.now()) return null;
  return item.user;
}
function requireAuth(req, res, next) { const user = sessionUser(req); if (!user) return res.status(401).json({ error: 'Authentication required.' }); req.user = user; next(); }
function requireAdmin(req, res, next) { requireAuth(req, res, () => ['admin', 'main-admin'].includes(req.user.role) ? next() : res.status(403).json({ error: 'Administrator access required.' })); }
function setSession(res, user) {
  const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { user, expires: Date.now() + 8 * 3600000 });
  res.cookie('session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 3600000 });
  return token;
}
const rate = (key, limit = 10) => { const now = Date.now(), a = attempts.get(key) || []; const recent = a.filter(t => now - t < 15 * 60 * 1000); recent.push(now); attempts.set(key, recent); return recent.length <= limit; };
const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
const csvResponse = (res, filename, headers, rows) => {
  res.type('text/csv').attachment(filename);
  res.send([headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n'));
};
app.get('/', (req, res) => res.json({ name: 'Meridian Learning Hub local API', status: 'running', health: '/api/health' }));

app.post('/api/tests/submit', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        error: 'Only students can submit test results.'
      });
    }

    const {
      testId,
      testTitle,
      passingMark,
      score,
      correct,
      total,
      essayAnswers = [],
      needsReview = false
    } = req.body || {};

    const numericScore = Number(score);
    const numericPassingMark = Number(passingMark ?? 60);
    const numericCorrect = Number(correct ?? 0);
    const numericTotal = Number(total ?? 0);

    if (
      testId === undefined ||
      testId === null ||
      String(testId).trim() === ''
    ) {
      return res.status(400).json({
        error: 'testId is required.'
      });
    }

    if (
      !Number.isFinite(numericScore) ||
      numericScore < 0 ||
      numericScore > 100
    ) {
      return res.status(400).json({
        error: 'Score must be between 0 and 100.'
      });
    }

    if (
      !Number.isFinite(numericPassingMark) ||
      numericPassingMark < 0 ||
      numericPassingMark > 100
    ) {
      return res.status(400).json({
        error: 'Passing mark must be between 0 and 100.'
      });
    }

    const studentId = req.user.studentId;

    if (!studentId) {
      return res.status(400).json({
        error: 'Your account does not have a student ID.'
      });
    }

    const assessmentId = `TEST-${String(testId).trim()}`;

    const student = await get(
      'SELECT id, student_id, name FROM users WHERE id=? AND role=?',
      [req.user.id, 'student']
    );

    if (!student || student.student_id !== studentId) {
      return res.status(403).json({
        error: 'Student account could not be verified.'
      });
    }

    /*
     * Essay-only tests are not automatically published.
     * They remain outside the marks table until staff review them.
     */
    if (numericTotal === 0 || needsReview && numericTotal === 0) {
      return res.status(200).json({
        ok: true,
        reviewRequired: true,
        message: 'Test submitted for staff review.'
      });
    }

    const existing = await get(
      `SELECT
         id,
         student_id AS studentId,
         assessment_id AS assessmentId,
         mark,
         status
       FROM marks
       WHERE student_id=? AND assessment_id=?`,
      [studentId, assessmentId]
    );

    /*
     * Keep the student's best automatically-marked test score.
     * A lower retake must never overwrite a better result.
     */
    if (
      existing &&
      Number(existing.mark) >= numericScore
    ) {
      return res.json({
        ok: true,
        mark: existing,
        keptBest: true
      });
    }

    /*
     * A Locked result has deliberately been sealed by staff.
     * Do not allow a student retake to overwrite it.
     */
    if (
      existing &&
      existing.status === 'Locked'
    ) {
      return res.status(409).json({
        error: 'This test result is locked and cannot be replaced by a student submission.'
      });
    }

    const saved = await transaction(async () => {
      await run(
        `INSERT INTO assessments(id, name, max_mark)
         VALUES (?, ?, 100)
         ON CONFLICT(id)
         DO UPDATE SET name=excluded.name`,
        [
          assessmentId,
          String(testTitle || assessmentId).trim()
        ]
      );

      await run(
        `INSERT INTO marks(
           student_id,
           assessment_id,
           mark,
           status,
           updated_by
         )
         VALUES (?, ?, ?, 'Published', ?)
         ON CONFLICT(student_id, assessment_id)
         DO UPDATE SET
           mark=excluded.mark,
           status='Published',
           updated_by=excluded.updated_by,
           updated_at=CURRENT_TIMESTAMP`,
        [
          studentId,
          assessmentId,
          numericScore,
          req.user.id
        ]
      );

      return await get(
        `SELECT
           id,
           student_id AS studentId,
           assessment_id AS assessmentId,
           mark,
           status,
           updated_by AS updatedBy,
           updated_at AS updatedAt
         FROM marks
         WHERE student_id=? AND assessment_id=?`,
        [studentId, assessmentId]
      );
    });

    /*
     * This is an automatically released result, so record it
     * using the new standard audit event.
     */
    await audit(
      req.user.id,
      'marks_released',
      'mark',
      saved.id,
      {
        studentId,
        assessmentId,
        mark: numericScore,
        passingMark: numericPassingMark,
        correct: numericCorrect,
        total: numericTotal,
        source: 'test-auto-mark'
      }
    );

    return res.status(existing ? 200 : 201).json({
      ok: true,
      mark: saved,
      released: true
    });
  } catch (error) {
    console.error('Test result save error:', error);

    return res.status(500).json({
      error: 'Could not save the test result.'
    });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const counts = await get('SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM marks) AS marks, (SELECT COUNT(*) FROM assessments) AS assessments');
    res.json({ ok: true, database: 'sqlite', counts, updatedAt: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ ok: false, error: 'SQLite is not available.' });
  }
});

app.post('/api/accounts/students', async (req, res) => {
  const { name, username, password, studentId, course, yearLevel } = req.body || {};
  if (![name, username, password, studentId].every(v => typeof v === 'string' && v.trim())) return res.status(400).json({ error: 'name, username, password and studentId are required.' });
  try { res.status(201).json(await createStudent({ name: name.trim(), username: username.trim(), password, studentId: studentId.trim(), course: typeof course === 'string' ? course.trim() : null, yearLevel: Number.parseInt(yearLevel, 10) || null })); }
  catch (e) { res.status(e.code === 'SQLITE_CONSTRAINT' ? 409 : 500).json({ error: e.code === 'SQLITE_CONSTRAINT' ? 'That account already exists.' : 'Could not create the local account.' }); }
});

app.post('/admin/accounts/student', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      username,
      password,
      studentId,
      course,
      yearLevel
    } = req.body || {};

    if (
      ![name, username, password, studentId]
        .every(v => typeof v === 'string' && v.trim())
    ) {
      return res.status(400).json({
        error: 'Name, username, password and student ID are required.'
      });
    }

    const student = await createStudent({
      name: name.trim(),
      username: username.trim(),
      password,
      studentId: studentId.trim(),
      course:
        typeof course === 'string'
          ? course.trim()
          : null,
      yearLevel:
        Number.parseInt(yearLevel, 10) || null
    });

    await audit(
      req.user.id,
      'student_created',
      'user',
      student.id,
      {
        username: student.username,
        studentId: student.studentId,
        course: student.course,
        yearLevel: student.yearLevel
      }
    );

    return res.status(201).json(student);
  } catch (error) {
    console.error("Create student error:", error);

    if (error.code === "SQLITE_CONSTRAINT") {
      return res.status(409).json({
        error: "That username or student ID already exists."
      });
    }

    return res.status(500).json({
      error: error.message || "Could not create student."
    });
  }
});

app.post('/api/accounts/sign-in', async (req, res) => {
  const { username, password } = req.body || {}; const key = `${req.ip}:${String(username).toLowerCase()}`;
  if (!username || !password) return res.status(400).json({ error: 'username and password are required.' });
  if (!rate(key)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  const user = await findUser(String(username).trim(), password);
  if (!user) return res.status(401).json({ error: 'Those details do not match a local account.' });
  setSession(res, user); res.json(user);
});
// Lets the frontend restore the signed-in user after a page refresh: the browser still
// holds the HttpOnly session cookie, but React state resets on reload, so without this
// endpoint the app had no way to know a session was still valid and always fell back to
// the login screen.
app.get('/api/accounts/me', requireAuth, async (req, res) => {
  const row = await get(`
    SELECT
      id,
      name,
      username,
      student_id AS studentId,
      role,
      temporary,
      course,
      year_level AS yearLevel
    FROM users
    WHERE id=?
  `, [req.user.id]);
  
  if (!row) {
    return res.status(404).json({
      error: 'Account not found.'
    });
  }
  
  row.temporary = Boolean(row.temporary);
  
  res.json(row);
});

app.patch('/api/accounts/profile', requireAuth, async (req, res) => {
  try {
    const name =
      typeof req.body?.name === 'string'
        ? req.body.name.trim()
        : '';

    const username =
      typeof req.body?.username === 'string'
        ? req.body.username.trim().toLowerCase()
        : '';

    const studentId =
      typeof req.body?.studentId === 'string'
        ? req.body.studentId.trim()
        : null;

    if (!name || !username) {
      return res.status(400).json({
        error: 'Name and username are required.'
      });
    }

    const existingUsername = await get(
      'SELECT id FROM users WHERE LOWER(username)=LOWER(?) AND id<>?',
      [username, req.user.id]
    );

    if (existingUsername) {
      return res.status(409).json({
        error: 'That username is already in use.'
      });
    }

    if (req.user.role === 'student' && studentId) {
      const existingStudentId = await get(
        'SELECT id FROM users WHERE LOWER(student_id)=LOWER(?) AND id<>?',
        [studentId, req.user.id]
      );

      if (existingStudentId) {
        return res.status(409).json({
          error: 'That student ID is already in use.'
        });
      }
    }

    await run(
      `UPDATE users
       SET name=?,
           username=?,
           student_id=?
       WHERE id=?`,
      [
        name,
        username,
        req.user.role === 'student' ? studentId : null,
        req.user.id
      ]
    );

    const updated = await get(
      `SELECT
         id,
         name,
         username,
         student_id AS studentId,
         role,
         temporary,
         course,
         year_level AS yearLevel
       FROM users
       WHERE id=?`,
      [req.user.id]
    );

    updated.temporary = Boolean(updated.temporary);

    await audit(
      req.user.id,
      'profile_updated',
      'user',
      req.user.id,
      {
        name,
        username,
        studentId:
          req.user.role === 'student'
            ? studentId
            : null
      }
    );

    return res.json(updated);
  } catch (error) {
    console.error('Profile update error:', error);

    return res.status(500).json({
      error: 'Could not save your profile.'
    });
  }
});

// Lets a signed-in student choose/change their own course and year of study; previously
// this only existed as an admin-managed field with no student-facing SQLite endpoint, so
// a student's course selection lived only in local React state and was wiped by the next
// SQLite sync.
app.patch('/api/accounts/course', requireAuth, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students choose their own course.' });
  const course = typeof req.body?.course === 'string' ? req.body.course.trim() : '';
  const yearLevel = Number.parseInt(req.body?.yearLevel, 10);
  if (!course) return res.status(400).json({ error: 'A course is required.' });
  if (!Number.isFinite(yearLevel) || yearLevel < 1 || yearLevel > 6) return res.status(400).json({ error: 'Year of study must be between 1 and 6.' });
  await run('UPDATE users SET course=?, year_level=? WHERE id=?', [course, yearLevel, req.user.id]);
  await audit(req.user.id, 'student_account_changed', 'user', req.user.id, { course, yearLevel });
  res.json({ ok: true, course, yearLevel });
});
app.post('/api/accounts/logout', (req, res) => { const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers.cookie?.match(/session=([^;]+)/)?.[1]; if (token) sessions.delete(token); res.clearCookie('session'); res.json({ ok: true }); });
app.post('/api/accounts/logout-all', requireAuth, (req, res) => { for (const [k, v] of sessions) if (v.user.id === req.user.id) sessions.delete(k); res.clearCookie('session'); res.json({ ok: true }); });
app.post('/api/accounts/password-reset/request', async (req, res) => {
  const user = await get('SELECT id FROM users WHERE username=?', [req.body?.username]); if (user) { const token = crypto.randomBytes(32).toString('hex'); await run('INSERT INTO password_resets VALUES(?,?,?,0)', [crypto.createHash('sha256').update(token).digest('hex'), user.id, new Date(Date.now() + 3600000).toISOString()]); res.json({ token }); } else res.json({ ok: true });
});
app.post('/api/accounts/password-reset/confirm', async (req, res) => {
  const hash = crypto.createHash('sha256').update(String(req.body?.token || '')).digest('hex');
  const row = await get('SELECT * FROM password_resets WHERE token_hash=? AND used=0 AND expires_at>?', [hash, new Date().toISOString()]);
  if (!row || typeof req.body?.password !== 'string' || req.body.password.length < 8) return res.status(400).json({ error: 'Invalid or expired reset token.' });
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  await run('UPDATE users SET password=?, failed_attempts=0, locked_until=NULL WHERE id=?', [passwordHash, row.user_id]);
  await run('UPDATE password_resets SET used=1 WHERE token_hash=?', [hash]);
  res.json({ ok: true });
});
app.post('/api/accounts/password-reset/confirm-legacy', async (req, res) => {
  res.status(410).json({ error: 'Password reset legacy endpoint is no longer supported.' });
});

function parseCsv(file) { return new Promise((resolve, reject) => { const rows = []; let headers = []; fs.createReadStream(file).pipe(csv({ strict: true })).on('headers', value => { headers = value; }).on('data', r => rows.push(r)).on('end', () => resolve({ rows, headers })).on('error', reject); }); }
app.get('/admin/data', requireAdmin, async (req, res) => {
  const [users, marks, assessments, auditLogs] = await Promise.all([
    all(`
      SELECT
        id,
        name,
        username,
        student_id AS studentId,
        role,
        temporary,
        course,
        year_level AS yearLevel,
        created_at AS createdAt
      FROM users
      ORDER BY name
    `),

    all(`
      SELECT
        m.id,
        m.student_id AS studentId,
        u.name AS student,
        m.assessment_id AS assessmentId,
        m.mark,
        m.status,
        m.updated_at AS updatedAt
      FROM marks m
      JOIN users u ON u.student_id = m.student_id
      ORDER BY m.updated_at DESC
    `),

    all(`
      SELECT
        id,
        name,
        max_mark AS maxMark,
        created_at AS createdAt
      FROM assessments
      ORDER BY id
    `),

    all(`
      SELECT
        id,
        action,
        entity,
        entity_id AS entityId,
        created_at AS createdAt
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 50
    `)
  ]);

  const usersWithFlags = users.map((account) => ({
    ...account,
    temporary: Boolean(account.temporary)
  }));

  res.json({
    users: usersWithFlags,
    marks,
    assessments,
    auditLogs,
    updatedAt: new Date().toISOString()
  });
});

app.get('/admin/marks.csv', requireAdmin, async (req, res) => {
  const rows = await all('SELECT student_id,assessment_id,mark,status FROM marks ORDER BY student_id,assessment_id');
  csvResponse(res, 'marks.csv', ['studentId', 'assessmentId', 'mark', 'status'], rows.map(row => [row.student_id, row.assessment_id, row.mark, row.status]));
});

app.get('/admin/students.csv', requireAdmin, async (req, res) => {
  const requested = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requested) ? Math.min(100, Math.max(30, requested)) : 30;
  const rows = await all('SELECT student_id,name,username,role,created_at FROM users WHERE role=? ORDER BY name LIMIT ?', ['student', limit]);
  csvResponse(res, `students-${limit}.csv`, ['studentId', 'name', 'username', 'role', 'createdAt'], rows.map(row => [row.student_id, row.name, row.username, row.role, row.created_at]));
});

app.post('/admin/upload-marks', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.body.schoolId || !req.file) return res.status(400).json({ error: 'schoolId and a CSV file are required.' });
  if (!/\.csv$/i.test(req.file.originalname)) { fs.rmSync(req.file.path, { force: true }); return res.status(415).json({ error: 'Only .csv files are accepted.' }); }
  let parsed;
  try { parsed = await parseCsv(req.file.path); } catch (e) { fs.rmSync(req.file.path, { force: true }); return res.status(400).json({ error: `Could not parse CSV: ${e.message}` }); }
  const headers = parsed.headers.map(header => String(header).trim().toLowerCase());
  const hasStudent = headers.includes('studentid') || headers.includes('student_id');
  const hasAssessment = headers.includes('assessmentid') || headers.includes('assessment_id');
  const missingHeaders = [!hasStudent && 'studentId', !hasAssessment && 'assessmentId', !headers.includes('mark') && 'mark'].filter(Boolean);
  if (missingHeaders.length || !parsed.rows.length) { fs.rmSync(req.file.path, { force: true }); return res.status(422).json({ imported: 0, errors: [{ row: 1, error: missingHeaders.length ? `Missing required column(s): ${missingHeaders.join(', ')}` : 'CSV contains no data rows.' }] }); }
  const rows = parsed.rows;
  const errors = [], seen = new Set(), valid = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], studentId = String(r.studentId || r.student_id || '').trim(), assessmentId = String(r.assessmentId || r.assessment_id || '').trim(), value = r.mark;
    const key = `${studentId}|${assessmentId}`; let message = !/^[A-Za-z0-9_-]+$/.test(studentId) ? 'Invalid student ID format' : !/^[A-Za-z0-9_-]+$/.test(assessmentId) ? 'Invalid assessment ID format' : !/^\d+(\.\d+)?$/.test(String(value)) ? 'Mark must be numeric' : Number(value) < 0 || Number(value) > 100 ? 'Mark must be between 0 and 100' : seen.has(key) ? 'Duplicate mark' : null;
    if (message) errors.push({ row: i + 2, studentId, assessmentId, error: message }); else { seen.add(key); valid.push({ studentId, assessmentId, mark: Number(value) }); }
  }
  // A mark that is already Published/Locked is protected from being silently overwritten by a
  // re-import (staff must unlock it deliberately). Anything still Draft/Submitted/Approved can be
  // safely re-imported (e.g. correcting a typo before publication) via the ON CONFLICT DO UPDATE
  // below, so those rows must NOT be treated as errors — only missing students and locked marks are.
  // A typo in the assessmentId column used to be silently accepted, because the import creates any
  // assessment it has not seen before. That quietly produced junk assessments ("BIO-O01") that then
  // skewed report cards and averages. Unknown assessment IDs are now reported like any other bad
  // data, unless the uploader explicitly opts in to creating them.
  const allowNewAssessments = String(req.body.createAssessments || '') === 'true';
  for (const r of valid) {
    const student = await get('SELECT student_id FROM users WHERE student_id=?', [r.studentId]);
    if (!student) { errors.push({ studentId: r.studentId, assessmentId: r.assessmentId, error: 'Student not found' }); continue; }
    if (!allowNewAssessments) {
      const assessment = await get('SELECT id FROM assessments WHERE id=?', [r.assessmentId]);
      if (!assessment) { errors.push({ studentId: r.studentId, assessmentId: r.assessmentId, error: 'Assessment not found — tick “Create missing assessments” if this is a new assessment' }); continue; }
    }
    const existing = await get('SELECT status FROM marks WHERE student_id=? AND assessment_id=?', [r.studentId, r.assessmentId]);
    if (existing && ['Published', 'Locked'].includes(existing.status)) errors.push({ studentId: r.studentId, assessmentId: r.assessmentId, error: `Mark is already ${existing.status.toLowerCase()} and cannot be overwritten by import` });
  }
  if (errors.length) {
    fs.rmSync(req.file.path, { force: true });
    return res.status(422).json({ imported: 0, errors });
  }
  try {
    const result = await transaction(async () => {
      for (const r of valid) {
        await run('INSERT INTO assessments(id,name) VALUES(?,?) ON CONFLICT(id) DO NOTHING', [r.assessmentId, r.assessmentId]);
        await run(`INSERT INTO marks(student_id,assessment_id,mark,status) VALUES(?,?,?,'Draft') ON CONFLICT(student_id,assessment_id) DO UPDATE SET mark=excluded.mark,status='Draft',updated_at=CURRENT_TIMESTAMP`, [r.studentId, r.assessmentId, r.mark]);
      } return { imported: valid.length };
    }); await audit(req.user.id, 'marks_uploaded', 'marks', req.body.schoolId, { imported: result.imported, errors: errors.length });
    res.status(200).json({ ...result, errors });
  } catch (e) { res.status(500).json({ error: 'Could not import marks.', details: e.message }); } finally { fs.rmSync(req.file.path, { force: true }); }
});

app.get('/student/marks/:schoolId/:studentId', requireAuth, async (req, res) => {
  if (req.user.role === 'student' && req.user.studentId !== req.params.studentId) return res.status(403).json({ error: 'Students may only view their own published results.' });
  // A student having zero published marks yet (e.g. everything is still Draft/Submitted/Approved,
  // or they are a brand-new learner) is a normal empty state, not an error — return 200 with an
  // empty array so the frontend keeps syncing over the API instead of falling back to unreliable
  // browser-only mode just because nothing has been published yet.
  const rows = await all('SELECT student_id AS studentId, assessment_id AS assessmentId, mark, status FROM marks WHERE student_id=? AND status IN ("Published","Locked")', [req.params.studentId]);
  res.json(rows);
});
app.post('/admin/marks/:id/status', requireAdmin, async (req, res) => {
  const next = req.body?.status;

  const allowed = {
    Draft: ['Submitted'],
    Submitted: ['Approved'],
    Approved: ['Published'],
    Published: ['Locked']
  };

  const mark = await get(
    'SELECT * FROM marks WHERE id=?',
    [req.params.id]
  );

  if (
    !mark ||
    !allowed[mark.status]?.includes(next)
  ) {
    return res.status(409).json({
      error: 'Invalid workflow transition.'
    });
  }

  await run(
    `UPDATE marks
     SET status=?,
         updated_by=?,
         updated_at=CURRENT_TIMESTAMP
     WHERE id=?`,
    [
      next,
      req.user.id,
      req.params.id
    ]
  );

  if (next === 'Published') {
    await audit(
      req.user.id,
      'marks_released',
      'mark',
      req.params.id,
      {
        source: 'results-workflow',
        previousStatus: mark.status,
        newStatus: 'Published'
      }
    );
  }

  return res.json({
    ...mark,
    status: next
  });
});
// Release a mark that was produced in the offline marking room.
//
// The marking room lets staff mark a submission with the API down, so this endpoint is the point
// where that offline work rejoins the database. Three properties matter:
//  1. It is idempotent by (studentId, assessmentId). The client's outbox retries until it gets a
//     success, and a retry after a response was lost in flight must not create a duplicate mark.
//  2. It is transactional. The assessment row and the mark row are written together, so a crash
//     mid-release can never leave a mark pointing at an assessment that does not exist.
//  3. It refuses to silently overwrite a mark that is already Published or Locked. Those have been
//     seen by the student, so correcting them must go through the deliberate workflow above.
app.post('/admin/marking/release', requireAdmin, async (req, res) => {
  const { studentId, assessmentId, mark, assessmentName, status, override, reason } = req.body || {};
  if (!studentId || !assessmentId) return res.status(400).json({ error: 'studentId and assessmentId are required.' });
  if (typeof mark !== 'number' || !Number.isFinite(mark) || mark < 0 || mark > 100) return res.status(400).json({ error: 'Mark must be a number between 0 and 100.' });
  const target = ['Draft', 'Submitted', 'Approved', 'Published'].includes(status) ? status : 'Published';
  const student = await get('SELECT student_id FROM users WHERE student_id=?', [studentId]);
  if (!student) return res.status(404).json({ error: `No student exists with ID ${studentId}.` });
  const existing = await get('SELECT id,status,mark FROM marks WHERE student_id=? AND assessment_id=?', [studentId, assessmentId]);
  // Already released with this exact score: treat a retry as success so the outbox can drain.
  // A different score is refused by default so a queued retry can never silently overwrite a
  // published result. `override` is the deliberate staff-initiated re-mark: it is allowed, but it
  // is recorded as its own audit event with the previous score so the correction is traceable.
  if (existing && ['Published', 'Locked'].includes(existing.status)) {
    if (Number(existing.mark) === Number(mark)) return res.json({ ok: true, id: existing.id, status: existing.status, duplicate: true });
    if (!override) return res.status(409).json({ error: 'That mark is already published or locked. Unlock it before correcting the score.' });
  }
  const remark = Boolean(existing && override && ['Published', 'Locked'].includes(existing.status));
  try {
    const id = await transaction(async () => {
      await run('INSERT INTO assessments(id,name) VALUES(?,?) ON CONFLICT(id) DO NOTHING', [assessmentId, assessmentName || assessmentId]);
      await run(`INSERT INTO marks(student_id,assessment_id,mark,status,updated_by) VALUES(?,?,?,?,?)
        ON CONFLICT(student_id,assessment_id) DO UPDATE SET mark=excluded.mark,status=excluded.status,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`,
        [studentId, assessmentId, mark, target, req.user.id]);
      const row = await get('SELECT id FROM marks WHERE student_id=? AND assessment_id=?', [studentId, assessmentId]);
      return row?.id;
    });
    await audit(
      req.user.id,
      remark
        ? 'marks_corrected'
        : target === 'Published'
          ? 'marks_released'
          : 'marks_uploaded',
      'mark',
      id,
      remark
        ? {
            studentId,
            assessmentId,
            previousMark: existing.mark,
            previousStatus: existing.status,
            mark,
            reason: reason || 'Re-marked after release',
            source: 'marking-room'
          }
        : {
            studentId,
            assessmentId,
            mark,
            status: target,
            source: 'marking-room'
          }
    );
  } catch (e) {
    res.status(500).json({ error: `Could not release the mark: ${e.message}` });
  }
});
// Published marks must go through the workflow (Locked) before their score can change again — this
// keeps the Draft->Submitted->Approved->Published->Locked pipeline meaningful. Locked marks ARE
// still editable here on purpose: it is the explicitly-requested "fix a mistake after locking"
// escape hatch for admins, and every correction is written to the audit log as 'marks_corrected'
// (distinct from the normal pre-publish 'marks_edited' event) so corrections stay traceable.
app.patch('/admin/marks/:id', requireAdmin, async (req, res) => { const mark = await get('SELECT * FROM marks WHERE id=?', [req.params.id]); if (!mark || mark.status === 'Published') return res.status(409).json({ error: 'Published marks must be locked before they can be corrected.' }); if (typeof req.body.mark !== 'number' || req.body.mark < 0 || req.body.mark > 100) return res.status(400).json({ error: 'Mark must be between 0 and 100.' }); await run('UPDATE marks SET mark=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [req.body.mark, req.user.id, req.params.id]); await audit(req.user.id, mark.status === 'Locked' ? 'marks_corrected' : 'marks_edited', 'mark', req.params.id); res.json({ ok: true }); });
app.get('/student/download/:schoolId/:filename', (req, res) => { const dir = path.resolve(STORAGE_ROOT, safeSegment(req.params.schoolId), 'uploads'); const file = path.resolve(dir, req.params.filename); if (!file.startsWith(`${dir}${path.sep}`)) return res.status(400).send('Invalid file path'); fs.existsSync(file) ? res.download(file) : res.status(404).send('File not found'); });
app.patch('/admin/accounts/:id', requireAdmin, async (req, res) => {
  const user = await get('SELECT * FROM users WHERE id=?', [req.params.id]); if (!user) return res.status(404).json({ error: 'Account not found.' });
  const fields = [], params = []; if (typeof req.body.name === 'string') { fields.push('name=?'); params.push(req.body.name.trim()); }
  if (typeof req.body.studentId === 'string') { fields.push('student_id=?'); params.push(req.body.studentId.trim()); }
  if (!fields.length) return res.status(400).json({ error: 'No account changes supplied.' }); params.push(req.params.id);
  await run(`UPDATE users SET ${fields.join(',')} WHERE id=?`, params); await audit(req.user.id, 'student_account_changed', 'user', req.params.id, req.body); res.json({ ok: true });
});
app.patch('/admin/accounts/:id/role', requireAdmin, async (req, res) => {
  const { role } = req.body || {};

  if (!['student', 'admin', 'main-admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }

  const target = await get(
    'SELECT id, role FROM users WHERE id=?',
    [req.params.id]
  );

  if (!target) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  if (
    target.role === 'main-admin' ||
    role === 'main-admin'
  ) {
    if (req.user.role !== 'main-admin') {
      return res.status(403).json({
        error: 'Only the main administrator can change main administrator roles.'
      });
    }
  }

  await run(
    'UPDATE users SET role=? WHERE id=?',
    [role, req.params.id]
  );

  await audit(
    req.user.id,
    'role_changed',
    'user',
    req.params.id,
    { role }
  );

  res.json({ ok: true });
});
// The `marks` foreign key only cascades on UPDATE (so renumbering a student ID doesn't orphan
// their marks), not on DELETE — deleting a student who has any marks would otherwise throw a
// FOREIGN KEY constraint error. Remove their marks first, in the same transaction, so deleting a
// student account never fails once they have results on file.
app.delete('/admin/accounts/:id', requireAdmin, async (req, res) => {
  try {
    const target = await get(
      `SELECT id, username, role, student_id
       FROM users
       WHERE id=?`,
      [req.params.id]
    );

    if (!target) {
      return res.status(404).json({
        error: 'Account not found.'
      });
    }

    // The main administrator can never be deleted.
    if (target.role === 'main-admin') {
      return res.status(403).json({
        error: 'The main administrator account cannot be deleted.'
      });
    }

    // Normal admins cannot delete administrator accounts.
    if (
      req.user.role !== 'main-admin' &&
      target.role !== 'student'
    ) {
      return res.status(403).json({
        error: 'Only the main administrator can delete administrator accounts.'
      });
    }

    await transaction(async () => {
      if (target.student_id) {
        await run(
          'DELETE FROM marks WHERE student_id=?',
          [target.student_id]
        );
      }

      await run(
        'DELETE FROM password_resets WHERE user_id=?',
        [target.id]
      );

      await run(
        'DELETE FROM sessions WHERE user_id=?',
        [target.id]
      );

      await run(
        'DELETE FROM users WHERE id=?',
        [target.id]
      );
    });

    await audit(
      req.user.id,
      'user_deleted',
      'user',
      target.id,
      {
        username: target.username,
        role: target.role
      }
    );

    return res.json({
      ok: true
    });

  } catch (error) {
    console.error('Delete account error:', error);

    return res.status(500).json({
      error: 'Could not delete account.'
    });
  }
});
app.post('/admin/2fa/setup', requireAdmin, async (req, res) => { const secret = speakeasy.generateSecret({ length: 20 }); await run('UPDATE users SET two_factor_secret=? WHERE id=?', [secret.base32, req.user.id]); res.json({ secret: secret.base32, otpauthUrl: secret.otpauth_url }); });
app.post('/admin/2fa/verify', requireAdmin, async (req, res) => { const user = await get('SELECT two_factor_secret FROM users WHERE id=?', [req.user.id]); const ok = !!user?.two_factor_secret && speakeasy.totp.verify({ secret: user.two_factor_secret, encoding: 'base32', token: String(req.body?.token || ''), window: 1 }); res.status(ok ? 200 : 401).json({ verified: ok }); });

module.exports = app;
if (require.main === module) app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
