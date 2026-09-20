const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const {
  createStudent,
  createAdmin,
  deleteUser,
  deleteMark,
  findUser,
  run,
  get,
  all,
  transaction,
  audit,
  getStaffTeachingGroups,
  getAllStaffTeachingGroups,
  getCourseYearGroups,
  listCourses,
  findCourse,
  createCourse,
  deleteCourse,
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

async function staffCanTeachStudent(user, studentId) {
  if (user?.role === 'main-admin') return true;
  const student = await get(
    'SELECT course, year_level AS yearLevel FROM users WHERE student_id=? AND role=\'student\'',
    [studentId]
  );
  if (!student?.course || !Number.isInteger(Number(student.yearLevel))) return false;
  const currentYear = new Date().getFullYear();
  const group = await get(`
    SELECT id
    FROM staff_course_assignments
    WHERE user_id=? AND course=? AND year_level=? AND academic_year=? AND active=1
  `, [user.id, student.course, Number(student.yearLevel), currentYear]);
  return Boolean(group);
}

async function staffCanManageStudent(req, res, studentId) {
  if (req.user.role === 'main-admin') return true;
  const allowed = await staffCanTeachStudent(req.user, studentId);
  if (!allowed) {
    res.status(403).json({
      error: 'This learner is outside your assigned teaching course/year. Choose your teaching group on the Courses page first.'
    });
    return false;
  }
  return true;
}
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

const remediationUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const directory = path.join(STORAGE_ROOT, 'remediations');
      fs.mkdirSync(directory, { recursive: true });
      cb(null, directory);
    },
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${path.basename(file.originalname)}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const REMEDIATION_STATUSES = ['Open', 'Scheduled', 'Submitted', 'Marked', 'Completed', 'Cancelled', 'Resolved'];

function remediationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: row.studentName,
    studentUsername: row.studentUsername,
    assessmentId: row.assessmentId,
    assignmentId: row.assignmentId,
    assignmentTitle: row.assignmentTitle,
    subject: row.subject,
    reason: row.reason,
    originalMark: row.originalMark == null ? null : Number(row.originalMark),
    passingMark: Number(row.passingMark ?? 60),
    remediationDate: row.remediationDate || '',
    remediationTime: row.remediationTime || '',
    venue: row.venue || '',
    instructions: row.instructions || '',
    feedback: row.feedback || '',
    attempts: Number(row.attempts || 0),
    attemptLimit: Number(row.attemptLimit || 1),
    remediationMark: row.remediationMark == null ? null : Number(row.remediationMark),
    status: row.status,
    fileName: row.fileName || null,
    submittedAt: row.submittedAt || null,
    completedAt: row.completedAt || null,
    createdBy: row.createdBy || null,
    updatedBy: row.updatedBy || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    downloadUrl: row.id && row.fileName ? `/student/remediations/${row.id}/download` : null,
  };
}

function testAttemptRow(row) {
  if (!row) return null;
  let essayAnswers = [];
  try {
    essayAnswers = row.essayAnswers ? JSON.parse(row.essayAnswers) : [];
    if (!Array.isArray(essayAnswers)) essayAnswers = [];
  } catch (_) {
    essayAnswers = [];
  }
  return {
    id: row.id,
    testId: String(row.testId),
    studentId: row.studentId,
    studentName: row.studentName || '',
    course: row.course || '',
    yearLevel: row.yearLevel == null ? null : Number(row.yearLevel),
    attemptNumber: Number(row.attemptNumber),
    score: Number(row.score),
    correct: Number(row.correct || 0),
    total: Number(row.total || 0),
    needsReview: Boolean(row.needsReview),
    isRemediation: Boolean(row.isRemediation),
    passed: row.passed == null ? null : Boolean(row.passed),
    essayAnswers,
    takenAt: row.takenAt || row.createdAt || null,
  };
}

async function fetchRemediationById(id) {
  const row = await get(`
    SELECT
      r.id, r.student_id AS studentId, u.name AS studentName, u.username AS studentUsername,
      r.assessment_id AS assessmentId, r.assignment_id AS assignmentId, r.assignment_title AS assignmentTitle,
      r.subject, r.reason, r.original_mark AS originalMark, r.passing_mark AS passingMark,
      r.remediation_date AS remediationDate, r.remediation_time AS remediationTime, r.venue, r.instructions, r.feedback,
      r.attempts, r.attempt_limit AS attemptLimit, r.remediation_mark AS remediationMark, r.status,
      r.file_name AS fileName, r.submitted_at AS submittedAt, r.completed_at AS completedAt,
      r.created_by AS createdBy, r.updated_by AS updatedBy, r.created_at AS createdAt, r.updated_at AS updatedAt
    FROM remediations r
    JOIN users u ON u.student_id = r.student_id
    WHERE r.id=?`, [id]);
  return remediationRow(row);
}

async function fetchRemediationByStudentAssessment(studentId, assessmentId) {
  const row = await get(`
    SELECT
      r.id, r.student_id AS studentId, u.name AS studentName, u.username AS studentUsername,
      r.assessment_id AS assessmentId, r.assignment_id AS assignmentId, r.assignment_title AS assignmentTitle,
      r.subject, r.reason, r.original_mark AS originalMark, r.passing_mark AS passingMark,
      r.remediation_date AS remediationDate, r.remediation_time AS remediationTime, r.venue, r.instructions, r.feedback,
      r.attempts, r.attempt_limit AS attemptLimit, r.remediation_mark AS remediationMark, r.status,
      r.file_name AS fileName, r.submitted_at AS submittedAt, r.completed_at AS completedAt,
      r.created_by AS createdBy, r.updated_by AS updatedBy, r.created_at AS createdAt, r.updated_at AS updatedAt
    FROM remediations r
    JOIN users u ON u.student_id = r.student_id
    WHERE r.student_id=? AND r.assessment_id=?`, [studentId, assessmentId]);
  return remediationRow(row);
}

async function upsertRemediationCase({ studentId, assessmentId, assignmentId = null, assignmentTitle, subject = null, reason = 'failed_mark', originalMark = null, passingMark = 60, attemptLimit = 1, status = 'Open', createdBy = null }) {
  const safePassingMark = Number.isFinite(Number(passingMark)) ? Number(passingMark) : 60;
  const safeAttemptLimit = Number.isInteger(Number(attemptLimit)) && Number(attemptLimit) > 0 ? Number(attemptLimit) : 1;
  const existing = await fetchRemediationByStudentAssessment(studentId, assessmentId);
  if (!existing) {
    await run(`INSERT INTO remediations (student_id, assessment_id, assignment_id, assignment_title, subject, reason, original_mark, passing_mark, attempt_limit, status, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [studentId, assessmentId, assignmentId, assignmentTitle || assessmentId, subject, reason, originalMark, safePassingMark, safeAttemptLimit, REMEDIATION_STATUSES.includes(status) ? status : 'Open', createdBy, createdBy]);
  } else {
    const nextStatus = ['Completed', 'Resolved'].includes(existing.status) && status === 'Open' ? existing.status : (REMEDIATION_STATUSES.includes(status) ? status : existing.status);
    await run(`UPDATE remediations SET assignment_id=?, assignment_title=?, subject=?, reason=?, original_mark=?, passing_mark=?, attempt_limit=?, status=?, updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [assignmentId ?? existing.assignmentId, assignmentTitle || existing.assignmentTitle, subject ?? existing.subject, reason, originalMark == null ? existing.originalMark : originalMark, safePassingMark, safeAttemptLimit, nextStatus, createdBy, existing.id]);
  }
  return fetchRemediationByStudentAssessment(studentId, assessmentId);
}
app.get('/', (req, res) => res.json({ name: 'Meridian Learning Hub local API', status: 'running', health: '/api/health' }));

app.get('/api/health', async (req, res) => {
  try {
    const counts = await get('SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM marks) AS marks, (SELECT COUNT(*) FROM assessments) AS assessments');
    res.json({ ok: true, database: 'sqlite', counts, updatedAt: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ ok: false, error: 'SQLite is not available.' });
  }
});

// Public course catalogue. It contains only course names and entry requirements, so the login and
// registration screens can load the same catalogue before a user has authenticated.
app.get('/api/courses', async (_req, res) => {
  try {
    res.json({ courses: await listCourses() });
  } catch (error) {
    console.error('Course catalogue error:', error);
    res.status(500).json({ error: 'Could not load the course catalogue.' });
  }
});

// -----------------------------------------------------------------------------
// First-install setup
// -----------------------------------------------------------------------------
// A new installation starts with zero users. These endpoints are intentionally
// public only until the first main administrator exists. The creation route
// re-checks the user count inside a transaction so two simultaneous requests
// cannot create two competing first administrators.
app.get('/api/setup/status', async (req, res) => {
  try {
    const row = await get('SELECT COUNT(*) AS count FROM users');
    const users = Number(row?.count || 0);
    res.json({ setupRequired: users === 0, users });
  } catch (error) {
    console.error('Setup status error:', error);
    res.status(500).json({ error: 'Could not determine the installation setup status.' });
  }
});

app.post('/api/setup/create-main-admin', async (req, res) => {
  try {
    const { name, username, password } = req.body || {};

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Main administrator name is required.' });
    }
    if (typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Main administrator username is required.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Main administrator password must be at least 8 characters.' });
    }

    const created = await transaction(async () => {
      const row = await get('SELECT COUNT(*) AS count FROM users');
      if (Number(row?.count || 0) !== 0) {
        const conflict = Object.assign(new Error('Initial setup has already been completed.'), { status: 409 });
        throw conflict;
      }

      return createAdmin({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        password,
        role: 'main-admin',
        temporary: false,
      });
    });

    const account = await get(`
      SELECT id, name, username, student_id AS studentId, role, temporary, course, year_level AS yearLevel
      FROM users
      WHERE id=?
    `, [created.id]);

    setSession(res, account);
    try {
      await audit(account.id, 'initial_setup_completed', 'user', account.id, { username: account.username });
    } catch (auditError) {
      console.error('Initial setup audit error:', auditError);
    }
    return res.status(201).json({ ...account, temporary: Boolean(account.temporary) });
  } catch (error) {
    console.error('Initial setup error:', error);
    const explicitStatus = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    const status = explicitStatus || (error?.code === 'SQLITE_CONSTRAINT' ? 409 : 500);
    return res.status(status).json({
      error: status === 409
        ? (error.message || 'Initial setup has already been completed.')
        : (error.message || 'Could not create the first main administrator.')
    });
  }
});

app.post('/api/accounts/students', async (req, res) => {
  const { name, username, password, studentId, course, yearLevel } = req.body || {};

  if (![name, username, password, studentId].every(v => typeof v === 'string' && v.trim())) {
    return res.status(400).json({ error: 'name, username, password and studentId are required.' });
  }

  try {
    const setupRow = await get('SELECT COUNT(*) AS count FROM users');
    if (Number(setupRow?.count || 0) === 0) {
      return res.status(409).json({
        error: 'Initial system setup must be completed by the first main administrator before student registration is enabled.'
      });
    }

    const normalizedCourse = typeof course === 'string' ? course.trim() : '';
    if (normalizedCourse && !(await findCourse(normalizedCourse))) {
      return res.status(400).json({ error: 'Choose a course from the current course catalogue.' });
    }

    res.status(201).json(await createStudent({
      name: name.trim(),
      username: username.trim(),
      password,
      studentId: studentId.trim(),
      course: typeof course === 'string' ? course.trim() : null,
      yearLevel: Number.parseInt(yearLevel, 10) || null
    }));
  } catch (e) {
    res.status(e.code === 'SQLITE_CONSTRAINT' ? 409 : 500).json({
      error: e.code === 'SQLITE_CONSTRAINT'
        ? 'That account already exists.'
        : 'Could not create the local account.'
    });
  }
});

app.post('/admin/accounts/student', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      username,
      password,
      studentId,
      course,
      yearLevel,
      teacherId
    } = req.body || {};

    if (
      ![name, username, password, studentId]
        .every(v => typeof v === 'string' && v.trim())
    ) {
      return res.status(400).json({
        error: 'Name, username, password and student ID are required.'
      });
    }

    const normalizedCourse = typeof course === 'string' ? course.trim() : '';
    const normalizedYear = Number.parseInt(yearLevel, 10);
    if (!normalizedCourse || !Number.isInteger(normalizedYear) || normalizedYear < 1 || normalizedYear > 6) {
      return res.status(400).json({ error: 'A valid course and year of study (1-6) are required.' });
    }
    if (!(await findCourse(normalizedCourse))) {
      return res.status(400).json({ error: 'Choose a course from the current course catalogue.' });
    }
    const academicYear = new Date().getFullYear();
    const normalizedTeacherId = Number.parseInt(teacherId, 10);
    if (!Number.isInteger(normalizedTeacherId) || normalizedTeacherId <= 0) {
      return res.status(400).json({ error: 'A responsible teacher/lecturer must be selected.' });
    }

    const teacher = await get('SELECT id, name, username, role FROM users WHERE id=?', [normalizedTeacherId]);
    if (!teacher || teacher.role !== 'admin') {
      return res.status(400).json({ error: 'The selected teacher/lecturer is not a valid administrator account.' });
    }

    const teacherGroup = await get(`
      SELECT id
      FROM staff_course_assignments
      WHERE user_id=? AND course=? AND year_level=? AND academic_year=? AND active=1
    `, [normalizedTeacherId, normalizedCourse, normalizedYear, academicYear]);
    if (!teacherGroup) {
      return res.status(409).json({ error: 'The selected teacher/lecturer is not assigned to that course and year.' });
    }

    if (req.user.role === 'admin') {
      const creatorGroup = await get(`
        SELECT id
        FROM staff_course_assignments
        WHERE user_id=? AND course=? AND year_level=? AND academic_year=? AND active=1
      `, [req.user.id, normalizedCourse, normalizedYear, academicYear]);
      if (!creatorGroup) return res.status(403).json({ error: 'You may only create learners in one of your assigned teaching course/year groups.' });
      const teacherCanBeSelected = await get(`
        SELECT id
        FROM staff_course_assignments
        WHERE user_id=? AND course=? AND year_level=? AND academic_year=? AND active=1
      `, [normalizedTeacherId, normalizedCourse, normalizedYear, academicYear]);
      if (!teacherCanBeSelected) return res.status(403).json({ error: 'That teacher/lecturer is not allocated to your selected teaching group.' });
    }

    const student = await transaction(async () => {
      const created = await createStudent({
        name: name.trim(),
        username: username.trim(),
        password,
        studentId: studentId.trim(),
        course: normalizedCourse,
        yearLevel: normalizedYear
      });

      await run(`
        INSERT INTO student_teacher_assignments(student_id, teacher_user_id, academic_year, active)
        VALUES(?,?,?,1)
        ON CONFLICT(student_id, academic_year)
        DO UPDATE SET teacher_user_id=excluded.teacher_user_id, active=1, updated_at=CURRENT_TIMESTAMP
      `, [created.studentId, normalizedTeacherId, academicYear]);

      return {
        ...created,
        teacherId: normalizedTeacherId,
        teacherName: teacher.name,
        teacherUsername: teacher.username,
        academicYear
      };
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
  if (!(await findCourse(course))) return res.status(400).json({ error: 'Choose a course from the current course catalogue.' });
  await run('UPDATE users SET course=?, year_level=? WHERE id=?', [course, yearLevel, req.user.id]);
  // Changing a learner's course/year invalidates the previous lecturer assignment. A teacher
  // must be allocated again for the new group rather than leaving a stale relationship behind.
  if (req.user.studentId) {
    await run('UPDATE student_teacher_assignments SET active=0, updated_at=CURRENT_TIMESTAMP WHERE student_id=? AND academic_year=?', [req.user.studentId, new Date().getFullYear()]);
  }
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
app.post('/admin/courses', requireAdmin, async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const requirement = typeof req.body?.requirement === 'string' ? req.body.requirement.trim() : '';
    if (!name) return res.status(400).json({ error: 'Course name is required.' });
    if (!requirement) return res.status(400).json({ error: 'Course entry requirements are required.' });

    const created = await createCourse({ name, requirement, createdBy: req.user.id });
    await audit(req.user.id, 'course_created', 'course', created.id, { name: created.name });
    return res.status(201).json(created);
  } catch (error) {
    const duplicate = /already exists/i.test(error.message || '') || error.code === 'SQLITE_CONSTRAINT';
    return res.status(duplicate ? 409 : 500).json({
      error: duplicate ? 'That course already exists in the catalogue.' : (error.message || 'Could not create course.')
    });
  }
});

app.delete('/admin/courses/:id', requireAdmin, async (req, res) => {
  try {
    const removed = await deleteCourse(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Course not found.' });
    await audit(req.user.id, 'course_removed', 'course', removed.id, { name: removed.name });
    return res.json({ ok: true, course: removed });
  } catch (error) {
    const inUse = /cannot be removed while students or teaching groups are using it/i.test(error.message || '');
    return res.status(inUse ? 409 : 500).json({ error: error.message || 'Could not remove course.' });
  }
});

app.get('/admin/teaching-courses', requireAdmin, async (req, res) => {
  try {
    const academicYear = Number.parseInt(req.query?.academicYear, 10) || new Date().getFullYear();
    const teachingGroups = await getStaffTeachingGroups(req.user.id, academicYear);
    const allTeachingGroups = req.user.role === 'main-admin'
      ? await getAllStaffTeachingGroups(academicYear)
      : teachingGroups;
    const courseGroups = await getCourseYearGroups({
      userId: req.user.role === 'main-admin' ? null : req.user.id,
      academicYear,
    });
    res.json({ teachingGroups, allTeachingGroups, courseGroups, academicYear });
  } catch (error) {
    console.error('Teaching group fetch error:', error);
    res.status(500).json({ error: 'Could not load teaching groups.' });
  }
});

app.post('/admin/teaching-courses', requireAdmin, async (req, res) => {
  try {
    const course = String(req.body?.course || '').trim();
    const yearLevel = Number.parseInt(req.body?.yearLevel, 10);
    const academicYear = Number.parseInt(req.body?.academicYear, 10) || new Date().getFullYear();
    const requestedAdminId = Number.parseInt(req.body?.adminUserId, 10);
    const targetUserId = req.user.role === 'main-admin' && Number.isInteger(requestedAdminId) ? requestedAdminId : req.user.id;

    if (!course) return res.status(400).json({ error: 'Course is required.' });
    if (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 6) return res.status(400).json({ error: 'Year of study must be between 1 and 6.' });
    if (!Number.isInteger(academicYear) || academicYear < 2000 || academicYear > 2100) return res.status(400).json({ error: 'Academic year must be between 2000 and 2100.' });
    if (!(await findCourse(course))) return res.status(400).json({ error: 'Choose a course from the current course catalogue.' });

    const target = await get('SELECT id, role, name, username FROM users WHERE id=?', [targetUserId]);
    if (!target || target.role !== 'admin') return res.status(400).json({ error: 'Teaching groups can only be assigned to administrator/teacher accounts.' });
    if (req.user.role !== 'main-admin' && target.id !== req.user.id) return res.status(403).json({ error: 'Administrators may only manage their own teaching groups.' });

    await run(`
      INSERT INTO staff_course_assignments(user_id,course,year_level,academic_year)
      VALUES(?,?,?,?)
      ON CONFLICT(user_id,course,year_level,academic_year)
      DO UPDATE SET active=1, updated_at=CURRENT_TIMESTAMP
    `, [target.id, course, yearLevel, academicYear]);

    await audit(req.user.id, 'teaching_group_assigned', 'staff_course_assignment', `${target.id}:${course}:${yearLevel}:${academicYear}`, { targetUserId: target.id, course, yearLevel, academicYear });
    const groups = await getStaffTeachingGroups(target.id, academicYear);
    res.status(201).json({ ok: true, group: groups.find((item) => item.course === course && Number(item.yearLevel) === yearLevel), teachingGroups: await getStaffTeachingGroups(req.user.id, academicYear) });
  } catch (error) {
    console.error('Teaching group assignment error:', error);
    res.status(500).json({ error: `Could not save teaching group: ${error.message}` });
  }
});

app.delete('/admin/teaching-courses/:id', requireAdmin, async (req, res) => {
  try {
    const group = await get('SELECT id, user_id AS userId, course, year_level AS yearLevel, academic_year AS academicYear FROM staff_course_assignments WHERE id=?', [req.params.id]);
    if (!group) return res.status(404).json({ error: 'Teaching group not found.' });
    if (req.user.role !== 'main-admin' && Number(group.userId) !== Number(req.user.id)) return res.status(403).json({ error: 'Administrators may only remove their own teaching groups.' });
    await run('UPDATE staff_course_assignments SET active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?', [req.params.id]);
    await audit(req.user.id, 'teaching_group_removed', 'staff_course_assignment', req.params.id, group);
    res.json({ ok: true });
  } catch (error) {
    console.error('Teaching group delete error:', error);
    res.status(500).json({ error: 'Could not remove teaching group.' });
  }
});

app.get('/admin/data', requireAdmin, async (req, res) => {
  const academicYear = new Date().getFullYear();
  const [users, marks, assessments, auditLogs, remediations, testAttempts, teacherAssignments, courses] = await Promise.all([
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
      WHERE role <> 'student'
         OR EXISTS (
           SELECT 1 FROM staff_course_assignments sc
           WHERE sc.user_id=? AND sc.active=1 AND sc.academic_year=?
             AND sc.course=users.course AND sc.year_level=users.year_level
         )
         OR ?='main-admin'
      ORDER BY name
    `, req.user.role === 'main-admin' ? [null, null, 'main-admin'] : [req.user.id, new Date().getFullYear(), req.user.role]),

    all(`
      SELECT
        m.id,
        m.student_id AS studentId,
        u.name AS student,
        m.assessment_id AS assessmentId,
        m.mark,
        m.passing_mark AS passingMark,
        m.feedback,
        m.status,
        m.updated_at AS updatedAt
      FROM marks m
      JOIN users u ON u.student_id = m.student_id
      WHERE EXISTS (
        SELECT 1 FROM staff_course_assignments sc
        WHERE u.role='student' AND sc.user_id=? AND sc.active=1 AND sc.academic_year=?
          AND sc.course=u.course AND sc.year_level=u.year_level
      ) OR ? = 'main-admin'
      ORDER BY m.updated_at DESC
    `, req.user.role === 'main-admin' ? [null, null, 'main-admin'] : [req.user.id, new Date().getFullYear(), req.user.role]),

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
    `),

    all(`
      SELECT
        r.id, r.student_id AS studentId, u.name AS studentName, u.username AS studentUsername,
        r.assessment_id AS assessmentId, r.assignment_id AS assignmentId, r.assignment_title AS assignmentTitle,
        r.subject, r.reason, r.original_mark AS originalMark, r.passing_mark AS passingMark,
        r.remediation_date AS remediationDate, r.remediation_time AS remediationTime, r.venue, r.instructions, r.feedback,
        r.attempts, r.attempt_limit AS attemptLimit, r.remediation_mark AS remediationMark, r.status,
        r.file_name AS fileName, r.submitted_at AS submittedAt, r.completed_at AS completedAt,
        r.created_by AS createdBy, r.updated_by AS updatedBy, r.created_at AS createdAt, r.updated_at AS updatedAt
      FROM remediations r JOIN users u ON u.student_id=r.student_id
      WHERE EXISTS (
        SELECT 1 FROM staff_course_assignments sc
        WHERE u.role='student' AND sc.user_id=? AND sc.active=1 AND sc.academic_year=?
          AND sc.course=u.course AND sc.year_level=u.year_level
      ) OR ? = 'main-admin'
      ORDER BY r.updated_at DESC
    `, req.user.role === 'main-admin' ? [null, null, 'main-admin'] : [req.user.id, new Date().getFullYear(), req.user.role]),

    all(`
      SELECT
        ta.id, ta.test_id AS testId, ta.student_id AS studentId, u.name AS studentName,
        u.course, u.year_level AS yearLevel, ta.attempt_number AS attemptNumber, ta.score,
        ta.correct, ta.total, ta.needs_review AS needsReview, ta.is_remediation AS isRemediation, ta.passed,
        ta.essay_answers AS essayAnswers, ta.taken_at AS takenAt, ta.created_at AS createdAt
      FROM test_attempts ta
      JOIN users u ON u.student_id=ta.student_id
      WHERE ?='main-admin'
         OR EXISTS (
           SELECT 1 FROM staff_course_assignments sc
           WHERE sc.user_id=? AND sc.active=1 AND sc.academic_year=?
             AND sc.course=u.course AND sc.year_level=u.year_level
         )
      ORDER BY ta.taken_at DESC, ta.student_id, ta.test_id, ta.attempt_number
    `, [req.user.role, req.user.id, academicYear]),

    all(`
      SELECT
        sta.student_id AS studentId,
        sta.teacher_user_id AS teacherId,
        t.name AS teacherName,
        t.username AS teacherUsername,
        sta.academic_year AS academicYear
      FROM student_teacher_assignments sta
      JOIN users t ON t.id=sta.teacher_user_id
      JOIN users student ON student.student_id=sta.student_id AND student.role='student'
      WHERE sta.active=1
        AND sta.academic_year=?
        AND (
          ?='main-admin'
          OR EXISTS (
            SELECT 1 FROM staff_course_assignments sc
            WHERE sc.user_id=? AND sc.active=1 AND sc.academic_year=?
              AND sc.course=student.course AND sc.year_level=student.year_level
          )
        )
    `, [academicYear, req.user.role, req.user.id, academicYear]),

    listCourses()
  ]);

  const teacherByStudent = new Map(teacherAssignments.map((assignment) => [String(assignment.studentId), assignment]));
  const usersWithFlags = users.map((account) => {
    const teacher = teacherByStudent.get(String(account.studentId));
    return {
      ...account,
      temporary: Boolean(account.temporary),
      teacherId: teacher?.teacherId || null,
      teacherName: teacher?.teacherName || null,
      teacherUsername: teacher?.teacherUsername || null,
      teacherAcademicYear: teacher?.academicYear || null
    };
  });

  const [teachingGroups, courseGroups] = await Promise.all([
    getStaffTeachingGroups(req.user.id, academicYear),
    getCourseYearGroups({ userId: req.user.role === 'main-admin' ? null : req.user.id, academicYear }),
  ]);
  const allTeachingGroups = req.user.role === 'main-admin'
    ? await getAllStaffTeachingGroups(academicYear)
    : teachingGroups;

  res.json({
    users: usersWithFlags,
    marks,
    assessments,
    auditLogs,
    remediations: remediations.map(remediationRow),
    testAttempts: testAttempts.map(testAttemptRow),
    teachingGroups,
    allTeachingGroups,
    courseGroups,
    teacherAssignments,
    courses,
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
    if (req.user.role === 'admin' && !(await staffCanTeachStudent(req.user, r.studentId))) {
      errors.push({ studentId: r.studentId, assessmentId: r.assessmentId, error: 'Student is outside your assigned teaching course/year' });
      continue;
    }
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
  const rows = await all('SELECT student_id AS studentId, assessment_id AS assessmentId, mark, passing_mark AS passingMark, feedback, status FROM marks WHERE student_id=? AND status IN ("Published","Locked")', [req.params.studentId]);
  res.json(rows);
});

app.get('/student/marks/local/:studentId', requireAuth, async (req, res) => {
  if (req.user.role === 'student' && req.user.studentId !== req.params.studentId) return res.status(403).json({ error: 'Students may only view their own published results.' });
  const rows = await all('SELECT student_id AS studentId, assessment_id AS assessmentId, mark, passing_mark AS passingMark, feedback, status FROM marks WHERE student_id=? AND status IN ("Published","Locked")', [req.params.studentId]);
  res.json(rows);
});

app.get('/student/test-attempts', requireAuth, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students may use this endpoint.' });
  const rows = await all(`
    SELECT
      ta.id,
      ta.test_id AS testId,
      ta.student_id AS studentId,
      u.name AS studentName,
      u.course,
      u.year_level AS yearLevel,
      ta.attempt_number AS attemptNumber,
      ta.score,
      ta.correct,
      ta.total,
      ta.needs_review AS needsReview,
      ta.is_remediation AS isRemediation,
      ta.passed,
      ta.essay_answers AS essayAnswers,
      ta.taken_at AS takenAt,
      ta.created_at AS createdAt
    FROM test_attempts ta
    JOIN users u ON u.student_id=ta.student_id
    WHERE ta.student_id=?
    ORDER BY ta.test_id, ta.attempt_number
  `, [req.user.studentId]);
  res.json(rows.map(testAttemptRow));
});

app.post('/student/test-attempts', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students may submit test attempts.' });

    const testId = String(req.body?.testId || '').trim();
    const testTitle = String(req.body?.testTitle || testId).trim();
    const subject = String(req.body?.subject || testTitle).trim();
    const passingMark = Number(req.body?.passingMark ?? 60);
    const requestedAttemptNumber = Number.parseInt(req.body?.attemptNumber, 10);
    const score = Number(req.body?.score);
    const correct = Number(req.body?.correct ?? 0);
    const total = Number(req.body?.total ?? 0);
    const needsReview = req.body?.needsReview ? 1 : 0;
    const passed = req.body?.passed == null ? null : (req.body.passed ? 1 : 0);
    const isRemediation = req.body?.isRemediation ? 1 : 0;
    const essayAnswers = Array.isArray(req.body?.essayAnswers) ? req.body.essayAnswers : [];

    if (!testId) return res.status(400).json({ error: 'testId is required.' });
    if (!testTitle) return res.status(400).json({ error: 'Test title is required.' });
    if (!Number.isFinite(passingMark) || passingMark < 0 || passingMark > 100) return res.status(400).json({ error: 'Passing mark must be between 0 and 100.' });
    if (!Number.isInteger(requestedAttemptNumber) || requestedAttemptNumber < 1 || requestedAttemptNumber > 10) return res.status(400).json({ error: 'Attempt number must be between 1 and 10.' });
    if (!Number.isFinite(score) || score < 0 || score > 100) return res.status(400).json({ error: 'Test score must be between 0 and 100.' });
    if (!Number.isInteger(correct) || correct < 0 || !Number.isInteger(total) || total < 0 || correct > total) return res.status(400).json({ error: 'Test question totals are invalid.' });

    const attemptNumber = requestedAttemptNumber;
    if (attemptNumber > 10) return res.status(409).json({ error: 'This test has reached the maximum stored attempt history.' });

    const existing = await get(`
      SELECT ta.id, ta.test_id AS testId, ta.student_id AS studentId, u.name AS studentName,
        u.course, u.year_level AS yearLevel, ta.attempt_number AS attemptNumber, ta.score,
        ta.correct, ta.total, ta.needs_review AS needsReview, ta.is_remediation AS isRemediation, ta.passed,
        ta.essay_answers AS essayAnswers, ta.taken_at AS takenAt, ta.created_at AS createdAt
      FROM test_attempts ta JOIN users u ON u.student_id=ta.student_id
      WHERE ta.test_id=? AND ta.student_id=? AND ta.attempt_number=?`,
      [testId, req.user.studentId, attemptNumber]
    );
    if (existing) return res.json({ ok: true, attempt: testAttemptRow(existing), duplicate: true });

    let savedMark = null;
    let savedRemediation = null;
    await transaction(async () => {
      await run('INSERT OR IGNORE INTO assessments(id,name,max_mark) VALUES(?,?,?)', [`TEST-${testId}`, testTitle, 100]);
      await run(`INSERT INTO test_attempts(test_id, student_id, attempt_number, score, correct, total, needs_review, passed, essay_answers, is_remediation, taken_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
        testId, req.user.studentId, attemptNumber, score, correct, total, needsReview, passed, JSON.stringify(essayAnswers), isRemediation, new Date().toISOString()
      ]);

      if (!isRemediation && !needsReview && total > 0) {
        const existingMark = await get('SELECT id, mark, status, feedback FROM marks WHERE student_id=? AND assessment_id=?', [req.user.studentId, `TEST-${testId}`]);
        const bestScore = Math.max(Number(existingMark?.mark ?? 0), score);
        const feedback = bestScore < passingMark
          ? `Remediation is required below ${passingMark}% on ${testTitle}.`
          : `${testTitle} passed at the ${passingMark}% threshold.`;

        await run(`
          INSERT INTO marks(student_id, assessment_id, mark, passing_mark, feedback, status, updated_at)
          VALUES(?,?,?,?,?,'Published',CURRENT_TIMESTAMP)
          ON CONFLICT(student_id, assessment_id)
          DO UPDATE SET
            mark=CASE WHEN excluded.mark > marks.mark THEN excluded.mark ELSE marks.mark END,
            passing_mark=excluded.passing_mark,
            feedback=excluded.feedback,
            status='Published',
            updated_at=CURRENT_TIMESTAMP
        `, [req.user.studentId, `TEST-${testId}`, bestScore, passingMark, feedback]);

        savedMark = await get(`SELECT id, student_id AS studentId, assessment_id AS assessmentId, mark, passing_mark AS passingMark, feedback, status FROM marks WHERE student_id=? AND assessment_id=?`, [req.user.studentId, `TEST-${testId}`]);

        if (bestScore < passingMark) {
          const existingRemediation = await fetchRemediationByStudentAssessment(req.user.studentId, `TEST-${testId}`);
          if (!existingRemediation) {
            savedRemediation = await upsertRemediationCase({
              studentId: req.user.studentId,
              assessmentId: `TEST-${testId}`,
              assignmentId: null,
              assignmentTitle: testTitle,
              subject,
              reason: 'failed_mark',
              originalMark: bestScore,
              passingMark,
              attemptLimit: 1,
              status: 'Open',
              createdBy: req.user.id,
            });
          } else {
            savedRemediation = existingRemediation;
          }
        } else {
          await run("UPDATE remediations SET status='Resolved', updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE student_id=? AND assessment_id=? AND status<>'Cancelled'", [req.user.id, req.user.studentId, `TEST-${testId}`]);
          savedRemediation = await fetchRemediationByStudentAssessment(req.user.studentId, `TEST-${testId}`);
        }
      }

      if (isRemediation) {
        const remediation = await fetchRemediationByStudentAssessment(req.user.studentId, `TEST-${testId}`);
        if (!remediation) throw new Error('No active remediation case exists for this test.');
        if (!['Open', 'Scheduled'].includes(remediation.status)) throw new Error(`This remediation case is ${remediation.status.toLowerCase()} and cannot accept a remediation test.`);
        if (Number(remediation.attempts || 0) >= Number(remediation.attemptLimit || 1)) throw new Error('The allowed remediation test attempts have been used.');
        await run(`UPDATE remediations SET attempts=attempts+1, remediation_mark=?, status='Marked', updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [score, req.user.id, remediation.id]);
        savedRemediation = await fetchRemediationByStudentAssessment(req.user.studentId, `TEST-${testId}`);
      }
    });

    const saved = await get(`
      SELECT ta.id, ta.test_id AS testId, ta.student_id AS studentId, u.name AS studentName,
        u.course, u.year_level AS yearLevel, ta.attempt_number AS attemptNumber, ta.score,
        ta.correct, ta.total, ta.needs_review AS needsReview, ta.is_remediation AS isRemediation, ta.passed,
        ta.essay_answers AS essayAnswers, ta.taken_at AS takenAt, ta.created_at AS createdAt
      FROM test_attempts ta JOIN users u ON u.student_id=ta.student_id
      WHERE ta.test_id=? AND ta.student_id=? AND ta.attempt_number=?`, [testId, req.user.studentId, attemptNumber]);

    await audit(req.user.id, 'test_attempt_submitted', 'test_attempt', saved?.id || null, { testId, studentId: req.user.studentId, attemptNumber, score, needsReview, isRemediation });
    return res.status(201).json({
      ok: true,
      attempt: testAttemptRow(saved),
      duplicate: false,
      mark: savedMark,
      remediation: savedRemediation,
    });
  } catch (error) {
    console.error('Test attempt save error:', error);
    res.status(500).json({ error: `Could not save test attempt: ${error.message}` });
  }
});

app.get('/admin/test-attempts', requireAdmin, async (req, res) => {
  const currentYear = new Date().getFullYear();
  const rows = await all(`
    SELECT
      ta.id, ta.test_id AS testId, ta.student_id AS studentId, u.name AS studentName,
      u.course, u.year_level AS yearLevel, ta.attempt_number AS attemptNumber, ta.score,
      ta.correct, ta.total, ta.needs_review AS needsReview, ta.is_remediation AS isRemediation, ta.passed,
      ta.essay_answers AS essayAnswers, ta.taken_at AS takenAt, ta.created_at AS createdAt
    FROM test_attempts ta
    JOIN users u ON u.student_id=ta.student_id
    WHERE ?='main-admin'
       OR EXISTS (
         SELECT 1
         FROM staff_course_assignments sc
         WHERE sc.user_id=? AND sc.active=1 AND sc.academic_year=?
           AND sc.course=u.course AND sc.year_level=u.year_level
       )
    ORDER BY ta.taken_at DESC, ta.student_id, ta.test_id, ta.attempt_number
  `, [req.user.role, req.user.id, currentYear]);
  res.json(rows.map(testAttemptRow));
});
app.post('/admin/marks/:id/status', requireAdmin, async (req, res) => {
  try {
    const next = req.body?.status;
    const allowed = { Draft: ['Submitted'], Submitted: ['Approved'], Approved: ['Published'], Published: ['Locked'] };
    const mark = await get('SELECT * FROM marks WHERE id=?', [req.params.id]);
    if (!mark || !allowed[mark.status]?.includes(next)) return res.status(409).json({ error: 'Invalid workflow transition.' });
    if (!(await staffCanManageStudent(req, res, mark.student_id))) return;
    if (['Published', 'Locked'].includes(next) && req.user.role !== 'main-admin') {
      return res.status(403).json({ error: 'Only the main administrator can publish or lock final results.' });
    }
    await run('UPDATE marks SET status=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [next, req.user.id, req.params.id]);

    if (next === 'Published') {
      const passingMark = Number(mark.passing_mark ?? 60);
      const assessment = await get('SELECT name FROM assessments WHERE id=?', [mark.assessment_id]);
      if (Number(mark.mark) < passingMark) {
        await upsertRemediationCase({
          studentId: mark.student_id,
          assessmentId: mark.assessment_id,
          assignmentId: String(mark.assessment_id).startsWith('ASSIGN-') ? String(mark.assessment_id).slice(7) : null,
          assignmentTitle: assessment?.name || mark.assessment_id,
          subject: assessment?.name || mark.assessment_id,
          reason: 'failed_mark',
          originalMark: Number(mark.mark),
          passingMark,
          status: 'Open',
          createdBy: req.user.id,
        });
      } else {
        await run("UPDATE remediations SET status='Resolved', updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE student_id=? AND assessment_id=? AND status<>'Cancelled'", [req.user.id, mark.student_id, mark.assessment_id]);
      }
    }

    await audit(req.user.id, next === 'Published' ? 'marks_published' : 'mark_status_changed', 'mark', req.params.id, { status: next });
    const updated = await get('SELECT * FROM marks WHERE id=?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    console.error('Mark status error:', error);
    res.status(500).json({ error: `Could not change mark status: ${error.message}` });
  }
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

app.post(
  '/admin/marking/upload-returned-work',
  requireAdmin,
  upload.single('file'),
  async (req, res) => {
    try {
      const {
        schoolId,
        studentId,
        assessmentId
      } = req.body || {};

      if (!schoolId || !studentId || !assessmentId || !req.file) {
        return res.status(400).json({
          error: 'schoolId, studentId, assessmentId and a ZIP file are required.'
        });
      }

      if (!/\.zip$/i.test(req.file.originalname)) {
        fs.rmSync(req.file.path, { force: true });

        return res.status(415).json({
          error: 'Only ZIP files are accepted for returned assignments.'
        });
      }

      const student = await get(
        'SELECT student_id FROM users WHERE student_id=? AND role=?',
        [studentId, 'student']
      );

      if (!student) {
        fs.rmSync(req.file.path, { force: true });

        return res.status(404).json({
          error: 'Student not found.'
        });
      }

      res.status(201).json({
        ok: true,
        studentId,
        assessmentId,
        fileName: req.file.originalname,
        filePath: req.file.path
      });

    } catch (error) {
      if (req.file?.path) {
        fs.rmSync(req.file.path, { force: true });
      }

      res.status(500).json({
        error: `Could not upload returned work: ${error.message}`
      });
    }
  }
);

app.post('/admin/marking/release', requireAdmin, async (req, res) => {
  try {
    const {
      studentId,
      assessmentId,
      assessmentName,
      mark,
      status,
      override,
      reason,
      feedback,
      passingMark
    } = req.body || {};

    // ------------------------------------------------------------
    // Basic validation
    // ------------------------------------------------------------

    if (!studentId || !assessmentId) {
      return res.status(400).json({
        error: 'studentId and assessmentId are required.'
      });
    }

    const numericMark = Number(mark);
    const numericPassingMark = Number.isFinite(Number(passingMark)) ? Number(passingMark) : 60;
    if (numericPassingMark < 0 || numericPassingMark > 100) {
      return res.status(400).json({ error: 'Passing mark must be between 0 and 100.' });
    }

    if (
      mark === undefined ||
      mark === null ||
      !Number.isFinite(numericMark) ||
      numericMark < 0 ||
      numericMark > 100
    ) {
      return res.status(400).json({
        error: 'Mark must be a number between 0 and 100.'
      });
    }

    const releaseStatus =
      ['Draft', 'Submitted', 'Approved', 'Published'].includes(status)
        ? status
        : 'Published';

    const isOverride = Boolean(override);

    // ------------------------------------------------------------
    // Confirm the student exists
    // ------------------------------------------------------------

    const student = await get(
      `SELECT id, student_id, name, username
       FROM users
       WHERE student_id=? AND role='student'`,
      [studentId]
    );

    if (!student) {
      return res.status(404).json({
        error: `No student exists with ID ${studentId}.`
      });
    }
    if (!(await staffCanManageStudent(req, res, studentId))) return;
    if (String(status || '') === 'Published' && req.user.role !== 'main-admin') {
      return res.status(403).json({ error: 'Marks can be marked and submitted by an administrator, but only the main administrator can publish final results.' });
    }

    // ------------------------------------------------------------
    // See whether this mark already exists
    // ------------------------------------------------------------

    const existing = await get(
      `SELECT
         id,
         student_id,
         assessment_id,
         mark,
         passing_mark AS passingMark,
         feedback,
         status,
         updated_by,
         created_at,
         updated_at
       FROM marks
       WHERE student_id=? AND assessment_id=?`,
      [studentId, assessmentId]
    );

    // ------------------------------------------------------------
    // Idempotent retry
    //
    // If the client sent the same release twice because of a
    // network failure, treat it as success rather than creating
    // another result.
    // ------------------------------------------------------------

    if (existing && ['Published', 'Locked'].includes(existing.status) && req.user.role !== 'main-admin') {
      return res.status(403).json({ error: 'Only the main administrator can re-mark a published or locked final result.' });
    }

    if (existing && Number(existing.mark) === numericMark) {
      if (
        existing.status === 'Published' ||
        existing.status === 'Locked'
      ) {
        return res.json({
          ok: true,
          id: existing.id,
          studentId,
          assessmentId,
          mark: numericMark,
          status: existing.status,
          duplicate: true
        });
      }
    }

    // ------------------------------------------------------------
    // Protect already published/locked marks
    // ------------------------------------------------------------

    if (
      existing &&
      ['Published', 'Locked'].includes(existing.status)
    ) {
      // A different score cannot silently replace a published result.
      if (!isOverride) {
        return res.status(409).json({
          error:
            `This mark is already ${existing.status.toLowerCase()}. ` +
            'Use the re-mark/correction workflow before changing it.'
        });
      }

      // Locked results should not be modified through the normal
      // release endpoint.
      if (existing.status === 'Locked') {
        return res.status(409).json({
          error:
            'This mark is locked. Unlock or correct the result through the administrator correction workflow before releasing a new score.'
        });
      }

      // A reason is mandatory when an already-published score changes.
      if (
        existing.status === 'Published' &&
        Number(existing.mark) !== numericMark &&
        !String(reason || '').trim()
      ) {
        return res.status(400).json({
          error:
            `A reason is required when changing the published mark ` +
            `from ${existing.mark}% to ${numericMark}%.`
        });
      }
    }

    const isRemark =
      Boolean(
        existing &&
        existing.status === 'Published' &&
        isOverride &&
        Number(existing.mark) !== numericMark
      );

    // ------------------------------------------------------------
    // Write the assessment + mark atomically
    // ------------------------------------------------------------

    const markId = await transaction(async () => {
      await run(
        `INSERT INTO assessments(id, name)
         VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name`,
        [
          assessmentId,
          String(assessmentName || assessmentId).trim()
        ]
      );

      await run(
        `INSERT INTO marks (
           student_id,
           assessment_id,
           mark,
           passing_mark,
           feedback,
           status,
           updated_by
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(student_id, assessment_id)
         DO UPDATE SET
           mark=excluded.mark,
           passing_mark=excluded.passing_mark,
           feedback=excluded.feedback,
           status=excluded.status,
           updated_by=excluded.updated_by,
           updated_at=CURRENT_TIMESTAMP`,
        [
          studentId,
          assessmentId,
          numericMark,
          numericPassingMark,
          feedback || '',
          releaseStatus,
          req.user.id
        ]
      );

      const row = await get(
        `SELECT id
         FROM marks
         WHERE student_id=? AND assessment_id=?`,
        [studentId, assessmentId]
      );

      if (!row?.id) {
        throw new Error('The mark could not be retrieved after saving.');
      }

      return row.id;
    });

    // A published result below the passing threshold automatically creates a remediation case.
    if (releaseStatus === 'Published') {
      const assessment = await get('SELECT name FROM assessments WHERE id=?', [assessmentId]);
      if (numericMark < numericPassingMark) {
        await upsertRemediationCase({
          studentId,
          assessmentId,
          assignmentId: String(assessmentId).startsWith('ASSIGN-') ? String(assessmentId).slice(7) : null,
          assignmentTitle: assessment?.name || assessmentName || assessmentId,
          subject: assessment?.name || assessmentName || assessmentId,
          reason: 'failed_mark',
          originalMark: numericMark,
          passingMark: numericPassingMark,
          status: 'Open',
          createdBy: req.user.id,
        });
      } else {
        await run("UPDATE remediations SET status='Resolved', updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE student_id=? AND assessment_id=? AND status<>'Cancelled'", [req.user.id, studentId, assessmentId]);
      }
    }

    // ------------------------------------------------------------
    // Audit the operation
    // ------------------------------------------------------------

    await audit(
      req.user.id,
      isRemark
        ? 'marks_edited'
        : releaseStatus === 'Published'
          ? 'marks_published'
          : 'marks_uploaded',
      'mark',
      markId,
      {
        studentId,
        assessmentId,
        mark: numericMark,
        status: releaseStatus,
        feedback: feedback || '',
        source: 'marking-room',

        ...(isRemark
          ? {
              previousMark: existing.mark,
              previousStatus: existing.status,
              reason: String(reason).trim()
            }
          : {})
      }
    );

    // ------------------------------------------------------------
    // Return the saved database record
    // ------------------------------------------------------------

    const saved = await get(
      `SELECT
         id,
         student_id AS studentId,
         assessment_id AS assessmentId,
         mark,
         passing_mark AS passingMark,
         feedback,
         status,
         updated_by AS updatedBy,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM marks
       WHERE id=?`,
      [markId]
    );

    return res.status(isRemark ? 200 : 201).json({
      ok: true,
      release: saved,
      duplicate: false,
      remark: isRemark
    });

  } catch (error) {
    console.error('Marking release error:', error);

    return res.status(500).json({
      error: `Could not release the mark: ${error.message}`
    });
  }
});
// Published marks must go through the workflow (Locked) before their score can change again.
app.delete('/admin/marks/:id', requireAdmin, async (req, res) => {
  try {
    const mark = await deleteMark(req.params.id);

    if (!mark) {
      return res.status(404).json({
        error: 'Mark not found.'
      });
    }

    await audit(
      req.user.id,
      'mark_deleted',
      'mark',
      req.params.id,
      {
        studentId: mark.student_id,
        assessmentId: mark.assessment_id,
        mark: mark.mark,
        status: mark.status
      }
    );

    return res.json({
      ok: true,
      message: 'Stored mark deleted successfully.'
    });
  } catch (error) {
    console.error('Mark delete error:', error);
    return res.status(500).json({
      error: `Could not delete the mark: ${error.message}`
    });
  }
});
app.patch('/admin/marks/:id', requireAdmin, async (req, res) => {
  try {
    const current = await get('SELECT * FROM marks WHERE id=?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Mark not found.' });
    if (!(await staffCanManageStudent(req, res, current.student_id))) return;
    if (['Published', 'Locked'].includes(current.status) && req.user.role !== 'main-admin') {
      return res.status(403).json({ error: 'Only the main administrator can change a published or locked final result.' });
    }

    if (req.body.mark !== undefined) {
      const score = Number(req.body.mark);
      if (!Number.isFinite(score) || score < 0 || score > 100) return res.status(400).json({ error: 'Mark must be between 0 and 100.' });
      if (current.status === 'Published') return res.status(409).json({ error: 'Published marks must be locked before their score can be corrected.' });
    }

    const fields = [];
    const params = [];
    if (req.body.mark !== undefined) { fields.push('mark=?'); params.push(Number(req.body.mark)); }
    if (req.body.feedback !== undefined) { fields.push('feedback=?'); params.push(String(req.body.feedback ?? '')); }
    if (req.body.passingMark !== undefined) {
      const threshold = Number(req.body.passingMark);
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) return res.status(400).json({ error: 'Passing mark must be between 0 and 100.' });
      fields.push('passing_mark=?'); params.push(threshold);
    }
    if (!fields.length) return res.status(400).json({ error: 'No mark changes supplied.' });
    fields.push('updated_by=?'); params.push(req.user.id);
    fields.push('updated_at=CURRENT_TIMESTAMP');
    params.push(req.params.id);
    await run(`UPDATE marks SET ${fields.join(',')} WHERE id=?`, params);

    const updated = await get('SELECT * FROM marks WHERE id=?', [req.params.id]);
    if (['Published', 'Locked'].includes(updated.status)) {
      const threshold = Number(updated.passing_mark ?? 60);
      const assessment = await get('SELECT name FROM assessments WHERE id=?', [updated.assessment_id]);
      if (Number(updated.mark) < threshold) {
        await upsertRemediationCase({
          studentId: updated.student_id,
          assessmentId: updated.assessment_id,
          assignmentId: String(updated.assessment_id).startsWith('ASSIGN-') ? String(updated.assessment_id).slice(7) : null,
          assignmentTitle: assessment?.name || updated.assessment_id,
          subject: assessment?.name || updated.assessment_id,
          reason: 'failed_mark',
          originalMark: Number(updated.mark),
          passingMark: threshold,
          status: 'Open',
          createdBy: req.user.id,
        });
      } else {
        await run("UPDATE remediations SET status='Resolved', updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE student_id=? AND assessment_id=? AND status<>'Cancelled'", [req.user.id, updated.student_id, updated.assessment_id]);
      }
    }
    await audit(req.user.id, updated.status === 'Locked' ? 'marks_corrected' : 'marks_edited', 'mark', req.params.id, { changed: fields });
    res.json({ ok: true, mark: updated });
  } catch (error) {
    console.error('Mark update error:', error);
    res.status(500).json({ error: `Could not update the mark: ${error.message}` });
  }
});
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
app.get('/admin/remediations', requireAdmin, async (req, res) => {
  const rows = await all(`
    SELECT
      r.id, r.student_id AS studentId, u.name AS studentName, u.username AS studentUsername,
      r.assessment_id AS assessmentId, r.assignment_id AS assignmentId, r.assignment_title AS assignmentTitle,
      r.subject, r.reason, r.original_mark AS originalMark, r.passing_mark AS passingMark,
      r.remediation_date AS remediationDate, r.remediation_time AS remediationTime, r.venue, r.instructions, r.feedback,
      r.attempts, r.attempt_limit AS attemptLimit, r.remediation_mark AS remediationMark, r.status,
      r.file_name AS fileName, r.submitted_at AS submittedAt, r.completed_at AS completedAt,
      r.created_by AS createdBy, r.updated_by AS updatedBy, r.created_at AS createdAt, r.updated_at AS updatedAt
    FROM remediations r JOIN users u ON u.student_id=r.student_id
    WHERE ?='main-admin'
       OR EXISTS (
         SELECT 1 FROM staff_course_assignments sc
         WHERE sc.user_id=? AND sc.active=1 AND sc.academic_year=?
           AND sc.course=u.course AND sc.year_level=u.year_level
       )
    ORDER BY COALESCE(r.remediation_date, '') DESC, r.updated_at DESC
  `, [req.user.role, req.user.id, new Date().getFullYear()]);
  res.json(rows.map(remediationRow));
});

app.get('/student/remediations', requireAuth, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Student access required.' });
  const rows = await all(`
    SELECT
      r.id, r.student_id AS studentId, u.name AS studentName, u.username AS studentUsername,
      r.assessment_id AS assessmentId, r.assignment_id AS assignmentId, r.assignment_title AS assignmentTitle,
      r.subject, r.reason, r.original_mark AS originalMark, r.passing_mark AS passingMark,
      r.remediation_date AS remediationDate, r.remediation_time AS remediationTime, r.venue, r.instructions, r.feedback,
      r.attempts, r.attempt_limit AS attemptLimit, r.remediation_mark AS remediationMark, r.status,
      r.file_name AS fileName, r.submitted_at AS submittedAt, r.completed_at AS completedAt,
      r.created_by AS createdBy, r.updated_by AS updatedBy, r.created_at AS createdAt, r.updated_at AS updatedAt
    FROM remediations r JOIN users u ON u.student_id=r.student_id
    WHERE r.student_id=?
    ORDER BY COALESCE(r.remediation_date, '') DESC, r.updated_at DESC
  `, [req.user.studentId]);
  res.json(rows.map(remediationRow));
});

app.post('/admin/remediations', requireAdmin, async (req, res) => {
  try {
    const studentId = String(req.body?.studentId || '').trim();
    const assessmentId = String(req.body?.assessmentId || '').trim();
    const assignmentTitle = String(req.body?.assignmentTitle || assessmentId).trim();
    if (!studentId || !assessmentId || !assignmentTitle) return res.status(400).json({ error: 'studentId, assessmentId and assignmentTitle are required.' });
    const student = await get("SELECT student_id FROM users WHERE student_id=? AND role='student'", [studentId]);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!(await staffCanManageStudent(req, res, studentId))) return;
    const passingMark = Number(req.body?.passingMark ?? 60);
    const attemptLimit = Number(req.body?.attemptLimit ?? 1);
    if (!Number.isFinite(passingMark) || passingMark < 0 || passingMark > 100) return res.status(400).json({ error: 'Passing mark must be between 0 and 100.' });
    if (!Number.isInteger(attemptLimit) || attemptLimit < 1 || attemptLimit > 10) return res.status(400).json({ error: 'Attempt limit must be between 1 and 10.' });
    const originalMark = req.body?.originalMark == null || req.body?.originalMark === '' ? null : Number(req.body.originalMark);
    if (originalMark != null && (!Number.isFinite(originalMark) || originalMark < 0 || originalMark > 100)) return res.status(400).json({ error: 'Original mark must be between 0 and 100.' });
    const remediation = await upsertRemediationCase({
      studentId,
      assessmentId,
      assignmentId: req.body?.assignmentId == null ? null : String(req.body.assignmentId),
      assignmentTitle,
      subject: req.body?.subject ? String(req.body.subject) : null,
      reason: req.body?.reason === 'missed_deadline' ? 'missed_deadline' : 'failed_mark',
      originalMark,
      passingMark,
      attemptLimit,
      status: REMEDIATION_STATUSES.includes(req.body?.status) ? req.body.status : 'Open',
      createdBy: req.user.id,
    });
    await audit(req.user.id, 'remediation_created', 'remediation', remediation.id, { studentId, assessmentId, reason: remediation.reason });
    res.status(201).json({ ok: true, case: remediation });
  } catch (error) {
    console.error('Create remediation error:', error);
    res.status(500).json({ error: `Could not create remediation: ${error.message}` });
  }
});

app.patch('/admin/remediations/:id', requireAdmin, async (req, res) => {
  try {
    const current = await fetchRemediationById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Remediation case not found.' });
    if (!(await staffCanManageStudent(req, res, current.studentId))) return;
    if (['Completed', 'Resolved'].includes(req.body?.status) && req.user.role !== 'main-admin') {
      return res.status(403).json({ error: 'Only the main administrator can complete or resolve a remediation case.' });
    }
    const fieldMap = { remediationDate: 'remediation_date', remediationTime: 'remediation_time', venue: 'venue', instructions: 'instructions', feedback: 'feedback', attempts: 'attempts', attemptLimit: 'attempt_limit', remediationMark: 'remediation_mark', status: 'status' };
    const fields = [];
    const params = [];
    for (const [input, column] of Object.entries(fieldMap)) {
      if (req.body?.[input] === undefined) continue;
      if (input === 'status' && !REMEDIATION_STATUSES.includes(req.body[input])) return res.status(400).json({ error: 'Invalid remediation status.' });
      if (['attempts', 'attemptLimit'].includes(input)) {
        const value = Number(req.body[input]);
        if (!Number.isInteger(value) || value < 0 || (input === 'attemptLimit' && value < 1) || (input === 'attemptLimit' && value > 10)) return res.status(400).json({ error: `${input} must be a valid whole number.` });
        fields.push(`${column}=?`); params.push(value);
      } else if (input === 'remediationMark') {
        const value = req.body[input] == null || req.body[input] === '' ? null : Number(req.body[input]);
        if (value != null && (!Number.isFinite(value) || value < 0 || value > 100)) return res.status(400).json({ error: 'Remediation mark must be between 0 and 100.' });
        fields.push(`${column}=?`); params.push(value);
      } else {
        fields.push(`${column}=?`); params.push(req.body[input] == null ? null : String(req.body[input]));
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'No remediation changes supplied.' });
    if (req.body?.status === undefined && req.body?.remediationMark != null && req.body?.remediationMark !== '') { fields.push('status=?'); params.push('Marked'); }
    if (req.body?.status === 'Completed') fields.push('completed_at=CURRENT_TIMESTAMP');
    fields.push('updated_by=?'); params.push(req.user.id);
    fields.push('updated_at=CURRENT_TIMESTAMP');
    params.push(req.params.id);
    await run(`UPDATE remediations SET ${fields.join(',')} WHERE id=?`, params);
    const updated = remediationRow(await fetchRemediationById(req.params.id));
    await audit(req.user.id, 'remediation_updated', 'remediation', req.params.id, req.body);
    res.json({ ok: true, case: updated });
  } catch (error) {
    console.error('Update remediation error:', error);
    res.status(500).json({ error: `Could not update remediation: ${error.message}` });
  }
});

app.post('/student/remediations/:id/submit', requireAuth, remediationUpload.single('file'), async (req, res) => {
  try {
    if (req.user.role !== 'student') { if (req.file) fs.rmSync(req.file.path, { force: true }); return res.status(403).json({ error: 'Only students can submit remediation work.' }); }
    const current = await fetchRemediationById(req.params.id);
    if (!current || current.studentId !== req.user.studentId) { if (req.file) fs.rmSync(req.file.path, { force: true }); return res.status(404).json({ error: 'Remediation case not found.' }); }
    if (!['Open', 'Scheduled'].includes(current.status)) { if (req.file) fs.rmSync(req.file.path, { force: true }); return res.status(409).json({ error: `This remediation case is ${current.status.toLowerCase()} and cannot accept another submission.` }); }
    if (Number(current.attempts || 0) >= Number(current.attemptLimit || 1)) { if (req.file) fs.rmSync(req.file.path, { force: true }); return res.status(409).json({ error: 'The allowed remediation attempts have been used.' }); }
    if (!req.file || !/\.zip$/i.test(req.file.originalname)) { if (req.file) fs.rmSync(req.file.path, { force: true }); return res.status(415).json({ error: 'Remediation work must be uploaded as a ZIP file.' }); }
    const attempts = Number(current.attempts || 0) + 1;
    await run(`UPDATE remediations SET attempts=?, status='Submitted', file_name=?, file_path=?, submitted_at=CURRENT_TIMESTAMP, updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [attempts, req.file.originalname, req.file.path, req.user.id, req.params.id]);
    const updated = remediationRow(await fetchRemediationById(req.params.id));
    await audit(req.user.id, 'remediation_submitted', 'remediation', req.params.id, { attempts });
    res.status(201).json({ ok: true, case: updated });
  } catch (error) {
    if (req.file?.path) fs.rmSync(req.file.path, { force: true });
    console.error('Submit remediation error:', error);
    res.status(500).json({ error: `Could not submit remediation: ${error.message}` });
  }
});

app.get('/student/remediations/:id/download', requireAuth, async (req, res) => {
  const row = await fetchRemediationById(req.params.id);
  if (!row || (req.user.role === 'student' && row.studentId !== req.user.studentId)) return res.status(404).send('Remediation file not found');
  if (!row.fileName || !row.id) return res.status(404).send('Remediation file not found');
  const fileRecord = await get('SELECT file_path AS filePath, file_name AS fileName FROM remediations WHERE id=?', [req.params.id]);
  if (!fileRecord?.filePath || !fs.existsSync(fileRecord.filePath)) return res.status(404).send('Remediation file not found');
  const safeRoot = path.resolve(STORAGE_ROOT, 'remediations');
  const safeFile = path.resolve(fileRecord.filePath);
  if (!safeFile.startsWith(`${safeRoot}${path.sep}`)) return res.status(400).send('Invalid remediation file path');
  return res.download(safeFile, fileRecord.fileName || path.basename(safeFile));
});

app.post('/admin/2fa/setup', requireAdmin, async (req, res) => { const secret = speakeasy.generateSecret({ length: 20 }); await run('UPDATE users SET two_factor_secret=? WHERE id=?', [secret.base32, req.user.id]); res.json({ secret: secret.base32, otpauthUrl: secret.otpauth_url }); });
app.post('/admin/2fa/verify', requireAdmin, async (req, res) => { const user = await get('SELECT two_factor_secret FROM users WHERE id=?', [req.user.id]); const ok = !!user?.two_factor_secret && speakeasy.totp.verify({ secret: user.two_factor_secret, encoding: 'base32', token: String(req.body?.token || ''), window: 1 }); res.status(ok ? 200 : 401).json({ verified: ok }); });

module.exports = app;
if (require.main === module) app.listen(PORT, () => console.log(`Server running on port ${PORT}`));