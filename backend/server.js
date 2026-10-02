
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
  seeded,
  installationInfo,
  DATA_ROOT,
  DB_PATH,
  bcrypt
} = require('./db');
const speakeasy = require('speakeasy');

let nodemailer = null;
try {
  // Optional dependency: install in the real deployment with `npm install nodemailer`.
  // The portal still queues remediation email notifications when it is unavailable,
  // allowing the local demo to run without SMTP credentials.
  nodemailer = require('nodemailer');
} catch (_) {
  nodemailer = null;
}

function auditBestEffort(actorId, action, entity, entityId, details) {
  return audit(actorId, action, entity, entityId, details).catch((error) => {
    console.error('Audit log write failed after a committed operation:', error.message);
  });
}
const app = express();
const configuredOrigins = String(process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Only a configured frontend origin is allowed to connect."));
  },
  credentials: true
}));
const allowedOriginCheck = (req, res, next) => {
  const origin = req.get('Origin');
  if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ error: 'This browser origin is not configured for the portal API.' });
  return next();
};
app.use(express.json());
app.use(allowedOriginCheck);
const PORT = process.env.PORT || 5000;
// Uploads live beside the database in the selected installation folder (see PORTAL_DATA_DIR in db.js).
const STORAGE_ROOT = DATA_ROOT;
const SESSION_TTL_MS = Math.max(15 * 60 * 1000, Number(process.env.SESSION_TTL_MINUTES || 480) * 60 * 1000);
const SESSION_COOKIE_NAME = String(process.env.SESSION_COOKIE_NAME || 'session').trim() || 'session';
const SESSION_SAMESITE = String(process.env.SESSION_SAMESITE || 'lax').toLowerCase();
const SESSION_SECURE = process.env.SESSION_SECURE === 'true' || (process.env.SESSION_SECURE !== 'false' && process.env.NODE_ENV === 'production');
const SESSION_DOMAIN = String(process.env.SESSION_DOMAIN || '').trim() || undefined;
const attempts = new Map();
const safeSegment = v => String(v || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
const temporaryUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const directory = path.join(STORAGE_ROOT, 'tmp');
      fs.mkdirSync(directory, { recursive: true });
      cb(null, directory);
    },
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeSegment(path.basename(file.originalname))}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});
const temporaryUploadSafe = (req, res, next) => {
  temporaryUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (req.file?.path) fs.rmSync(req.file.path, { force: true });
    const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({
      error: error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
        ? 'Uploaded file is too large. Maximum file size is 25 MB.'
        : `Upload failed: ${error.message}`
    });
  });
};
const studentImportUpload = (req, res, next) => {
  temporaryUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({
        error: error.code === 'LIMIT_FILE_SIZE'
          ? 'The student-account CSV is too large. Maximum file size is 25 MB.'
          : `Student-account upload failed: ${error.message}`
      });
    }
    return res.status(400).json({ error: `Student-account upload failed: ${error.message}` });
  });
};
const zipUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const directory = path.join(STORAGE_ROOT, 'tmp');
      fs.mkdirSync(directory, { recursive: true });
      cb(null, directory);
    },
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeSegment(path.basename(file.originalname))}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});
const zipUploadSafe = (req, res, next) => {
  zipUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (req.file?.path) fs.rmSync(req.file.path, { force: true });
    const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({
      error: error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
        ? 'ZIP upload is too large. Maximum file size is 25 MB.'
        : `ZIP upload failed: ${error.message}`
    });
  });
};


app.post('/admin/accounts/admin', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      username,
      password,
      temporary = false,
      role = 'admin',
      trustedEmail = null
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

    if (accountRole === 'main-admin') {
      const existingMainAdmin = await get("SELECT id FROM users WHERE role='main-admin' LIMIT 1");
      if (existingMainAdmin) {
        return res.status(409).json({
          error: 'A main administrator already exists. The installation keeps one primary main administrator.'
        });
      }
    }

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

    const normalizedTrustedEmail = typeof trustedEmail === 'string'
      ? trustedEmail.trim().toLowerCase()
      : '';

    if (normalizedTrustedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedTrustedEmail)) {
      return res.status(400).json({ error: 'Enter a valid trusted email address or leave it blank.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await run(
      `INSERT INTO users
       (name, username, password, student_id, role, temporary, trusted_email)
       VALUES (?, ?, ?, NULL, ?, ?, ?)`,
      [
        name.trim(),
        usernameValue,
        passwordHash,
        accountRole,
        accountRole === 'main-admin' ? 0 : (temporary ? 1 : 0),
        normalizedTrustedEmail || null
      ]
    );

    await auditBestEffort(
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
        trusted_email AS trustedEmail,
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


function sessionTokenFromRequest(req) {
  return req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    req.headers.cookie?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1] || null;
}
async function sessionUser(req) {
  const token = sessionTokenFromRequest(req);
  if (!token) return null;
  const row = await get(`
    SELECT u.id,u.name,u.username,u.student_id AS studentId,u.role,u.temporary,
           u.course,u.year_level AS yearLevel,u.trusted_email AS trustedEmail,
           s.expires_at AS sessionExpiresAt
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.id=? AND s.expires_at>? LIMIT 1
  `, [token, new Date().toISOString()]);
  if (!row) {
    try { await run('DELETE FROM sessions WHERE id=?', [token]); } catch (_) {}
    return null;
  }
  row.temporary = Boolean(row.temporary);
  return row;
}
function requireAuth(req, res, next) {
  sessionUser(req).then((user) => {
    if (!user) return res.status(401).json({ error: 'Authentication required.' });
    req.user = user;
    return next();
  }).catch(() => res.status(401).json({ error: 'Authentication required.' }));
}
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => ['admin', 'main-admin'].includes(req.user.role)
    ? next() : res.status(403).json({ error: 'Administrator access required.' }));
}
function requireMainAdmin(req, res, next) {
  requireAuth(req, res, () => req.user.role === 'main-admin'
    ? next() : res.status(403).json({ error: 'Main administrator access required.' }));
}

async function academicYearForAssessment(assessmentId, fallback = new Date().getFullYear()) {
  const value = String(assessmentId || '').trim();
  const defaultYear = Number(fallback) || new Date().getFullYear();
  if (/^ASSIGN-\d+$/.test(value)) {
    const row = await get('SELECT academic_year AS academicYear FROM assignments WHERE id=?', [Number(value.slice(7))]);
    if (row?.academicYear) return Number(row.academicYear);
  }
  if (/^TEST-\d+$/.test(value)) {
    const row = await get('SELECT academic_year AS academicYear FROM tests WHERE id=?', [Number(value.slice(5))]);
    if (row?.academicYear) return Number(row.academicYear);
  }
  return defaultYear;
}

async function academicYearForRemediation(remediation, fallback = new Date().getFullYear()) {
  if (!remediation) return Number(fallback) || new Date().getFullYear();
  if (remediation.assignmentId != null && /^\d+$/.test(String(remediation.assignmentId))) {
    const row = await get('SELECT academic_year AS academicYear FROM assignments WHERE id=?', [Number(remediation.assignmentId)]);
    if (row?.academicYear) return Number(row.academicYear);
  }
  return academicYearForAssessment(remediation.assessmentId, fallback);
}

async function staffCanTeachStudent(user, studentId, academicYear = new Date().getFullYear()) {
  if (user?.role === 'main-admin') return true;
  const student = await get(
    'SELECT course, year_level AS yearLevel FROM users WHERE student_id=? AND role=\'student\'',
    [studentId]
  );
  if (!student?.course || !Number.isInteger(Number(student.yearLevel))) return false;
  const resolvedYear = Number.isInteger(Number(academicYear)) ? Number(academicYear) : new Date().getFullYear();
  const group = await get(`
    SELECT id
    FROM staff_course_assignments
    WHERE user_id=? AND course=? AND year_level=? AND academic_year=? AND active=1
  `, [user.id, student.course, Number(student.yearLevel), resolvedYear]);
  return Boolean(group);
}

async function staffCanManageStudent(req, res, studentId, academicYear = null) {
  if (req.user.role === 'main-admin') return true;
  const resolvedYear = Number.isInteger(Number(academicYear))
    ? Number(academicYear)
    : new Date().getFullYear();
  const allowed = await staffCanTeachStudent(req.user, studentId, resolvedYear);
  if (!allowed) {
    res.status(403).json({
      error: 'This learner is outside your assigned teaching course/year. Choose your teaching group on the Courses page first.'
    });
    return false;
  }
  return true;
}
function sessionCookieOptions() {
  const sameSite = ['lax', 'strict', 'none'].includes(SESSION_SAMESITE) ? SESSION_SAMESITE : 'lax';
  return { httpOnly: true, sameSite, secure: SESSION_SECURE || sameSite === 'none',
    ...(SESSION_DOMAIN ? { domain: SESSION_DOMAIN } : {}), path: '/', maxAge: SESSION_TTL_MS };
}
function sessionClearCookieOptions() {
  const options = sessionCookieOptions(); delete options.maxAge; return options;
}
async function setSession(res, user) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await run('INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,?)', [token, user.id, expiresAt]);
  res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return token;
}
const rate = (key, limit = 10) => { const now = Date.now(), a = attempts.get(key) || []; const recent = a.filter(t => now - t < 15 * 60 * 1000); recent.push(now); attempts.set(key, recent); return recent.length <= limit; };
const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
const csvResponse = (res, filename, headers, rows) => {
  res.type('text/csv').attachment(filename);
  res.send([headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n'));
};

// Uploaded academic work is always received in the shared temporary directory first. A file is
// moved into its designated permanent folder only after the record has passed all validation.
// This makes cleanup safe: a failed request can only remove a temporary file, never a file already
// committed to SQLite.
const remediationUploadSafe = (req, res, next) => {
  temporaryUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (req.file?.path) fs.rmSync(req.file.path, { force: true });
    const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({
      error: error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
        ? 'Remediation work is too large. Maximum file size is 25 MB.'
        : `Remediation upload failed: ${error.message}`
    });
  });
};

const studentCardPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const directory = path.join(STORAGE_ROOT, 'student-cards', 'photos');
      fs.mkdirSync(directory, { recursive: true });
      cb(null, directory);
    },
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(String(file.mimetype || '').toLowerCase())) return cb(null, true);
    return cb(new Error('Student photos must be JPG, PNG or WebP images.'));
  },
});

const studentCardPhotoUploadSafe = (req, res, next) => {
  studentCardPhotoUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (req.file?.path) fs.rmSync(req.file.path, { force: true });
    const status = /file too large|limit/i.test(error.message || '') ? 413 : 400;
    return res.status(status).json({ error: error.message || 'Could not process the student-card photo.' });
  });
};

const STUDENT_CARD_ALLOWED_FIELDS = new Set(['name', 'studentId', 'course', 'yearLevel', 'academicYear']);
const STUDENT_CARD_HEX = /^#[0-9a-f]{6}$/i;
function normalizeStudentCardTemplate(row) {
  if (!row) return null;
  let fields = [];
  try { fields = JSON.parse(row.fields_json || '[]'); } catch (_) { fields = []; }
  fields = Array.isArray(fields) ? fields.filter((field) => STUDENT_CARD_ALLOWED_FIELDS.has(field)) : [];
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    subtitle: row.subtitle || '',
    widthMm: Number(row.width_mm),
    heightMm: Number(row.height_mm),
    background: row.background,
    accent: row.accent,
    textColor: row.text_color,
    showPhoto: Boolean(row.show_photo),
    isDefault: Boolean(row.is_default),
    fields,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function validateStudentCardTemplate(body) {
  const name = String(body?.name || '').trim();
  const title = String(body?.title || '').trim();
  const subtitle = String(body?.subtitle || '').trim();
  const widthMm = Number(body?.widthMm);
  const heightMm = Number(body?.heightMm);
  const background = String(body?.background || '').trim();
  const accent = String(body?.accent || '').trim();
  const textColor = String(body?.textColor || '').trim();
  const fields = Array.isArray(body?.fields) ? [...new Set(body.fields.map((field) => String(field)))] : [];
  if (!name || name.length > 120) return { error: 'Template name is required and must be 120 characters or fewer.' };
  if (!title || title.length > 80) return { error: 'Card title is required and must be 80 characters or fewer.' };
  if (!Number.isFinite(widthMm) || widthMm < 40 || widthMm > 200 || !Number.isFinite(heightMm) || heightMm < 40 || heightMm > 200) return { error: 'Card width and height must each be between 40 mm and 200 mm.' };
  if (![background, accent, textColor].every((value) => STUDENT_CARD_HEX.test(value))) return { error: 'Background, accent and text colours must be valid #RRGGBB values.' };
  if (!fields.length || fields.some((field) => !STUDENT_CARD_ALLOWED_FIELDS.has(field))) return { error: 'Choose at least one supported learner field for the card.' };
  return { value: { name, title, subtitle, widthMm, heightMm, background, accent, textColor, showPhoto: Boolean(body?.showPhoto), fields } };
}
function verifyStudentPhotoSignature(filePath, mimeType) {
  try {
    const bytes = fs.readFileSync(filePath).subarray(0, 12);
    if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (mimeType === 'image/png') return bytes.length >= 8 && bytes.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
    if (mimeType === 'image/webp') return bytes.length >= 12 && bytes.slice(0, 4).toString('ascii') === 'RIFF' && bytes.slice(8, 12).toString('ascii') === 'WEBP';
  } catch (_) { return false; }
  return false;
}
// The photo URL carries the profile's updated_at so a replaced photo gets a new URL. Without it
// the browser kept showing the cached old image after a learner uploaded a new one.
function studentCardPhotoUrl(basePath, updatedAt) {
  return `${basePath}?v=${encodeURIComponent(String(updatedAt || '0'))}`;
}
function studentCardLearnerPayload(row, photoBasePath) {
  return {
    studentId: row.studentId,
    name: row.name,
    username: row.username,
    course: row.course || '',
    yearLevel: row.yearLevel == null ? null : Number(row.yearLevel),
    academicYear: new Date().getFullYear(),
    photoName: row.photoPath ? (row.photoName || null) : null,
    photoUpdatedAt: row.photoPath ? (row.photoUpdatedAt || null) : null,
    photoUrl: row.photoPath ? studentCardPhotoUrl(photoBasePath, row.photoUpdatedAt) : null,
  };
}
const STUDENT_CARD_LEARNER_SELECT = `SELECT u.id AS userId,u.student_id AS studentId,u.name,u.username,u.course,u.year_level AS yearLevel,p.photo_name AS photoName,p.photo_path AS photoPath,p.updated_at AS photoUpdatedAt FROM users u LEFT JOIN student_card_profiles p ON p.student_id=u.student_id`;
async function defaultStudentCardTemplate() {
  return normalizeStudentCardTemplate(await get('SELECT * FROM student_card_templates ORDER BY is_default DESC, name COLLATE NOCASE LIMIT 1'));
}
function removeStudentCardPhotoFile(storedPath) {
  if (!storedPath) return;
  const root = path.resolve(STORAGE_ROOT, 'student-cards', 'photos');
  const filePath = storedFilePath(storedPath);
  if (filePath && filePath.startsWith(`${root}${path.sep}`)) removeStoredFile(filePath);
}

const REMEDIATION_STATUSES = ['Open', 'Scheduled', 'Submitted', 'Marked', 'Completed', 'Cancelled', 'Resolved'];

const EMAIL_MODE = String(process.env.EMAIL_MODE || '').trim().toLowerCase();
const smtpSettings = {
  host: String(process.env.SMTP_HOST || '').trim(),
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
  user: String(process.env.SMTP_USER || '').trim(),
  pass: String(process.env.SMTP_PASS || ''),
  from: String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim(),
};

async function createNotification({ userId, type = 'general', title, message, entityId = null }) {
  if (!userId || !title || !message) return null;
  // Prevent identical bursts from becoming a stack of repeated alerts when an operation is retried
  // or a staff form is saved more than once. A genuinely new event after the short dedupe window is
  // still recorded normally.
  const recent = await get(`
    SELECT id,type,title,message,entity_id AS entityId,read_at AS readAt,created_at AS createdAt
    FROM notifications
    WHERE user_id=? AND type=? AND title=? AND message=?
      AND created_at >= datetime('now','-15 seconds')
    ORDER BY id DESC LIMIT 1
  `, [userId, type, title, message]);
  if (recent) return recent;
  const result = await run(
    `INSERT INTO notifications(user_id,type,title,message,entity_id) VALUES(?,?,?,?,?)`,
    [userId, type, title, message, entityId == null ? null : String(entityId)]
  );
  return get(`SELECT id,type,title,message,entity_id AS entityId,read_at AS readAt,created_at AS createdAt FROM notifications WHERE id=?`, [result.lastID]);
}

// Tells a learner that marked work is waiting for them. A marked copy uploaded while the score is
// still awaiting approval stays hidden, so no alert is sent until the result is published.
async function notifyStudentOfReturnedWork(studentId, assignmentId, assignmentTitle, reason) {
  try {
    const learner = await get("SELECT id FROM users WHERE student_id=? AND role='student'", [studentId]);
    if (!learner) return;
    const mark = await get('SELECT mark,status FROM marks WHERE student_id=? AND assessment_id=?', [studentId, `ASSIGN-${assignmentId}`]);
    if (mark && !['Published', 'Locked'].includes(String(mark.status))) return;
    const title = reason === 'marked-copy' ? 'Marked work returned' : 'Assignment result released';
    const message = reason === 'marked-copy'
      ? `Your marked copy of "${assignmentTitle}" is ready. Open Assignments to download it and reflect on the feedback.`
      : `Your result for "${assignmentTitle}" is available${mark ? ` (${Number(mark.mark)}%)` : ''}. Open Assignments to read the feedback.`;
    await createNotification({ userId: learner.id, type: 'assignment_feedback', title, message, entityId: assignmentId });
  } catch (error) {
    console.error('Could not notify learner about returned work:', error.message);
  }
}

function emailReady() {
  return EMAIL_MODE === 'console' || Boolean(nodemailer && smtpSettings.host && smtpSettings.from);
}

async function sendQueuedEmail(row) {
  if (EMAIL_MODE === 'console') {
    console.log(`[EMAIL DEMO] To: ${row.recipientEmail}\nSubject: ${row.subject}\n\n${row.body}\n`);
    return;
  }
  if (!nodemailer || !smtpSettings.host || !smtpSettings.from) {
    throw new Error('SMTP email is not configured. Set SMTP_HOST, SMTP_FROM and install nodemailer.');
  }
  const transporter = nodemailer.createTransport({
    host: smtpSettings.host,
    port: smtpSettings.port,
    secure: smtpSettings.secure,
    auth: smtpSettings.user ? { user: smtpSettings.user, pass: smtpSettings.pass } : undefined,
  });
  await transporter.sendMail({
    from: smtpSettings.from,
    to: row.recipientEmail,
    subject: row.subject,
    text: row.body,
  });
}

async function queueEmail({ userId, recipientEmail, subject, body, relatedType = null, relatedId = null, dedupeKey = null }) {
  const email = String(recipientEmail || '').trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { queued: false, reason: 'no-valid-email' };
  if (dedupeKey) {
    const existing = await get(`SELECT id,status FROM email_outbox WHERE dedupe_key=?`, [dedupeKey]);
    if (existing) return { queued: true, status: existing.status, id: existing.id, duplicate: true };
  }
  const result = await run(`
    INSERT INTO email_outbox(user_id,recipient_email,subject,body,status,attempts,related_type,related_id,dedupe_key)
    VALUES(?,?,?,?, 'pending',0,?,?,?)
  `, [userId || null, email, subject, body, relatedType, relatedId == null ? null : String(relatedId), dedupeKey]);
  if (emailReady()) {
    try {
      await processEmailOutbox();
    } catch (_) {
      // The outbox remains pending and will be retried by the interval.
    }
  }
  const finalRow = await get(`SELECT id,status FROM email_outbox WHERE id=?`, [result.lastID]);
  return { queued: true, status: finalRow?.status || 'pending', id: result.lastID };
}

let emailProcessing = false;
async function processEmailOutbox() {
  if (emailProcessing) return;
  if (!emailReady()) return;
  emailProcessing = true;
  try {
    const rows = await all(`
      SELECT id,user_id AS userId,recipient_email AS recipientEmail,subject,body,status,attempts,related_type AS relatedType,related_id AS relatedId
      FROM email_outbox
      WHERE status='pending' AND attempts < 5
      ORDER BY created_at ASC
      LIMIT 10
    `);
    for (const row of rows) {
      try {
        await run(`UPDATE email_outbox SET attempts=attempts+1,last_attempt_at=CURRENT_TIMESTAMP WHERE id=?`, [row.id]);
        await sendQueuedEmail(row);
        await run(`UPDATE email_outbox SET status='sent',sent_at=CURRENT_TIMESTAMP,last_error=NULL WHERE id=?`, [row.id]);
      } catch (error) {
        await run(`UPDATE email_outbox SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,last_error=? WHERE id=?`, [String(error.message || error), row.id]);
      }
    }
  } finally {
    emailProcessing = false;
  }
}

async function notifyRemediationStakeholders(remediationId, eventLabel = 'Remediation required') {
  const row = await fetchRemediationById(remediationId);
  if (!row) return { notificationCount: 0, email: null };

  const student = await get(`
    SELECT id,name,username,trusted_email AS trustedEmail,course,year_level AS yearLevel
    FROM users WHERE student_id=? AND role='student'
  `, [row.studentId]);
  if (!student) return { notificationCount: 0, email: null };

  const schedule = row.remediationDate
    ? `${row.remediationDate}${row.remediationTime ? ` at ${row.remediationTime}` : ''}`
    : 'a date to be scheduled by your lecturer/administrator';
  const studentMessage = `${eventLabel}: ${row.assignmentTitle}. Original mark ${row.originalMark ?? '—'}%, passing requirement ${row.passingMark}%. Remediation is scheduled for ${schedule}.`;

  let notificationCount = 0;
  await createNotification({
    userId: student.id,
    type: 'remediation',
    title: eventLabel,
    message: studentMessage,
    entityId: row.id,
  });
  notificationCount += 1;

  const remediationAcademicYear = await academicYearForRemediation(row);
  const staffRows = await all(`
    SELECT DISTINCT u.id,u.name,u.username
    FROM users u
    WHERE u.role='main-admin'
       OR (
         u.role='admin'
         AND EXISTS (
           SELECT 1 FROM staff_course_assignments sc
           WHERE sc.user_id=u.id AND sc.active=1
             AND sc.course=? AND sc.year_level=?
             AND sc.academic_year=?
         )
       )
  `, [student.course, Number(student.yearLevel), remediationAcademicYear]);

  for (const staff of staffRows) {
    await createNotification({
      userId: staff.id,
      type: 'remediation',
      title: eventLabel,
      message: `${student.name} (${student.username}) requires remediation for ${row.assignmentTitle}. ${schedule}.`,
      entityId: row.id,
    });
    notificationCount += 1;
  }

  let email = { queued: false, reason: 'remediation-not-scheduled' };
  if (row.remediationDate) {
    email = await queueEmail({
      userId: student.id,
      recipientEmail: student.trustedEmail,
      subject: `Meridian Learning Hub: remediation ${row.assignmentTitle}`,
      body: `Dear ${student.name},

Your result for ${row.assignmentTitle} requires remediation.

Original mark: ${row.originalMark ?? 'Not available'}%
Passing requirement: ${row.passingMark}%
Remediation date/time: ${schedule}
Venue: ${row.venue || 'To be confirmed'}
Instructions: ${row.instructions || 'Please follow the remediation instructions shown in Meridian Learning Hub.'}

Please sign in to Meridian Learning Hub for the latest remediation information.

This is an automated academic notification.`,
      relatedType: 'remediation',
      relatedId: row.id,
      dedupeKey: `remediation-${row.id}-${row.remediationDate}-${row.remediationTime || ''}`,
    });
  }

  return { notificationCount, email };
}

app.get('/admin/student-cards/templates', requireMainAdmin, async (_req, res) => {
  try {
    const rows = await all('SELECT * FROM student_card_templates ORDER BY name COLLATE NOCASE');
    return res.json(rows.map(normalizeStudentCardTemplate));
  } catch (error) {
    return res.status(500).json({ error: `Could not load student-card templates: ${error.message}` });
  }
});

app.post('/admin/student-cards/templates', requireMainAdmin, async (req, res) => {
  try {
    const validation = validateStudentCardTemplate(req.body);
    if (validation.error) return res.status(400).json({ error: validation.error });
    const t = validation.value;
    const hasDefault = await get('SELECT id FROM student_card_templates WHERE is_default=1 LIMIT 1');
    const result = await run(`INSERT INTO student_card_templates(name,title,subtitle,width_mm,height_mm,background,accent,text_color,show_photo,fields_json,created_by,is_default) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, [t.name,t.title,t.subtitle,t.widthMm,t.heightMm,t.background,t.accent,t.textColor,t.showPhoto ? 1 : 0,JSON.stringify(t.fields),req.user.id,hasDefault ? 0 : 1]);
    const saved = await get('SELECT * FROM student_card_templates WHERE id=?', [result.lastID]);
    await auditBestEffort(req.user.id, 'student_card_template_created', 'student_card_template', saved.id, { name: saved.name });
    return res.status(201).json({ ok: true, template: normalizeStudentCardTemplate(saved) });
  } catch (error) {
    const duplicate = /unique|already exists/i.test(error.message || '');
    return res.status(duplicate ? 409 : 500).json({ error: duplicate ? 'A student-card template with this name already exists.' : `Could not create student-card template: ${error.message}` });
  }
});

app.patch('/admin/student-cards/templates/:id', requireMainAdmin, async (req, res) => {
  try {
    const validation = validateStudentCardTemplate(req.body);
    if (validation.error) return res.status(400).json({ error: validation.error });
    const existing = await get('SELECT * FROM student_card_templates WHERE id=?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Student-card template not found.' });
    const t = validation.value;
    await run(`UPDATE student_card_templates SET name=?,title=?,subtitle=?,width_mm=?,height_mm=?,background=?,accent=?,text_color=?,show_photo=?,fields_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [t.name,t.title,t.subtitle,t.widthMm,t.heightMm,t.background,t.accent,t.textColor,t.showPhoto ? 1 : 0,JSON.stringify(t.fields),req.params.id]);
    const saved = await get('SELECT * FROM student_card_templates WHERE id=?', [req.params.id]);
    await auditBestEffort(req.user.id, 'student_card_template_updated', 'student_card_template', req.params.id, { name: saved.name });
    return res.json({ ok: true, template: normalizeStudentCardTemplate(saved) });
  } catch (error) {
    const duplicate = /unique|already exists/i.test(error.message || '');
    return res.status(duplicate ? 409 : 500).json({ error: duplicate ? 'A student-card template with this name already exists.' : `Could not update student-card template: ${error.message}` });
  }
});

app.post('/admin/student-cards/templates/:id/default', requireMainAdmin, async (req, res) => {
  try {
    const existing = await get('SELECT id,name FROM student_card_templates WHERE id=?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Student-card template not found.' });
    await transaction(async () => {
      await run('UPDATE student_card_templates SET is_default=0 WHERE is_default=1 AND id<>?', [existing.id]);
      await run('UPDATE student_card_templates SET is_default=1 WHERE id=?', [existing.id]);
    });
    await auditBestEffort(req.user.id, 'student_card_template_default', 'student_card_template', existing.id, { name: existing.name });
    const rows = await all('SELECT * FROM student_card_templates ORDER BY name COLLATE NOCASE');
    return res.json({ ok: true, templates: rows.map(normalizeStudentCardTemplate) });
  } catch (error) {
    return res.status(500).json({ error: `Could not set the default student-card template: ${error.message}` });
  }
});

app.delete('/admin/student-cards/templates/:id', requireMainAdmin, async (req, res) => {
  try {
    const existing = await get('SELECT id,name,is_default AS isDefault FROM student_card_templates WHERE id=?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Student-card template not found.' });
    await transaction(async () => {
      await run('DELETE FROM student_card_templates WHERE id=?', [req.params.id]);
      // Never leave the institution without an approved design while other templates exist.
      if (existing.isDefault) await run('UPDATE student_card_templates SET is_default=1 WHERE id=(SELECT id FROM student_card_templates ORDER BY name COLLATE NOCASE LIMIT 1)');
    });
    await auditBestEffort(req.user.id, 'student_card_template_deleted', 'student_card_template', req.params.id, { name: existing.name });
    return res.json({ ok: true, id: existing.id });
  } catch (error) {
    return res.status(500).json({ error: `Could not delete student-card template: ${error.message}` });
  }
});

app.get('/admin/student-cards/students', requireMainAdmin, async (_req, res) => {
  try {
    const rows = await all(`${STUDENT_CARD_LEARNER_SELECT} WHERE u.role='student' ORDER BY u.name COLLATE NOCASE`);
    return res.json(rows.map((row) => studentCardLearnerPayload(row, `/admin/student-cards/students/${encodeURIComponent(row.studentId)}/photo`)));
  } catch (error) {
    return res.status(500).json({ error: `Could not load student-card learners: ${error.message}` });
  }
});

async function sendStudentCardPhoto(req, res, isStudentRoute = false) {
  const studentId = isStudentRoute ? req.user.studentId : String(req.params.studentId || '').trim();
  if (!studentId) return res.status(400).json({ error: 'Student ID is required.' });
  const record = await get('SELECT student_id AS studentId,photo_name AS photoName,photo_path AS photoPath FROM student_card_profiles WHERE student_id=?', [studentId]);
  if (!record?.photoPath) return res.status(404).send('Student photo not found.');
  const safeRoot = path.resolve(STORAGE_ROOT, 'student-cards', 'photos');
  const safeFile = storedFilePath(record.photoPath);
  if (!safeFile || !safeFile.startsWith(`${safeRoot}${path.sep}`)) return res.status(400).send('Invalid student photo path.');
  if (!fs.existsSync(safeFile)) return res.status(404).send('Student photo not found.');
  // URLs are versioned (?v=updated_at), so a cached copy is always the current photo.
  return res.sendFile(safeFile, { headers: { 'Cache-Control': 'private, max-age=300' } });
}

async function studentCardSelf(userId) {
  const row = await get(`${STUDENT_CARD_LEARNER_SELECT} WHERE u.id=? AND u.role='student'`, [userId]);
  if (!row) return null;
  return { ...studentCardLearnerPayload(row, '/student/student-card/photo'), template: await defaultStudentCardTemplate() };
}

app.get('/student/student-card', requireAuth, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Student access required.' });
  try {
    const profile = await studentCardSelf(req.user.id);
    if (!profile) return res.status(404).json({ error: 'Student account not found.' });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: `Could not load student-card profile: ${error.message}` });
  }
});

app.post('/student/student-card/photo', requireAuth, studentCardPhotoUploadSafe, async (req, res) => {
  let committed = false;
  try {
    if (req.user.role !== 'student') { if (req.file) fs.rmSync(req.file.path, { force: true }); return res.status(403).json({ error: 'Only students can upload their own student-card photo.' }); }
    if (!req.file || !verifyStudentPhotoSignature(req.file.path, req.file.mimetype)) { if (req.file) fs.rmSync(req.file.path, { force: true }); return res.status(415).json({ error: 'The uploaded file is not a recognised JPG, PNG or WebP image.' }); }
    const existing = await get('SELECT photo_path AS photoPath FROM student_card_profiles WHERE student_id=?', [req.user.studentId]);
    const photoPath = storedRelativePath(req.file.path);
    if (!photoPath) throw new Error('The student-card photo path is outside the application storage directory.');
    // Millisecond timestamp so a replacement within the same second still gets a fresh photo URL.
    const updatedAt = new Date().toISOString();
    await transaction(async () => {
      await run(`INSERT INTO student_card_profiles(student_id,photo_name,photo_path,updated_at) VALUES(?,?,?,?) ON CONFLICT(student_id) DO UPDATE SET photo_name=excluded.photo_name,photo_path=excluded.photo_path,updated_at=excluded.updated_at`, [req.user.studentId, path.basename(req.file.originalname), photoPath, updatedAt]);
    });
    committed = true;
    if (existing?.photoPath && existing.photoPath !== photoPath) removeStudentCardPhotoFile(existing.photoPath);
    await auditBestEffort(req.user.id, 'student_card_photo_updated', 'student_card_profile', req.user.studentId, { fileName: path.basename(req.file.originalname) });
    res.status(201).json(await studentCardSelf(req.user.id));
  } catch (error) {
    if (req.file?.path && !committed) fs.rmSync(req.file.path, { force: true });
    console.error('Student-card photo upload error:', error);
    res.status(500).json({ error: `Could not save student-card photo: ${error.message}` });
  }
});

app.delete('/student/student-card/photo', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can remove their own student-card photo.' });
    const existing = await get('SELECT photo_path AS photoPath FROM student_card_profiles WHERE student_id=?', [req.user.studentId]);
    await run('DELETE FROM student_card_profiles WHERE student_id=?', [req.user.studentId]);
    removeStudentCardPhotoFile(existing?.photoPath);
    if (existing) await auditBestEffort(req.user.id, 'student_card_photo_removed', 'student_card_profile', req.user.studentId, {});
    res.json(await studentCardSelf(req.user.id));
  } catch (error) {
    res.status(500).json({ error: `Could not remove student-card photo: ${error.message}` });
  }
});

app.get('/student/student-card/photo', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).send('Student access required');
    return await sendStudentCardPhoto(req, res, true);
  } catch (error) {
    if (!res.headersSent) return res.status(500).send('Could not load student photo');
  }
});

app.get('/admin/student-cards/students/:studentId/photo', requireMainAdmin, async (req, res) => {
  try { return await sendStudentCardPhoto(req, res, false); } catch (error) { if (!res.headersSent) return res.status(500).send('Could not load student photo'); }
});

// Lets the main administrator reject an unsuitable photo (wrong person, not a face, low quality).
// The learner is notified with the reason so they can upload a replacement straight away.
app.delete('/admin/student-cards/students/:studentId/photo', requireMainAdmin, async (req, res) => {
  try {
    const studentId = String(req.params.studentId || '').trim();
    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    const learner = await get(`${STUDENT_CARD_LEARNER_SELECT} WHERE u.student_id=? AND u.role='student'`, [studentId]);
    if (!learner) return res.status(404).json({ error: 'Student not found.' });
    if (!learner.photoPath) return res.status(404).json({ error: 'This learner has no student-card photo to remove.' });
    await run('DELETE FROM student_card_profiles WHERE student_id=?', [studentId]);
    removeStudentCardPhotoFile(learner.photoPath);
    await auditBestEffort(req.user.id, 'student_card_photo_rejected', 'student_card_profile', studentId, { reason });
    await createNotification({
      userId: learner.userId,
      type: 'student-card',
      title: 'Please upload a new student-card photo',
      message: `Your student-card photo was removed by the main administrator.${reason ? ` Reason: ${reason}` : ''} Upload a new photo from your profile page.`,
    }).catch(() => null);
    return res.json(studentCardLearnerPayload({ ...learner, photoPath: null }, ''));
  } catch (error) {
    return res.status(500).json({ error: `Could not remove the student-card photo: ${error.message}` });
  }
});

app.get('/api/notifications', requireAuth, async (req,res)=>{
  try {
    const rows = await all(`
      SELECT id,type,title,message,entity_id AS entityId,read_at AS readAt,created_at AS createdAt
      FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100
    `, [req.user.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: `Could not load notifications: ${error.message}` });
  }
});

app.delete('/api/notifications', requireAuth, async (req,res)=>{
  try {
    await run('DELETE FROM notifications WHERE user_id=?', [req.user.id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: `Could not clear notifications: ${error.message}` });
  }
});

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
    latestAttemptNumber: Number(row.attempts || 0) > 0 ? Number(row.attempts) : null,
    attemptsRemaining: Math.max(Number(row.attemptLimit || 1) - Number(row.attempts || 0), 0),
    latestAttemptStatus: row.attempts > 0 && row.remediationMark != null
      ? (Number(row.remediationMark) >= Number(row.passingMark ?? 60) ? 'Passed' : 'Failed')
      : (row.status === 'Submitted' ? 'Submitted' : null),
    downloadUrl: row.id && row.fileName ? `/student/remediations/${row.id}/download` : null,
    staffDownloadUrl: row.id && row.fileName ? `/admin/remediations/${row.id}/download` : null,
    attemptsUrl: row.id ? `/admin/remediations/${row.id}/attempts` : null,
  };
}

function testAttemptRow(row, forStudent = false) {
  if (!row) return null;
  let essayAnswers = [];
  let questionMarks = [];
  let questionFeedback = [];
  let answers = {};
  let questionSnapshot = [];
  try { essayAnswers = row.essayAnswers ? JSON.parse(row.essayAnswers) : []; } catch (_) { essayAnswers = []; }
  try { questionMarks = row.questionMarks ? JSON.parse(row.questionMarks) : []; } catch (_) { questionMarks = []; }
  try { questionFeedback = row.questionFeedback ? JSON.parse(row.questionFeedback) : []; } catch (_) { questionFeedback = []; }
  try { answers = row.answersJson ? JSON.parse(row.answersJson) : {}; } catch (_) { answers = {}; }
  try { questionSnapshot = row.questionSnapshot ? JSON.parse(row.questionSnapshot) : []; } catch (_) { questionSnapshot = []; }
  if (!Array.isArray(essayAnswers)) essayAnswers = [];
  if (!Array.isArray(questionMarks)) questionMarks = [];
  if (!Array.isArray(questionFeedback)) questionFeedback = [];
  if (!Array.isArray(questionSnapshot)) questionSnapshot = [];
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) answers = {};
  const result = {
    id: row.id,
    testId: String(row.testId),
    studentId: row.studentId,
    studentName: row.studentName || '',
    course: row.course || '',
    yearLevel: row.yearLevel == null ? null : Number(row.yearLevel),
    attemptNumber: Number(row.attemptNumber),
    score: Number(row.score),
    earnedPoints: row.earnedPoints == null ? 0 : Number(row.earnedPoints),
    totalPoints: row.totalPoints == null ? Number(row.total || 0) : Number(row.totalPoints),
    correct: Number(row.correct || 0),
    total: Number(row.total || 0),
    questionMarks,
    answers,
    needsReview: Boolean(row.needsReview),
    isRemediation: Boolean(row.isRemediation),
    passed: row.passed == null ? null : Boolean(row.passed),
    essayAnswers,
    reviewFeedback: row.reviewFeedback || '',
    reviewedBy: row.reviewedBy || null,
    reviewedAt: row.reviewedAt || null,
    takenAt: row.takenAt || row.createdAt || null,
  };
  // The full saved question snapshot contains MCQ correct-answer indexes and essay model answers.
  // Never send it to the student, even though the student owns the attempt.
  if (!forStudent) result.questionSnapshot = questionSnapshot;
  if (!forStudent) result.questionFeedback = questionFeedback;
  return result;
}

function studentSafeQuestions(questions) {
  return (Array.isArray(questions) ? questions : []).map((question) => {
    const base = { type: question.type === 'essay' ? 'essay' : 'mcq', question: String(question.question || ''), points: Number(question.points || 1) };
    if (base.type === 'essay') return base;
    return { ...base, options: Array.isArray(question.options) ? question.options.map((option) => String(option)) : [] };
  });
}

function testAttemptSessionRow(row, forStudent = false) {
  if (!row) return null;
  let snapshot = [];
  try { snapshot = row.questionSnapshotJson ? JSON.parse(row.questionSnapshotJson) : []; } catch (_) { snapshot = []; }
  if (!Array.isArray(snapshot)) snapshot = [];
  return {
    id: row.id,
    testId: String(row.testId),
    studentId: row.studentId,
    attemptNumber: Number(row.attemptNumber),
    isRemediation: Boolean(row.isRemediation),
    startedAt: row.startedAt,
    expiresAt: row.expiresAt,
    status: row.status,
    questions: forStudent ? studentSafeQuestions(snapshot) : snapshot,
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
    const install = await installationInfo();
    res.json({ setupRequired: users === 0, users, installId: install.installId, demo: install.demo });
  } catch (error) {
    console.error('Setup status error:', error);
    res.status(500).json({ error: 'Could not determine the installation setup status.' });
  }
});

app.post('/api/setup/create-main-admin', async (req, res) => {
  try {
    const { name, username, password, trustedEmail = null } = req.body || {};
    const normalizedTrustedEmail = typeof trustedEmail === 'string' ? trustedEmail.trim().toLowerCase() : '';

    if (normalizedTrustedEmail && !/^\S+@\S+\.\S+$/.test(normalizedTrustedEmail)) {
      return res.status(400).json({ error: 'Enter a valid trusted email address or leave it blank.' });
    }

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
        trustedEmail: normalizedTrustedEmail || null,
      });
    });

    const account = await get(`
      SELECT id, name, username, student_id AS studentId, role, temporary, trusted_email AS trustedEmail, course, year_level AS yearLevel
      FROM users
      WHERE id=?
    `, [created.id]);

    setSession(res, account);
    try {
      await auditBestEffort(account.id, 'initial_setup_completed', 'user', account.id, { username: account.username });
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

app.post('/admin/accounts/students/import', requireAdmin, studentImportUpload, async (req, res) => {
  const cleanup = () => { if (req.file?.path) fs.rmSync(req.file.path, { force: true }); };
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a CSV file containing student accounts.' });
    if (!/\.csv$/i.test(req.file.originalname)) return res.status(415).json({ error: 'Only .csv student account files are accepted.' });
    const parsed = await parseCsv(req.file.path);
    const headers = parsed.headers.map((header) => String(header).trim().toLowerCase().replace(/\s+/g, ''));
    const required = ['name','username','password','studentid','course','yearlevel'];
    const missing = required.filter((name) => !headers.includes(name));
    if (missing.length) return res.status(422).json({ imported: 0, errors: [{ row: 1, error: `Missing required column(s): ${missing.join(', ')}` }] });
    if (!parsed.rows.length) return res.status(422).json({ imported: 0, errors: [{ row: 1, error: 'CSV contains no student rows.' }] });
    if (parsed.rows.length > 1000) return res.status(413).json({ imported: 0, errors: [{ row: 1, error: 'Student account imports are limited to 1000 rows per file.' }] });

    const errors = [];
    const seenUsernames = new Set();
    const seenStudentIds = new Set();
    const prepared = [];
    for (let index = 0; index < parsed.rows.length; index += 1) {
      const rawRow = parsed.rows[index];
      const line = index + 2;
      const normalizedRow = Object.fromEntries(Object.entries(rawRow).map(([key, value]) => [String(key).trim().toLowerCase().replace(/[^a-z0-9]/g, ''), value]));
      const valueFor = (...keys) => keys.map((key) => normalizedRow[String(key).toLowerCase().replace(/[^a-z0-9]/g, '')]).find((value) => value !== undefined);
      const name = String(valueFor('name') || '').trim();
      const username = String(valueFor('username') || '').trim().toLowerCase();
      const password = String(valueFor('password') || '');
      const studentId = String(valueFor('studentId') || '').trim();
      const trustedEmail = String(valueFor('trustedEmail', 'email') || '').trim().toLowerCase();
      const course = String(valueFor('course') || '').trim();
      const yearLevel = Number.parseInt(valueFor('yearLevel'), 10);
      const teacherUsername = String(valueFor('teacherUsername') || '').trim().toLowerCase();
      const teacherIdValue = Number.parseInt(valueFor('teacherId'), 10);
      const academicYear = Number.parseInt(valueFor('academicYear'), 10) || new Date().getFullYear();

      if (!name || !username || !password || !studentId || !course) errors.push({ row: line, error: 'Name, username, password, student ID and course are required.' });
      if (password.length < 8) errors.push({ row: line, error: 'Password must be at least 8 characters.' });
      if (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 6) errors.push({ row: line, error: 'Year of study must be between 1 and 6.' });
      if (!Number.isInteger(academicYear) || academicYear < 2000 || academicYear > 2100) errors.push({ row: line, error: 'Academic year must be between 2000 and 2100.' });
      if (trustedEmail && !/^\S+@\S+\.\S+$/.test(trustedEmail)) errors.push({ row: line, error: 'Trusted email address is invalid.' });
      const usernameKey = username.toLowerCase();
      const studentIdKey = studentId.toLowerCase();
      if (seenUsernames.has(usernameKey)) errors.push({ row: line, error: 'Duplicate username inside the import file.' });
      if (seenStudentIds.has(studentIdKey)) errors.push({ row: line, error: 'Duplicate student ID inside the import file.' });
      seenUsernames.add(usernameKey); seenStudentIds.add(studentIdKey);
      const existingUser = username ? await get('SELECT id FROM users WHERE LOWER(username)=LOWER(?)', [username]) : null;
      const existingStudent = studentId ? await get('SELECT id FROM users WHERE LOWER(student_id)=LOWER(?)', [studentId]) : null;
      if (existingUser) errors.push({ row: line, error: 'That username already exists.' });
      if (existingStudent) errors.push({ row: line, error: 'That student ID is already registered.' });

      const courseExists = course ? await findCourse(course) : null;
      if (!courseExists) errors.push({ row: line, error: 'Choose a course from the current course catalogue.' });

      let teacher = null;
      if (teacherUsername) teacher = await get('SELECT id,name,username,role FROM users WHERE LOWER(username)=LOWER(?)', [teacherUsername]);
      else if (Number.isInteger(teacherIdValue) && teacherIdValue > 0) teacher = await get('SELECT id,name,username,role FROM users WHERE id=?', [teacherIdValue]);
      if (!teacher || teacher.role !== 'admin') errors.push({ row: line, error: 'teacherUsername or teacherId must identify a valid administrator/teacher account.' });
      const normalizedTeacherId = Number(teacher?.id || 0);
      if (teacher && course && Number.isInteger(yearLevel) && Number.isInteger(academicYear)) {
        const teacherGroup = await get(`SELECT id FROM staff_course_assignments WHERE user_id=? AND course=? AND year_level=? AND academic_year=? AND active=1`, [normalizedTeacherId, course, yearLevel, academicYear]);
        if (!teacherGroup) errors.push({ row: line, error: 'The selected teacher is not assigned to that course/year group.' });
        if (req.user.role === 'admin') {
          const creatorGroup = await get(`SELECT id FROM staff_course_assignments WHERE user_id=? AND course=? AND year_level=? AND academic_year=? AND active=1`, [req.user.id, course, yearLevel, academicYear]);
          if (!creatorGroup) errors.push({ row: line, error: 'You may only import learners into one of your assigned course/year groups.' });
          else if (normalizedTeacherId !== Number(req.user.id)) {
            const selectedTeacherGroup = await get(`SELECT id FROM staff_course_assignments WHERE user_id=? AND course=? AND year_level=? AND academic_year=? AND active=1`, [normalizedTeacherId, course, yearLevel, academicYear]);
            if (!selectedTeacherGroup) errors.push({ row: line, error: 'That teacher is not allocated to your selected teaching group.' });
          }
        }
      }
      if (!errors.some((item) => item.row === line)) {
        prepared.push({ name, username, password, studentId, course, yearLevel, trustedEmail: trustedEmail || null, teacherId: normalizedTeacherId, teacherName: teacher?.name || '', teacherUsername: teacher?.username || '', academicYear });
      }
    }

    if (errors.length) return res.status(422).json({ imported: 0, errors });

    const created = await transaction(async () => {
      const accounts = [];
      for (const item of prepared) {
        const account = await createStudent({ name: item.name, username: item.username, password: item.password, studentId: item.studentId, course: item.course, yearLevel: item.yearLevel, trustedEmail: item.trustedEmail });
        await run(`INSERT INTO student_teacher_assignments(student_id,teacher_user_id,academic_year,active) VALUES(?,?,?,1) ON CONFLICT(student_id,academic_year) DO UPDATE SET teacher_user_id=excluded.teacher_user_id,active=1,updated_at=CURRENT_TIMESTAMP`, [account.studentId, item.teacherId, item.academicYear]);
        accounts.push({ ...account, teacherId: item.teacherId, teacherName: item.teacherName, teacherUsername: item.teacherUsername, academicYear: item.academicYear });
      }
      return accounts;
    });

    for (const account of created) await auditBestEffort(req.user.id, 'student_created_bulk', 'user', account.id, { username: account.username, studentId: account.studentId, course: account.course, yearLevel: account.yearLevel, academicYear: account.academicYear });
    return res.status(201).json({ imported: created.length, created });
  } catch (error) {
    console.error('Bulk student import error:', error);
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'The student-account CSV is too large. Maximum file size is 25 MB.' : `Student-account upload failed: ${error.message}` });
    }
    if (error?.code === 'CSV_RECORD_DONT_MATCH_COLUMNS_LENGTH' || /column.*length|row.*columns|strict/i.test(String(error?.message || ''))) {
      return res.status(422).json({ imported: 0, errors: [{ row: 1, error: `The CSV structure is invalid: ${error.message}` }] });
    }
    return res.status(error.code === 'SQLITE_CONSTRAINT' ? 409 : 500).json({ error: error.code === 'SQLITE_CONSTRAINT' ? 'One or more student accounts conflict with existing data.' : `Could not import student accounts: ${error.message}` });
  } finally {
    cleanup();
  }
});

app.post('/api/accounts/students', async (req, res) => {
  try {
    const {
      name,
      username,
      password,
      studentId,
      trustedEmail = null,
      course,
      yearLevel,
    } = req.body || {};

    // Public registration is available only after the initial main administrator exists.
    // The first-admin bootstrap remains the only path on a zero-user database.
    const userCount = await get('SELECT COUNT(*) AS count FROM users');
    if (Number(userCount?.count || 0) === 0) {
      return res.status(403).json({ error: 'Initial system setup must be completed before students can register.' });
    }

    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const normalizedStudentId = typeof studentId === 'string' ? studentId.trim() : '';
    const normalizedEmail = typeof trustedEmail === 'string' ? trustedEmail.trim().toLowerCase() : '';
    const normalizedCourse = typeof course === 'string' ? course.trim() : '';
    const normalizedYear = Number.parseInt(yearLevel, 10);

    if (!normalizedName || !normalizedUsername || typeof password !== 'string' || !password || !normalizedStudentId || !normalizedEmail || !normalizedCourse) {
      return res.status(400).json({ error: 'Name, username, password, student ID, trusted email and course are required.' });
    }
    if (normalizedName.length > 160) return res.status(400).json({ error: 'Name is too long.' });
    if (!/^[A-Za-z0-9._-]{3,100}$/.test(normalizedUsername)) return res.status(400).json({ error: 'Username must be 3–100 characters and use only letters, numbers, dots, underscores or hyphens.' });
    if (password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Password must be 8–200 characters.' });
    if (!/^[A-Za-z0-9_-]+$/.test(normalizedStudentId)) return res.status(400).json({ error: 'Student ID may contain only letters, numbers, underscores and hyphens.' });
    if (normalizedStudentId.length > 80) return res.status(400).json({ error: 'Student ID is too long.' });
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return res.status(400).json({ error: 'Enter a valid trusted email address.' });
    if (!Number.isInteger(normalizedYear) || normalizedYear < 1 || normalizedYear > 6) return res.status(400).json({ error: 'Year of study must be between 1 and 6.' });

    const registrationKey = `${req.ip}:student-register`;
    if (!rate(registrationKey, 5)) return res.status(429).json({ error: 'Too many registration attempts. Try again later.' });

    if (!(await findCourse(normalizedCourse))) return res.status(400).json({ error: 'Choose a course from the current course catalogue.' });

    const created = await createStudent({
      name: normalizedName,
      username: normalizedUsername,
      password,
      studentId: normalizedStudentId,
      trustedEmail: normalizedEmail,
      course: normalizedCourse,
      yearLevel: normalizedYear,
    });

    await auditBestEffort(null, 'student_self_registered', 'user', created.id, {
      username: created.username,
      studentId: created.studentId,
      course: created.course,
      yearLevel: created.yearLevel,
    });

    return res.status(201).json(created);
  } catch (error) {
    console.error('Student self-registration failed:', error);
    const message = String(error?.message || '');
    if (/already exists|already registered/i.test(message) || error?.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: message || 'That username or student ID already exists.' });
    }
    if (/selected course does not exist|course.*catalogue|year of study/i.test(message)) {
      return res.status(400).json({ error: message });
    }
    return res.status(500).json({ error: 'Could not create the student account.' });
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
      teacherId,
      trustedEmail = null
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
    const academicYear = Number.parseInt(req.body?.academicYear, 10) || new Date().getFullYear();
    if (!Number.isInteger(academicYear) || academicYear < 2000 || academicYear > 2100) return res.status(400).json({ error: 'Academic year must be between 2000 and 2100.' });
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
        yearLevel: normalizedYear,
        trustedEmail: typeof trustedEmail === 'string' ? trustedEmail.trim() : null
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

    await auditBestEffort(
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
  const user = await findUser(String(username).trim().toLowerCase(), password);
  if (!user) return res.status(401).json({ error: 'Those details do not match a local account.' });
  await setSession(res, user);
  res.json(user);
});
// Lets the frontend restore the signed-in user after a page refresh: the browser still
// holds the HttpOnly session cookie, but React state resets on reload, so without this
// endpoint the app had no way to know a session was still valid and always fell back to
// the login screen.
// Resolves the staff a learner should be able to see, in priority order:
//   1. the lecturer explicitly allocated to them for an academic year, then
//   2. any staff who teach their course/year group (covers self-registered learners and
//      learners imported before allocation ran, who have no explicit allocation row), then
//   3. the institute administrators, who are always a valid escalation route.
// Without layer 2 a learner whose account was never processed by the bulk import saw
// "Not assigned" even though staff were allocated to their course.
async function resolveSupportTeam({ studentId, course, yearLevel }) {
  const currentYear = new Date().getFullYear();

  // Prefer the most recent allocation that has already started; otherwise fall forward to the
  // nearest future one, so an allocation made early for next year is still visible.
  const allocated = studentId
    ? await get(`
      SELECT t.id,t.name,t.username,t.role,sta.academic_year AS academicYear
      FROM student_teacher_assignments sta
      JOIN users t ON t.id=sta.teacher_user_id
      WHERE sta.student_id=? AND sta.active=1
      ORDER BY CASE WHEN sta.academic_year<=? THEN 0 ELSE 1 END,
               ABS(sta.academic_year-?)
      LIMIT 1
    `, [studentId, currentYear, currentYear])
    : null;

  const courseStaff = course && yearLevel
    ? await all(`
      SELECT u.id,u.name,u.username,u.role,
             sc.course,sc.year_level AS yearLevel,sc.academic_year AS academicYear
      FROM staff_course_assignments sc
      JOIN users u ON u.id=sc.user_id
      WHERE sc.active=1 AND sc.course=? AND sc.year_level=?
      ORDER BY CASE WHEN sc.academic_year<=? THEN 0 ELSE 1 END,
               ABS(sc.academic_year-?),u.name
    `, [course, yearLevel, currentYear, currentYear])
    : [];

  const administrators = await all(
    `SELECT id,name,username,role FROM users WHERE role='main-admin' ORDER BY name`
  );

  const advisorRow = allocated || courseStaff[0] || null;
  const advisor = advisorRow
    ? { ...advisorRow, source: allocated ? 'allocated' : 'course-team' }
    : null;

  return {
    advisor,
    courseStaff,
    administrators,
    course: course || null,
    yearLevel: yearLevel || null,
    academicYear: advisor?.academicYear || currentYear,
  };
}

app.get('/api/accounts/me', requireAuth, async (req, res) => {
  const row = await get(`
    SELECT u.id,u.name,u.username,u.student_id AS studentId,u.role,u.temporary,
           u.trusted_email AS trustedEmail,u.course,u.year_level AS yearLevel
    FROM users u
    WHERE u.id=?
  `, [req.user.id]);
  if (!row) return res.status(404).json({ error: 'Account not found.' });
  row.temporary = Boolean(row.temporary);

  if (row.role === 'student') {
    const { advisor } = await resolveSupportTeam(row);
    row.teacherId = advisor?.id || null;
    row.teacherName = advisor?.name || null;
    row.teacherUsername = advisor?.username || null;
    row.teacherAcademicYear = advisor?.academicYear || null;
    row.teacherSource = advisor?.source || null;
  }

  res.json(row);
});

// Student-facing view of who is responsible for them. Previously no student-accessible route
// returned this at all: /admin/data carries the allocations but is staff-only, so the portal
// had no way to show a learner their lecturer or an administrator to contact.
app.get('/api/accounts/support-team', requireAuth, async (req, res) => {
  const row = await get(
    `SELECT student_id AS studentId,course,year_level AS yearLevel,role FROM users WHERE id=?`,
    [req.user.id]
  );
  if (!row) return res.status(404).json({ error: 'Account not found.' });
  if (row.role !== 'student') {
    return res.json({ advisor: null, courseStaff: [], administrators: [], course: null, yearLevel: null, academicYear: new Date().getFullYear() });
  }
  res.json(await resolveSupportTeam(row));
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

    const trustedEmail = typeof req.body?.trustedEmail === 'string'
      ? req.body.trustedEmail.trim().toLowerCase()
      : typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';

    if (trustedEmail && !/^\S+@\S+\.\S+$/.test(trustedEmail)) {
      return res.status(400).json({ error: 'Enter a valid trusted email address or leave it blank.' });
    }

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

    if (req.user.role === 'student') {
      if (!studentId) return res.status(400).json({ error: 'Student ID is required for student accounts.' });
      if (!/^[A-Za-z0-9_-]+$/.test(studentId) || studentId.length > 80) {
        return res.status(400).json({ error: 'Student ID may contain only letters, numbers, underscores and hyphens and must be at most 80 characters.' });
      }
      const existingStudentId = await get(
        'SELECT id FROM users WHERE LOWER(student_id)=LOWER(?) AND id<>?',
        [studentId, req.user.id]
      );
      if (existingStudentId) return res.status(409).json({ error: 'That student ID is already in use.' });
    }

    await run(
      `UPDATE users
       SET name=?,
           username=?,
           student_id=?,
           trusted_email=?
       WHERE id=?`,
      [
        name,
        username,
        req.user.role === 'student' ? studentId : null,
        trustedEmail || null,
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
         trusted_email AS trustedEmail,
         course,
         year_level AS yearLevel
       FROM users
       WHERE id=?`,
      [req.user.id]
    );

    updated.temporary = Boolean(updated.temporary);
    await auditBestEffort(
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
            : null,
        trustedEmail: trustedEmail || null
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

// Student academic scope is deliberately staff-managed. The route is retained only as an
// explicit guard for older clients that may still attempt the former self-service operation.
// It never changes the student's course or year.
app.patch('/api/accounts/course', requireAuth, async (_req, res) => {
  return res.status(403).json({
    error: 'Student course changes are disabled. An administrator must assign the learner to a teaching course/year group.'
  });
});

app.post('/api/accounts/logout', async (req, res) => {
  try {
    const token = sessionTokenFromRequest(req);
    if (token) await run('DELETE FROM sessions WHERE id=?', [token]);
  } catch (_) {}
  res.clearCookie(SESSION_COOKIE_NAME, sessionClearCookieOptions());
  res.json({ ok: true });
});
app.post('/api/accounts/logout-all', requireAuth, async (req, res) => {
  await run('DELETE FROM sessions WHERE user_id=?', [req.user.id]);
  res.clearCookie(SESSION_COOKIE_NAME, sessionClearCookieOptions());
  res.json({ ok: true });
});
app.patch('/api/accounts/password', requireAuth, async (req, res) => {
  try {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current password and new password are required.' });
    if (newPassword.length < 8 || newPassword.length > 200) return res.status(400).json({ error: 'Password must be 8–200 characters.' });
    if (currentPassword === newPassword) return res.status(400).json({ error: 'The new password must be different from the current password.' });
    const row = await get('SELECT id,password FROM users WHERE id=?', [req.user.id]);
    if (!row || !(await bcrypt.compare(currentPassword, row.password))) return res.status(401).json({ error: 'Current password is incorrect.' });
    const hash = await bcrypt.hash(newPassword, 12);
    await run('UPDATE users SET password=?,failed_attempts=0,locked_until=NULL WHERE id=?', [hash, req.user.id]);
    const token = sessionTokenFromRequest(req);
    if (token) await run('DELETE FROM sessions WHERE user_id=? AND id<>?', [req.user.id, token]);
    else await run('DELETE FROM sessions WHERE user_id=?', [req.user.id]);
    await auditBestEffort(req.user.id, 'password_changed', 'user', req.user.id, {});
    return res.json({ ok: true });
  } catch (error) {
    console.error('Password change error:', error);
    return res.status(500).json({ error: 'Could not change your password.' });
  }
});

app.post('/api/accounts/password-reset/request', async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!username || !email) {
    return res.status(400).json({ error: 'Username and trusted email are required.' });
  }

  const user = await get(
    'SELECT id, trusted_email AS trustedEmail FROM users WHERE LOWER(username)=LOWER(?)',
    [username]
  );

  // Do not reveal whether a username exists. A reset is only prepared when the submitted
  // trusted email exactly matches the email stored for that account.
  if (!user || !user.trustedEmail || user.trustedEmail !== email) {
    return res.json({ ok: true });
  }

  const token = crypto.randomBytes(32).toString('hex');
  await run(
    'INSERT INTO password_resets VALUES(?,?,?,0)',
    [
      crypto.createHash('sha256').update(token).digest('hex'),
      user.id,
      new Date(Date.now() + 3600000).toISOString()
    ]
  );

  // The local development build can show the token because there is no mail service configured.
  // Never expose a reset token directly in a production response.
  if (process.env.NODE_ENV === 'production') {
    return res.json({ ok: true });
  }

  return res.json({ token });
});
app.post('/api/accounts/password-reset/confirm', async (req, res) => {
  const hash = crypto.createHash('sha256').update(String(req.body?.token || '')).digest('hex');
  const row = await get('SELECT * FROM password_resets WHERE token_hash=? AND used=0 AND expires_at>?', [hash, new Date().toISOString()]);
  if (!row || typeof req.body?.password !== 'string' || req.body.password.length < 8) return res.status(400).json({ error: 'Invalid or expired reset token.' });
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  await run('UPDATE users SET password=?, failed_attempts=0, locked_until=NULL WHERE id=?', [passwordHash, row.user_id]);
  await run('UPDATE password_resets SET used=1 WHERE token_hash=?', [hash]);
  await run('DELETE FROM sessions WHERE user_id=?', [row.user_id]);
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
    await auditBestEffort(req.user.id, 'course_created', 'course', created.id, { name: created.name });
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
    await auditBestEffort(req.user.id, 'course_removed', 'course', removed.id, { name: removed.name });
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

    await auditBestEffort(req.user.id, 'teaching_group_assigned', 'staff_course_assignment', `${target.id}:${course}:${yearLevel}:${academicYear}`, { targetUserId: target.id, course, yearLevel, academicYear });
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
    await auditBestEffort(req.user.id, 'teaching_group_removed', 'staff_course_assignment', req.params.id, group);
    res.json({ ok: true });
  } catch (error) {
    console.error('Teaching group delete error:', error);
    res.status(500).json({ error: 'Could not remove teaching group.' });
  }
});


function assignmentRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    course: row.course,
    yearLevel: Number(row.yearLevel),
    academicYear: Number(row.academicYear),
    term: row.term || '',
    start: row.startAt,
    due: row.dueDate,
    dueTime: row.dueTime || '23:59',
    duration: Number(row.duration || 60),
    file: row.fileName || null,
    downloadUrl: (row.filePath || row.fileName) ? `/api/assignments/${row.id}/download` : null,
    ownerId: row.ownerId || null,
    owner: row.ownerName || '',
    completed: Boolean(row.completed),
    openOverride: Boolean(row.openOverride),
    active: Boolean(row.active),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function assignmentSubmissionRow(row, forStudent = false) {
  if (!row) return null;
  const published = ["Published", "Locked"].includes(String(row.markStatus || ""));
  // The marks ledger is authoritative. The submission's own copy can be empty when the mark was
  // recorded before the learner submitted, or when an idempotent re-release skipped the sync.
  const markValue = row.mark ?? (row.markStatus ? row.ledgerMark : null);
  return {
    id: row.id, assignmentId: row.assignmentId, assignmentTitle: row.assignmentTitle,
    subject: row.subject, course: row.course,
    yearLevel: row.yearLevel == null ? null : Number(row.yearLevel),
    studentId: row.studentId, studentUsername: row.studentUsername, studentName: row.studentName,
    fileName: row.fileName,
    fileUrl: (row.filePath || row.fileName) ? `/api/assignment-submissions/${row.id}/download` : null,
    submittedAt: row.submittedAt, completed: Boolean(row.completed), closed: Boolean(row.closed),
    closedAt: row.closedAt || null,
    mark: forStudent && !published ? undefined : (markValue == null ? undefined : Number(markValue)),
    markStatus: row.markStatus || null,
    markFeedback: forStudent && !published ? "" : (row.markFeedback || ""),
    markUpdatedAt: row.markUpdatedAt || null,
    markPublishedAt: published ? (row.markPublishedAt || row.markUpdatedAt || null) : null,
    markedBy: forStudent ? undefined : (row.markedByName || null),
    conductAcknowledged: Boolean(row.conductAcknowledged),
    // A marked copy is part of the result. While a mark is still moving through approval the
    // learner must not see the annotated work any more than the score itself.
    ...(forStudent && row.markStatus && !published
      ? { markedFileName: null, markedFileUrl: null, markedUploadedAt: null }
      : {
        markedFileName: row.markedFileName || null,
        markedFileUrl: (row.markedFilePath || row.markedFileName) ? `/api/assignment-submissions/${row.id}/marked-download` : null,
        markedUploadedAt: row.markedUploadedAt || null,
      }),
    markedDownloadedAt: row.markedDownloadedAt || null,
    reflection: row.reflection || "",
    reflectionUpdatedAt: row.reflectionUpdatedAt || null,
    passed: published && markValue != null && row.passingMark != null ? Number(markValue) >= Number(row.passingMark) : null,
    passingMark: row.passingMark == null ? null : Number(row.passingMark),
  };
}
function testRow(row, forStudent = false) {
  if (!row) return null;
  let questions = [];
  try { questions = row.questionsJson ? JSON.parse(row.questionsJson) : []; } catch (_) { questions = []; }
  const safeQuestions = (Array.isArray(questions) ? questions : []).map((question) => {
    const points = Number(question?.points ?? 1);
    const base = {
      type: question?.type === 'essay' ? 'essay' : 'mcq',
      question: String(question?.question || ''),
      points: Number.isFinite(points) && points > 0 ? points : 1,
    };
    if (base.type === 'essay') {
      if (!forStudent) base.modelAnswer = String(question?.modelAnswer || '');
      return base;
    }
    base.options = Array.isArray(question?.options) ? question.options.map((option) => String(option)) : [];
    if (!forStudent) base.correct = Number.isInteger(Number(question?.correct)) ? Number(question.correct) : 0;
    return base;
  });
  // Deliberately no "sensible default" here. Inventing a window (now / 2099-12-31) hides a
  // query that forgot to select the schedule columns, and the invented value then gets saved
  // back as if it were real. An empty value surfaces as "Schedule needs attention" instead.
  const startAt = normalizeTestDateTime(row.startAt || row.start_at);
  const dueDate = normalizeTestDueDate(row.dueDate || row.due_date);
  const dueTime = normalizeTestDueTime(row.dueTime || row.due_time) || '23:59';
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    course: row.course,
    yearLevel: Number(row.yearLevel),
    academicYear: Number(row.academicYear),
    passingMark: Number(row.passingMark),
    durationMinutes: Number(row.durationMinutes),
    maxAttempts: Number(row.maxAttempts),
    startAt,
    dueDate,
    dueTime,
    completed: Boolean(row.completed),
    openOverride: Boolean(row.openOverride),
    questions: safeQuestions,
    totalPoints: safeQuestions.reduce((sum, question) => sum + Number(question.points || 0), 0),
    active: Boolean(row.active),
    createdBy: row.createdBy || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function calendarEventRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    eventType: row.eventType,
    startAt: row.startAt,
    endAt: row.endAt,
    course: row.course || null,
    yearLevel: row.yearLevel == null ? null : Number(row.yearLevel),
    academicYear: Number(row.academicYear),
    createdBy: row.createdBy || null,
    createdByName: row.createdByName || '',
    active: Boolean(row.active),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
async function staffHasGroup(user, course, yearLevel, academicYear) {
  if (!course || !Number.isInteger(Number(yearLevel))) return false;
  if (user.role === 'main-admin') {
    // The main administrator is the institution-wide authority. They do not need to be
    // assigned to their own teaching group before managing an existing course/year.
    return Boolean(await findCourse(course));
  }
  const row = await get(`SELECT id FROM staff_course_assignments
    WHERE user_id=? AND course=? AND year_level=? AND academic_year=? AND active=1 LIMIT 1`,
    [user.id, course, Number(yearLevel), Number(academicYear)]);
  return Boolean(row);
}

app.get('/api/calendar', requireAuth, async (req, res) => {
  try {
    let rows = [];
    const baseSelect = `
      SELECT e.id,e.title,e.description,e.event_type AS eventType,e.start_at AS startAt,e.end_at AS endAt,
             e.course,e.year_level AS yearLevel,e.academic_year AS academicYear,e.created_by AS createdBy,
             u.name AS createdByName,e.active,e.created_at AS createdAt,e.updated_at AS updatedAt
      FROM calendar_events e LEFT JOIN users u ON u.id=e.created_by`;

    if (req.user.role === 'student') {
      const currentAcademicYear = new Date().getFullYear();
      const eventRows = await all(`${baseSelect}
        WHERE e.active=1 AND
          (e.course IS NULL OR (e.course=? AND (e.year_level IS NULL OR e.year_level=? OR e.academic_year<?)))
        ORDER BY e.start_at`, [req.user.course, Number(req.user.yearLevel), currentAcademicYear]);

      const assignmentRows = await all(`
        SELECT id,title,subject,course,year_level AS yearLevel,academic_year AS academicYear,
               start_at AS startAt,due_date AS dueDate,due_time AS dueTime,completed
        FROM assignments
        WHERE active=1 AND course=? AND (academic_year<? OR (academic_year=? AND year_level=?))
        ORDER BY start_at`, [req.user.course, currentAcademicYear, currentAcademicYear, Number(req.user.yearLevel)]);

      const testRows = await all(`
        SELECT id,title,subject,course,year_level AS yearLevel,academic_year AS academicYear,
               start_at AS startAt,due_date AS dueDate,due_time AS dueTime,completed
        FROM tests
        WHERE active=1 AND course=? AND (academic_year<? OR (academic_year=? AND year_level=?))
        ORDER BY start_at`, [req.user.course, currentAcademicYear, currentAcademicYear, Number(req.user.yearLevel)]);

      rows = [
        ...eventRows.map(calendarEventRow),
        ...assignmentRows.map((item) => ({
          id: `assignment-${item.id}`, title: item.title, description: `${item.subject || 'Assignment'} · ${item.completed ? 'Completed' : 'Assignment'} due ${item.dueDate}${item.dueTime ? ` at ${item.dueTime}` : ''}.`,
          eventType: 'assignment', startAt: item.startAt || `${item.dueDate}T08:00`,
          endAt: `${item.dueDate}T${item.dueTime || '23:59'}`, course: item.course, yearLevel: Number(item.yearLevel),
          academicYear: Number(item.academicYear), active: true, readOnly: true, sourceId: item.id
        })),
        ...testRows.map((item) => ({
          id: `test-${item.id}`, title: item.title, description: `${item.subject || 'Test / exam'} · ${item.completed ? 'Completed' : 'Scheduled assessment'}.`,
          eventType: 'test', startAt: item.startAt || `${item.dueDate}T08:00`,
          endAt: `${item.dueDate}T${item.dueTime || '23:59'}`, course: item.course, yearLevel: Number(item.yearLevel),
          academicYear: Number(item.academicYear), active: true, readOnly: true, sourceId: item.id
        })),
      ];
    } else if (req.user.role === 'main-admin') {
      const eventRows = await all(`${baseSelect} WHERE e.active=1 ORDER BY e.start_at`);
      rows = eventRows.map(calendarEventRow);
    } else {
      const eventRows = await all(`${baseSelect} WHERE e.active=1 AND (e.course IS NULL OR EXISTS (
        SELECT 1 FROM staff_course_assignments sc
        WHERE sc.user_id=? AND sc.course=e.course AND (e.year_level IS NULL OR sc.year_level=e.year_level)
          AND sc.academic_year=e.academic_year AND sc.active=1
      )) ORDER BY e.start_at`, [req.user.id]);
      rows = eventRows.map(calendarEventRow);
    }

    res.json(rows);
  } catch (error) {
    console.error('Calendar fetch error:', error);
    res.status(500).json({ error: `Could not load calendar: ${error.message}` });
  }
});

app.post('/admin/calendar', requireAdmin, async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const eventType = ['event', 'remediation-week'].includes(req.body?.eventType) ? req.body.eventType : 'event';
    const startAt = String(req.body?.startAt || '').trim();
    const endAt = String(req.body?.endAt || '').trim();
    const course = String(req.body?.course || '').trim() || null;
    const yearLevel = req.body?.yearLevel === '' || req.body?.yearLevel == null ? null : Number(req.body.yearLevel);
    const academicYear = Number.parseInt(req.body?.academicYear, 10) || new Date().getFullYear();
    if (!title || !startAt || !endAt) return res.status(400).json({ error: 'Title, start date/time and end date/time are required.' });
    if (!Number.isInteger(academicYear) || academicYear < 2000 || academicYear > 2100) return res.status(400).json({ error: 'Academic year must be between 2000 and 2100.' });
    if (new Date(endAt) <= new Date(startAt)) return res.status(400).json({ error: 'End date/time must be after the start date/time.' });
    if (course && (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 6 || !(await staffHasGroup(req.user, course, yearLevel, academicYear)))) return res.status(403).json({ error: 'Choose one of the teaching course/year groups assigned in the selected academic year.' });
    if (!course && req.user.role === 'admin') return res.status(403).json({ error: 'Administrators must target an assigned teaching course/year group. The main administrator may create institution-wide events.' });
    if (course && !(await findCourse(course))) return res.status(400).json({ error: 'Choose a course from the current course catalogue.' });
    const r = await run(`INSERT INTO calendar_events(title,description,event_type,start_at,end_at,course,year_level,academic_year,created_by) VALUES(?,?,?,?,?,?,?,?,?)`, [title, description, eventType, startAt, endAt, course, yearLevel, academicYear, req.user.id]);
    const row = await get(`SELECT e.id,e.title,e.description,e.event_type AS eventType,e.start_at AS startAt,e.end_at AS endAt,e.course,e.year_level AS yearLevel,e.academic_year AS academicYear,e.created_by AS createdBy,u.name AS createdByName,e.active,e.created_at AS createdAt,e.updated_at AS updatedAt FROM calendar_events e LEFT JOIN users u ON u.id=e.created_by WHERE e.id=?`, [r.lastID]);
    res.status(201).json(calendarEventRow(row));
  } catch (error) {
    res.status(500).json({ error: `Could not create calendar item: ${error.message}` });
  }
});

app.patch('/admin/calendar/:id', requireAdmin, async (req, res) => {
  try {
    const existing = await get(`SELECT * FROM calendar_events WHERE id=? AND active=1`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Calendar item not found.' });
    const course = String(req.body?.course ?? existing.course ?? '').trim() || null;
    const yearLevel = req.body?.yearLevel === '' || req.body?.yearLevel == null ? (course ? existing.year_level : null) : Number(req.body.yearLevel);
    const academicYear = Number.parseInt(req.body?.academicYear, 10) || Number(existing.academic_year);
    if (!Number.isInteger(academicYear) || academicYear < 2000 || academicYear > 2100) return res.status(400).json({ error: 'Academic year must be between 2000 and 2100.' });
    if (course && (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 6 || !(await staffHasGroup(req.user, course, yearLevel, academicYear)))) return res.status(403).json({ error: 'That course/year is outside your teaching allocation.' });
    if (!course && req.user.role === 'admin') return res.status(403).json({ error: 'Administrators must target an assigned teaching course/year group.' });
    if (course && !(await findCourse(course))) return res.status(400).json({ error: 'Choose a course from the current course catalogue.' });
    if (existing.course && !(await staffHasGroup(req.user, existing.course, existing.year_level, existing.academic_year))) return res.status(403).json({ error: 'That calendar item is outside your teaching allocation.' });
    if (!existing.course && req.user.role !== 'main-admin') return res.status(403).json({ error: 'Only the main administrator may edit institution-wide calendar items.' });
    const title = String(req.body?.title ?? existing.title).trim();
    const description = String(req.body?.description ?? existing.description ?? '').trim();
    const eventType = ['event', 'remediation-week'].includes(req.body?.eventType) ? req.body.eventType : existing.event_type;
    const startAt = String(req.body?.startAt ?? existing.start_at);
    const endAt = String(req.body?.endAt ?? existing.end_at);
    if (!title || new Date(endAt) <= new Date(startAt)) return res.status(400).json({ error: 'Calendar title and valid start/end dates are required.' });
    await run(`UPDATE calendar_events SET title=?,description=?,event_type=?,start_at=?,end_at=?,course=?,year_level=?,academic_year=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [title, description, eventType, startAt, endAt, course, yearLevel, academicYear, req.params.id]);
    const row = await get(`SELECT e.id,e.title,e.description,e.event_type AS eventType,e.start_at AS startAt,e.end_at AS endAt,e.course,e.year_level AS yearLevel,e.academic_year AS academicYear,e.created_by AS createdBy,u.name AS createdByName,e.active,e.created_at AS createdAt,e.updated_at AS updatedAt FROM calendar_events e LEFT JOIN users u ON u.id=e.created_by WHERE e.id=?`, [req.params.id]);
    res.json(calendarEventRow(row));
  } catch (error) {
    res.status(500).json({ error: `Could not update calendar item: ${error.message}` });
  }
});

app.delete('/admin/calendar/:id', requireAdmin, async (req, res) => {
  try {
    const existing = await get(`SELECT * FROM calendar_events WHERE id=? AND active=1`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Calendar item not found.' });
    if (existing.course && !(await staffHasGroup(req.user, existing.course, existing.year_level, existing.academic_year))) return res.status(403).json({ error: 'That calendar item is outside your teaching allocation.' });
    if (!existing.course && req.user.role !== 'main-admin') return res.status(403).json({ error: 'Only the main administrator may remove institution-wide calendar items.' });
    await run(`UPDATE calendar_events SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: `Could not delete calendar item: ${error.message}` });
  }
});
function assignmentWindowState(row, now = new Date()) {
  if (!row) return 'missing';
  if (Boolean(row.completed)) return 'closed';
  if (Boolean(row.openOverride)) return 'open';
  const start = new Date(row.startAt);
  const due = new Date(`${row.dueDate}T${row.dueTime || '23:59'}`);
  if (!Number.isNaN(start.getTime()) && now < start) return 'not-open';
  if (!Number.isNaN(due.getTime()) && now > due) return 'closed';
  return 'open';
}

function assignmentWindowMessage(row, state) {
  if (state === 'not-open') return `This assignment opens on ${new Date(row.startAt).toLocaleString()}.`;
  if (Boolean(row?.completed)) return 'This assignment has been closed by staff.';
  if (row?.dueDate) return `This assignment closed on ${new Date(`${row.dueDate}T${row.dueTime || '23:59'}`).toLocaleString()}.`;
  return 'This assignment is closed.';
}

async function getStudentAcademicYear(studentId) {
  const currentYear = new Date().getFullYear();
  const row = await get(`
    SELECT academic_year AS academicYear
    FROM student_teacher_assignments
    WHERE student_id=? AND active=1 AND academic_year<=?
    ORDER BY academic_year DESC, id DESC
    LIMIT 1
  `, [studentId, currentYear]);
  return Number(row?.academicYear || currentYear);
}

async function getAssignmentForUser(user, assignmentId) {
  const row = await get(`
    SELECT a.id,a.title,a.subject,a.course,a.year_level AS yearLevel,a.academic_year AS academicYear,
           a.term,a.start_at AS startAt,a.due_date AS dueDate,a.due_time AS dueTime,a.duration,
           a.file_name AS fileName,a.file_path AS filePath,a.owner_id AS ownerId,u.name AS ownerName,
           a.completed,a.open_override AS openOverride,a.active,a.created_at AS createdAt,a.updated_at AS updatedAt
    FROM assignments a LEFT JOIN users u ON u.id=a.owner_id WHERE a.id=? AND a.active=1
  `,[assignmentId]);
  if (!row) return null;
  if (user.role === 'student') {
    const academicYear = await getStudentAcademicYear(user.studentId);
    if (row.course.trim().toLowerCase() !== String(user.course || '').trim().toLowerCase()) return null;
    if (Number(row.yearLevel) !== Number(user.yearLevel)) return null;
    if (Number(row.academicYear) !== academicYear) return null;
    return row;
  }
  if (!(await staffHasGroup(user,row.course,row.yearLevel,row.academicYear))) return null;
  return row;
}
async function assignmentSubmissionForUser(user, submissionId) {
  const row = await get(`
    SELECT s.id,s.assignment_id AS assignmentId,a.title AS assignmentTitle,a.subject,a.course,a.year_level AS yearLevel,
           s.student_id AS studentId,u.username AS studentUsername,u.name AS studentName,
           s.file_name AS fileName,s.file_path AS filePath,s.submitted_at AS submittedAt,
           s.completed,s.closed,s.closed_at AS closedAt,s.mark,s.mark_published_at AS markPublishedAt,
           m.status AS markStatus,m.feedback AS markFeedback,m.passing_mark AS passingMark,m.mark AS ledgerMark,m.updated_at AS markUpdatedAt,(SELECT mu.name FROM users mu WHERE mu.id=m.updated_by) AS markedByName,
           s.conduct_acknowledged AS conductAcknowledged,s.marked_file_name AS markedFileName,
           s.marked_file_path AS markedFilePath,s.marked_uploaded_at AS markedUploadedAt,s.marked_downloaded_at AS markedDownloadedAt,s.reflection,s.reflection_updated_at AS reflectionUpdatedAt
    FROM assignment_submissions s
    JOIN assignments a ON a.id=s.assignment_id
    JOIN users u ON u.student_id=s.student_id
    LEFT JOIN marks m ON m.student_id=s.student_id AND m.assessment_id=('ASSIGN-' || CAST(s.assignment_id AS TEXT))
    WHERE s.id=? AND a.active=1`,[submissionId]);
  if (!row) return null;
  if (user.role === 'student') {
    return row.studentId === user.studentId ? row : null;
  }
  return (await staffHasGroup(user,row.course,row.yearLevel,
    (await get('SELECT academic_year AS academicYear FROM assignments WHERE id=?',[row.assignmentId]))?.academicYear)) ? row : null;
}


function validateAssignmentDates(start, dueDate, dueTime) {
  const normalizedStart = String(start || '').trim();
  const normalizedDue = String(dueDate || '').trim();
  const normalizedTime = String(dueTime || '23:59').trim();
  if (!normalizedStart || !normalizedDue || !/^([01]\d|2[0-3]):[0-5]\d$/.test(normalizedTime)) {
    throw Object.assign(new Error('Assignment opening and closing date/time must be valid.'), { status: 400 });
  }
  const startDate = new Date(normalizedStart);
  const due = new Date(`${normalizedDue}T${normalizedTime}`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(due.getTime()) || due <= startDate) {
    throw Object.assign(new Error('The assignment closing date/time must be after its opening date/time.'), { status: 400 });
  }
  return { startAt: normalizedStart, dueDate: normalizedDue, dueTime: normalizedTime };
}
function zipFileLooksValid(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  let fd = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(4);
    const bytes = fs.readSync(fd, header, 0, header.length, 0);
    if (bytes < 4) return false;
    return header[0] === 0x50 && header[1] === 0x4b && (
      (header[2] === 0x03 && header[3] === 0x04) ||
      (header[2] === 0x05 && header[3] === 0x06) ||
      (header[2] === 0x07 && header[3] === 0x08)
    );
  } catch (_) {
    return false;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (_) { /* ignore close errors */ }
    }
  }
}
function zipUploadAllowed(file) {
  return Boolean(file && /\.zip$/i.test(String(file.originalname || '')) && zipFileLooksValid(file.path));
}
function assignmentFileAllowed(fileName) {
  return /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|zip|png|jpe?g)$/i.test(String(fileName || ''));
}
function storedFilePath(stored) {
  if (!stored) return null;
  const root = path.resolve(STORAGE_ROOT);
  const raw = String(stored).trim();
  if (!raw) return null;

  const isWindowsAbsolute = /^[A-Za-z]:[\\/]/.test(raw);
  const normalised = raw.replace(/\\/g, '/');
  const isInsideRoot = (value) => value === root || value.startsWith(`${root}${path.sep}`);
  const candidates = [];

  if (path.isAbsolute(raw) || isWindowsAbsolute) {
    const absolute = path.resolve(raw);
    if (isInsideRoot(absolute)) candidates.push(absolute);

    // Older revisions stored machine-specific absolute paths. Recover the stable
    // part after `school_data/` when the project has moved to another directory.
    const marker = '/school_data/';
    const markerIndex = normalised.toLowerCase().lastIndexOf(marker);
    if (markerIndex >= 0) {
      const recovered = path.resolve(root, normalised.slice(markerIndex + marker.length));
      if (isInsideRoot(recovered)) candidates.push(recovered);
    }
  } else {
    // Current records are relative to school_data. Older versions sometimes stored
    // `school_data/...`, `./school_data/...`, or Windows-style relative separators.
    // Normalise all of those variants before resolving so an installation can move
    // between folders/OSs without breaking previously uploaded work.
    const relativeVariants = [
      normalised,
      normalised.replace(/^\.\//, ''),
      normalised.replace(/^(?:\.\/)?school_data\//i, 'school_data/'),
    ];
    const withoutSchoolData = normalised.replace(/^(?:\.\/)?school_data\//i, '');
    if (withoutSchoolData !== normalised) relativeVariants.push(withoutSchoolData);
    for (const relativeValue of [...new Set(relativeVariants)]) {
      const value = relativeValue.toLowerCase().startsWith('school_data/')
        ? relativeValue.slice('school_data/'.length)
        : relativeValue;
      const relative = path.resolve(root, value);
      if (isInsideRoot(relative)) candidates.push(relative);
    }
  }

  for (const candidate of candidates) {
    if (candidate === root || !fs.existsSync(candidate)) continue;
    try {
      if (!fs.statSync(candidate).isFile()) continue;
      // Resolve symlinks before serving/deleting a stored file so a database path or filesystem
      // link can never escape school_data even when its lexical path appears to be inside it.
      const realCandidate = fs.realpathSync(candidate);
      if (isInsideRoot(realCandidate)) return realCandidate;
    } catch (_) {
      // A file can disappear between exists/stat/realpath; let the caller use its normal 404 path.
    }
  }

  // Very old records may contain only the filename. Restrict this recovery to
  // the dedicated assignment directory and only accept an exact/unique match.
  const basename = path.basename(normalised);
  const assignmentsDir = path.resolve(root, 'assignments');
  if (basename && fs.existsSync(assignmentsDir) && fs.statSync(assignmentsDir).isDirectory()) {
    const exact = path.resolve(assignmentsDir, basename);
    if (isInsideRoot(exact) && fs.existsSync(exact) && fs.statSync(exact).isFile()) return exact;

    const matches = fs.readdirSync(assignmentsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && (entry.name === basename || entry.name.endsWith(`-${basename}`)))
      .map((entry) => path.resolve(assignmentsDir, entry.name))
      .map((candidate) => {
        try {
          if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) return null;
          const realCandidate = fs.realpathSync(candidate);
          return isInsideRoot(realCandidate) ? realCandidate : null;
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);
    if (matches.length === 1) return matches[0];
  }

  return null;
}

function storedRelativePath(absolutePath) {
  const root = path.resolve(STORAGE_ROOT);
  const candidate = path.resolve(absolutePath);
  if (!(candidate === root || candidate.startsWith(`${root}${path.sep}`))) return null;
  return path.relative(root, candidate).split(path.sep).join('/');
}

// Remove a persistent stored file without turning a successful database operation into a false
// HTTP failure. Database state is authoritative; filesystem cleanup is best-effort and remains
// safely confined by storedFilePath().
function removeStoredFile(stored) {
  const filePath = storedFilePath(stored);
  if (!filePath) return false;
  try {
    fs.rmSync(filePath, { force: true });
    return true;
  } catch (error) {
    console.error('Stored-file cleanup failed:', filePath, error.message);
    return false;
  }
}

app.post('/admin/assignments', requireAdmin, temporaryUploadSafe, async (req,res) => {
  let movedPath = null;
  try {
    if (!req.file) return res.status(400).json({ error:'Choose the assignment file.' });
    if (!assignmentFileAllowed(req.file.originalname)) { if (req.file?.path) fs.rmSync(req.file.path,{force:true}); return res.status(415).json({ error:'Unsupported assignment file type.' }); }
    const title = String(req.body?.title || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const course = String(req.body?.course || '').trim();
    const yearLevel = Number(req.body?.yearLevel);
    const academicYear = Number(req.body?.academicYear) || new Date().getFullYear();
    const term = String(req.body?.term || '').trim();
    const duration = Number(req.body?.duration || 60);
    if (!title || !subject || !course || !Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 6) return res.status(400).json({ error:'Title, subject, course and year are required.' });
    if (!(await findCourse(course))) return res.status(400).json({ error:'Choose a course from the current course catalogue.' });
    if (!(await staffHasGroup(req.user,course,yearLevel,academicYear))) return res.status(403).json({ error:'You may only create assignments for an assigned teaching course/year group.' });
    if (!Number.isInteger(academicYear) || academicYear < 2000 || academicYear > 2100) return res.status(400).json({ error:'Academic year must be between 2000 and 2100.' });
    if (!Number.isFinite(duration) || duration < 1 || duration > 1440) return res.status(400).json({ error:'Duration must be between 1 and 1440 minutes.' });
    const dates = validateAssignmentDates(req.body?.start,req.body?.due,req.body?.dueTime);
    const duplicate = await get('SELECT id FROM assignments WHERE LOWER(title)=LOWER(?) AND subject=? AND course=? AND year_level=? AND academic_year=? AND active=1',[title,subject,course,yearLevel,academicYear]);
    if (duplicate) return res.status(409).json({ error:'That assignment already exists for this course/year.' });

    const directory = path.join(STORAGE_ROOT,'assignments');
    fs.mkdirSync(directory,{recursive:true});
    const destination = path.join(directory, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeSegment(path.basename(req.file.originalname))}`);
    fs.renameSync(req.file.path,destination);
    if (!fs.existsSync(destination)) throw Object.assign(new Error('The uploaded assignment file could not be stored.'), { status: 500 });
    movedPath = destination;
    const created = await transaction(async () => {
      const result = await run(`INSERT INTO assignments(title,subject,course,year_level,academic_year,term,start_at,due_date,due_time,duration,file_name,file_path,owner_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [title,subject,course,yearLevel,academicYear,term,dates.startAt,dates.dueDate,dates.dueTime,duration,path.basename(req.file.originalname),storedRelativePath(destination),req.user.id]);
      await run('INSERT OR IGNORE INTO assessments(id,name,max_mark) VALUES(?,?,?)',[`ASSIGN-${result.lastID}`,title,100]);
      return get(`SELECT a.id,a.title,a.subject,a.course,a.year_level AS yearLevel,a.academic_year AS academicYear,a.term,a.start_at AS startAt,a.due_date AS dueDate,a.due_time AS dueTime,a.duration,a.file_name AS fileName,a.file_path AS filePath,a.owner_id AS ownerId,u.name AS ownerName,a.completed,a.open_override AS openOverride,a.active,a.created_at AS createdAt,a.updated_at AS updatedAt FROM assignments a LEFT JOIN users u ON u.id=a.owner_id WHERE a.id=?`,[result.lastID]);
    });
    movedPath = null; // database commit succeeded; never delete the permanent file because a later audit/response can fail.
    await auditBestEffort(req.user.id,'assignment_created','assignment',created.id,{title,course,yearLevel,academicYear});
    res.status(201).json(assignmentRow(created));
  } catch (error) {
    if (movedPath) fs.rmSync(movedPath,{force:true});
    if (req.file?.path) fs.rmSync(req.file.path,{force:true});
    res.status(error.status || (error.code==='SQLITE_CONSTRAINT'?409:500)).json({ error:error.code==='SQLITE_CONSTRAINT'?'That assignment conflicts with existing data.':`Could not create assignment: ${error.message}` });
  } finally {
    if (req.file?.path && !movedPath) fs.rmSync(req.file.path,{force:true});
  }
});

app.patch('/admin/assignments/:id', requireAdmin, temporaryUploadSafe, async (req,res) => {
  let movedPath = null;
  let oldFilePath = null;
  try {
    const existing = await get('SELECT * FROM assignments WHERE id=? AND active=1',[req.params.id]);
    if (!existing) return res.status(404).json({ error:'Assignment not found.' });
    if (!(await staffHasGroup(req.user,existing.course,existing.year_level,existing.academic_year))) return res.status(403).json({ error:'That assignment is outside your teaching allocation.' });
    const title = String(req.body?.title ?? existing.title).trim();
    const subject = String(req.body?.subject ?? existing.subject).trim();
    const course = String(req.body?.course ?? existing.course).trim();
    const yearLevel = Number(req.body?.yearLevel ?? existing.year_level);
    const academicYear = Number(req.body?.academicYear ?? existing.academic_year);
    const term = String(req.body?.term ?? existing.term ?? '').trim();
    const duration = Number(req.body?.duration ?? existing.duration);
    if (!title || !subject || !course || !Number.isInteger(yearLevel) || yearLevel<1 || yearLevel>6) return res.status(400).json({ error:'Title, subject, course and year are required.' });
    if (!(await findCourse(course))) return res.status(400).json({ error:'Choose a course from the current course catalogue.' });
    if (!(await staffHasGroup(req.user,course,yearLevel,academicYear))) return res.status(403).json({ error:'You may not move an assignment outside an assigned teaching group.' });
    if (!Number.isFinite(duration) || duration<1 || duration>1440) return res.status(400).json({ error:'Duration must be between 1 and 1440 minutes.' });
    const dates = validateAssignmentDates(req.body?.start ?? existing.start_at,req.body?.due ?? existing.due_date,req.body?.dueTime ?? existing.due_time);
    if (req.file && !assignmentFileAllowed(req.file.originalname)) { if (req.file?.path) fs.rmSync(req.file.path,{force:true}); return res.status(415).json({ error:'Unsupported assignment file type.' }); }
    const duplicate = await get('SELECT id FROM assignments WHERE id<>? AND LOWER(title)=LOWER(?) AND subject=? AND course=? AND year_level=? AND academic_year=? AND active=1',[existing.id,title,subject,course,yearLevel,academicYear]);
    if (duplicate) return res.status(409).json({ error:'Another assignment already uses those details.' });
    if (req.file) {
      const directory = path.join(STORAGE_ROOT,'assignments');
      fs.mkdirSync(directory,{recursive:true});
      const destination = path.join(directory,`${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeSegment(path.basename(req.file.originalname))}`);
      fs.renameSync(req.file.path,destination); movedPath = destination;
      oldFilePath = existing.file_path;
      await transaction(async () => {
        await run(`UPDATE assignments SET title=?,subject=?,course=?,year_level=?,academic_year=?,term=?,start_at=?,due_date=?,due_time=?,duration=?,file_name=?,file_path=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
          [title,subject,course,yearLevel,academicYear,term,dates.startAt,dates.dueDate,dates.dueTime,duration,path.basename(req.file.originalname),storedRelativePath(destination),existing.id]);
        await run('UPDATE assessments SET name=? WHERE id=?',[title,`ASSIGN-${existing.id}`]);
      });
    } else {
      await transaction(async () => {
        await run(`UPDATE assignments SET title=?,subject=?,course=?,year_level=?,academic_year=?,term=?,start_at=?,due_date=?,due_time=?,duration=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
          [title,subject,course,yearLevel,academicYear,term,dates.startAt,dates.dueDate,dates.dueTime,duration,existing.id]);
        await run('UPDATE assessments SET name=? WHERE id=?',[title,`ASSIGN-${existing.id}`]);
      });
    }
    movedPath = null; // database commit succeeded; the replacement file is now canonical and must survive later SELECT/audit failures.
    const updated = await get(`SELECT a.id,a.title,a.subject,a.course,a.year_level AS yearLevel,a.academic_year AS academicYear,a.term,a.start_at AS startAt,a.due_date AS dueDate,a.due_time AS dueTime,a.duration,a.file_name AS fileName,a.file_path AS filePath,a.owner_id AS ownerId,u.name AS ownerName,a.completed,a.open_override AS openOverride,a.active,a.created_at AS createdAt,a.updated_at AS updatedAt FROM assignments a LEFT JOIN users u ON u.id=a.owner_id WHERE a.id=?`,[existing.id]);
    if (oldFilePath) { const oldAbsolute = storedFilePath(oldFilePath); if (oldAbsolute && oldAbsolute !== storedFilePath(updated.filePath)) removeStoredFile(oldFilePath); }
    await auditBestEffort(req.user.id,'assignment_updated','assignment',existing.id,{title,course,yearLevel,academicYear,fileReplaced:Boolean(req.file)});
    res.json(assignmentRow(updated));
  } catch (error) {
    if (movedPath) fs.rmSync(movedPath,{force:true});
    if (req.file?.path) fs.rmSync(req.file.path,{force:true});
    res.status(error.status || (error.code==='SQLITE_CONSTRAINT'?409:500)).json({ error:error.code==='SQLITE_CONSTRAINT'?'That assignment conflicts with existing data.':`Could not update assignment: ${error.message}` });
  } finally {
    if (req.file?.path && !movedPath) fs.rmSync(req.file.path,{force:true});
  }
});

app.patch('/admin/assignments/:id/status', requireAdmin, async (req,res) => {
  try {
    const existing = await get('SELECT * FROM assignments WHERE id=? AND active=1',[req.params.id]);
    if (!existing) return res.status(404).json({ error:'Assignment not found.' });
    if (!(await staffHasGroup(req.user,existing.course,existing.year_level,existing.academic_year))) return res.status(403).json({ error:'That assignment is outside your teaching allocation.' });
    const completed = Boolean(req.body?.completed);
    await transaction(async () => {
      await run('UPDATE assignments SET completed=?,open_override=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[completed?1:0,completed?0:1,existing.id]);
      if (completed) {
        await run(`UPDATE assignment_submissions
          SET closed=1, closed_at=COALESCE(closed_at,CURRENT_TIMESTAMP)
          WHERE assignment_id=? AND closed=0`, [existing.id]);
      }
    });
    const updated = await get(`SELECT a.id,a.title,a.subject,a.course,a.year_level AS yearLevel,a.academic_year AS academicYear,a.term,a.start_at AS startAt,a.due_date AS dueDate,a.due_time AS dueTime,a.duration,a.file_name AS fileName,a.file_path AS filePath,a.owner_id AS ownerId,u.name AS ownerName,a.completed,a.open_override AS openOverride,a.active,a.created_at AS createdAt,a.updated_at AS updatedAt FROM assignments a LEFT JOIN users u ON u.id=a.owner_id WHERE a.id=?`,[existing.id]);
    await auditBestEffort(req.user.id,completed?'assignment_closed':'assignment_reopened','assignment',existing.id,{completed});
    res.json(assignmentRow(updated));
  } catch (error) { res.status(500).json({ error:`Could not change assignment status: ${error.message}` }); }
});

app.delete('/admin/assignments/:id', requireAdmin, async (req,res) => {
  try {
    const existing = await get('SELECT * FROM assignments WHERE id=?',[req.params.id]);
    if (!existing) return res.status(404).json({ error:'Assignment not found.' });
    if (!Boolean(existing.active)) return res.json({ ok:true, alreadyDeleted:true });
    if (!(await staffHasGroup(req.user,existing.course,existing.year_level,existing.academic_year))) return res.status(403).json({ error:'That assignment is outside your teaching allocation.' });

    // Collect every file reference before cascading/removing the database rows. The previous
    // implementation deleted the child rows' files from disk but left assignment_submissions rows
    // behind, creating SQLite records that pointed at missing files. It also failed to collect
    // remediation attempt files, leaking them permanently.
    const submissions = await all('SELECT file_path AS filePath,marked_file_path AS markedFilePath FROM assignment_submissions WHERE assignment_id=?',[existing.id]);
    const assessmentId = `ASSIGN-${existing.id}`;
    const remediationRows = await all('SELECT id,file_path AS filePath FROM remediations WHERE assessment_id=?',[assessmentId]);
    const remediationIds = remediationRows.map((row) => row.id).filter(Boolean);
    const remediationAttempts = remediationIds.length
      ? await all(`SELECT file_path AS filePath FROM remediation_attempts WHERE remediation_id IN (${remediationIds.map(() => '?').join(',')})`, remediationIds)
      : [];

    await transaction(async () => {
      await run('DELETE FROM remediations WHERE assessment_id=?',[assessmentId]);
      await run('DELETE FROM assignment_submissions WHERE assignment_id=?',[existing.id]);
      await run('DELETE FROM assignment_memos WHERE assignment_id=?',[existing.id]);
      await run('UPDATE assignments SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?',[existing.id]);
      // Delete the assessment and therefore its marks/releases. Existing audit history remains.
      await run('DELETE FROM assessments WHERE id=?',[assessmentId]);
    });

    const physical = [
      existing.file_path,
      ...submissions.flatMap((row)=>[row.filePath,row.markedFilePath]),
      ...remediationRows.map((row)=>row.filePath),
      ...remediationAttempts.map((row)=>row.filePath),
    ].map(storedFilePath).filter(Boolean);
    for (const filePath of physical) removeStoredFile(filePath);
    await auditBestEffort(req.user.id,'assignment_deleted','assignment',existing.id,{title:existing.title,assessmentId});
    res.json({ ok:true });
  } catch (error) { res.status(500).json({ error:`Could not delete assignment: ${error.message}` }); }
});

const MEMO_MAX_CRITERIA = 50;

function memoRow(row) {
  let criteria = [];
  try { criteria = JSON.parse(row.criteria || '[]'); } catch (_) { criteria = []; }
  return {
    assignmentId: Number(row.assignmentId),
    title: row.title,
    criteria: Array.isArray(criteria) ? criteria : [],
    updatedBy: row.updatedByName || null,
    updatedAt: row.updatedAt || null,
  };
}

// Returns { title, criteria } or throws a 400-tagged error. Criterion ids are kept stable because
// in-progress marking drafts key their scores by criterion id.
function validateMemo(body, fallbackTitle) {
  const fail = (message) => Object.assign(new Error(message), { status: 400 });
  const title = String(body?.title || fallbackTitle || '').trim().slice(0, 200);
  if (!title) throw fail('A memo title is required.');
  if (!Array.isArray(body?.criteria) || body.criteria.length === 0) throw fail('A memo needs at least one criterion.');
  if (body.criteria.length > MEMO_MAX_CRITERIA) throw fail(`A memo may have at most ${MEMO_MAX_CRITERIA} criteria.`);
  const seen = new Set();
  const criteria = body.criteria.map((item, index) => {
    const label = String(item?.label || '').trim().slice(0, 200);
    const max = Number(item?.max);
    const guidance = String(item?.guidance || '').trim().slice(0, 1000);
    let id = String(item?.id || '').trim().slice(0, 40) || `c${index + 1}`;
    if (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    if (!label) throw fail(`Criterion ${index + 1} needs a description.`);
    if (!Number.isFinite(max) || max <= 0 || max > 1000) throw fail(`"${label}" must be out of a number between 1 and 1000.`);
    return { id, label, max, guidance };
  });
  return { title, criteria };
}

const MEMO_SELECT = `SELECT m.assignment_id AS assignmentId,m.title,m.criteria,m.updated_at AS updatedAt,u.name AS updatedByName,
  a.course,a.year_level AS yearLevel,a.academic_year AS academicYear
  FROM assignment_memos m JOIN assignments a ON a.id=m.assignment_id LEFT JOIN users u ON u.id=m.updated_by`;

app.get('/admin/memos', requireAdmin, async (req,res) => {
  try {
    const rows = await all(`${MEMO_SELECT} WHERE a.active=1`);
    const visible = [];
    for (const row of rows) {
      if (await staffHasGroup(req.user,row.course,row.yearLevel,row.academicYear)) visible.push(memoRow(row));
    }
    res.json(visible);
  } catch (error) { res.status(500).json({ error:`Could not load memos: ${error.message}` }); }
});

app.put('/admin/memos/:assignmentId', requireAdmin, async (req,res) => {
  try {
    const assignment = await get('SELECT * FROM assignments WHERE id=? AND active=1',[req.params.assignmentId]);
    if (!assignment) return res.status(404).json({ error:'Assignment not found.' });
    if (!(await staffHasGroup(req.user,assignment.course,assignment.year_level,assignment.academic_year))) return res.status(403).json({ error:'That assignment is outside your teaching allocation.' });
    const memo = validateMemo(req.body, `${assignment.title} memo`);
    const existing = await get('SELECT assignment_id FROM assignment_memos WHERE assignment_id=?',[assignment.id]);
    await run(`INSERT INTO assignment_memos (assignment_id,title,criteria,updated_by) VALUES (?,?,?,?)
      ON CONFLICT(assignment_id) DO UPDATE SET title=excluded.title,criteria=excluded.criteria,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`,
      [assignment.id,memo.title,JSON.stringify(memo.criteria),req.user.id]);
    const saved = await get(`${MEMO_SELECT} WHERE m.assignment_id=?`,[assignment.id]);
    await auditBestEffort(req.user.id,existing?'memo_updated':'memo_created','assignment',assignment.id,{title:memo.title,criteria:memo.criteria.length});
    res.status(existing ? 200 : 201).json(memoRow(saved));
  } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : `Could not save memo: ${error.message}` }); }
});

app.delete('/admin/memos/:assignmentId', requireAdmin, async (req,res) => {
  try {
    const assignment = await get('SELECT * FROM assignments WHERE id=?',[req.params.assignmentId]);
    if (!assignment) return res.status(404).json({ error:'Assignment not found.' });
    if (!(await staffHasGroup(req.user,assignment.course,assignment.year_level,assignment.academic_year))) return res.status(403).json({ error:'That assignment is outside your teaching allocation.' });
    const result = await run('DELETE FROM assignment_memos WHERE assignment_id=?',[assignment.id]);
    if (result?.changes) await auditBestEffort(req.user.id,'memo_deleted','assignment',assignment.id,{title:assignment.title});
    res.json({ ok:true, deleted:Boolean(result?.changes) });
  } catch (error) { res.status(500).json({ error:`Could not delete memo: ${error.message}` }); }
});

app.get('/api/assignments/:id/download', requireAuth, async (req,res) => {
  try {
    const row = await getAssignmentForUser(req.user,req.params.id);
    if (!row) return res.status(404).json({ error:'Assignment not found.' });
    const state = assignmentWindowState(row);
    // Students may only fetch the brief while the submission window is genuinely open.
    // Previously only 'not-open' was rejected, so a learner could keep downloading the
    // assignment after staff closed it or after the deadline passed. Staff are exempt so
    // they can still retrieve and mark the brief for a closed assignment.
    if (req.user.role === 'student' && state !== 'open') {
      return res.status(409).json({ error: assignmentWindowMessage(row, state) });
    }
    if (!row.filePath && !row.fileName) return res.status(404).json({ error:'Assignment file not found.' });
    const filePath = storedFilePath(row.filePath || '') || storedFilePath(path.join('assignments', String(row.fileName || '')));
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error:'Assignment file not found. The assignment is stored, but its uploaded file is missing from the backend school_data/assignments folder.' });
    }

    const relativePath = storedRelativePath(filePath);
    if (relativePath && row.filePath !== relativePath) {
      await run('UPDATE assignments SET file_path=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [relativePath, row.id]);
    }

    return res.download(filePath,row.fileName || 'assignment');
  } catch (error) { res.status(500).json({ error:`Could not download assignment: ${error.message}` }); }
});

app.post('/student/assignments/:id/submit', requireAuth, temporaryUploadSafe, async (req,res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error:'Only students may submit assignments.' });
    const assignment = await getAssignmentForUser(req.user,req.params.id);
    if (!assignment) return res.status(404).json({ error:'Assignment not found.' });
    // Check the submission window before anything else touches the upload. The window test
    // used to run after the ZIP/conduct validation, so a learner submitting to a closed
    // assignment got a misleading "must be a valid ZIP"/acknowledgement error instead of the
    // real reason, and the uploaded bytes were processed before being discarded.
    const state = assignmentWindowState(assignment);
    if (state !== 'open') { if (req.file?.path) fs.rmSync(req.file.path,{force:true}); return res.status(409).json({ error:assignmentWindowMessage(assignment,state) }); }
    if (!zipUploadAllowed(req.file)) { if (req.file?.path) fs.rmSync(req.file.path,{force:true}); return res.status(415).json({ error:'Assignments must be submitted as a valid ZIP file.' }); }
    if (String(req.body?.conductAcknowledged || '').toLowerCase() !== 'true') { if (req.file?.path) fs.rmSync(req.file.path,{force:true}); return res.status(400).json({ error:'Academic-integrity acknowledgement is required.' }); }
    const existing = await get('SELECT * FROM assignment_submissions WHERE assignment_id=? AND student_id=?',[assignment.id,req.user.studentId]);
    if (existing?.closed) return res.status(409).json({ error:'This submission has been closed by staff and cannot be replaced.' });
    const directory = path.join(STORAGE_ROOT,'assignment-submissions'); fs.mkdirSync(directory,{recursive:true});
    const destination = path.join(directory,`${assignment.id}-${safeSegment(req.user.studentId)}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeSegment(path.basename(req.file.originalname))}`);
    fs.renameSync(req.file.path,destination);
    try {
      await transaction(async () => {
        await run(`INSERT INTO assignment_submissions(assignment_id,student_id,file_name,file_path,completed,closed,conduct_acknowledged) VALUES(?,?,?, ?,1,0,1)
          ON CONFLICT(assignment_id,student_id) DO UPDATE SET file_name=excluded.file_name,file_path=excluded.file_path,submitted_at=CURRENT_TIMESTAMP,completed=1,closed=0,closed_at=NULL,mark=NULL,mark_published_at=NULL,conduct_acknowledged=1,marked_file_name=NULL,marked_file_path=NULL,marked_uploaded_at=NULL,marked_downloaded_at=NULL,reflection=NULL,reflection_updated_at=NULL`,
          [assignment.id,req.user.studentId,path.basename(req.file.originalname),storedRelativePath(destination)]);
      });
    } catch (error) {
      fs.rmSync(destination,{force:true}); throw error;
    }
    if (existing?.file_path) removeStoredFile(existing.file_path);
    const saved = await assignmentSubmissionForUser(req.user,(await get('SELECT id FROM assignment_submissions WHERE assignment_id=? AND student_id=?',[assignment.id,req.user.studentId])).id);
    await auditBestEffort(req.user.id,'assignment_submitted','assignment_submission',saved.id,{assignmentId:assignment.id,fileName:saved.fileName});
    res.status(201).json(assignmentSubmissionRow(saved));
  } catch(error) {
    if (req.file?.path) fs.rmSync(req.file.path,{force:true});
    res.status(error.status || (error.code==='SQLITE_CONSTRAINT'?409:500)).json({ error:`Could not submit assignment: ${error.message}` });
  } finally {
    if (req.file?.path) fs.rmSync(req.file.path,{force:true});
  }
});

app.delete('/student/assignments/:id/submission', requireAuth, async (req,res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error:'Only students may remove their submissions.' });
    const assignment = await getAssignmentForUser(req.user,req.params.id);
    if (!assignment) return res.status(404).json({ error:'Assignment not found.' });
    const submission = await get('SELECT * FROM assignment_submissions WHERE assignment_id=? AND student_id=?',[assignment.id,req.user.studentId]);
    if (!submission) return res.status(404).json({ error:'Submission not found.' });
    if (submission.closed || assignmentWindowState(assignment) !== 'open') return res.status(409).json({ error:'This submission cannot be removed because the assignment or submission is closed.' });
    await run('DELETE FROM assignment_submissions WHERE id=?',[submission.id]);
    removeStoredFile(submission.file_path);
    res.json({ok:true});
  } catch(error) { res.status(500).json({error:`Could not remove submission: ${error.message}`}); }
});

app.get('/api/assignment-submissions/:id/download', requireAuth, async (req,res) => {
  try {
    const row = await assignmentSubmissionForUser(req.user,req.params.id);
    if (!row || !(row.filePath || row.fileName)) return res.status(404).json({error:'Submission file not found.'});
    const filePath = storedFilePath(row.filePath || '') || storedFilePath(path.join('assignment-submissions', String(row.fileName || '')));
    if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({error:'Submission file not found.'});
    res.download(filePath,row.fileName || 'submission.zip');
  } catch(error) { res.status(500).json({error:`Could not download submission: ${error.message}`}); }
});

app.patch('/admin/assignment-submissions/:id/close', requireAdmin, async (req,res) => {
  try {
    const row = await assignmentSubmissionForUser(req.user,req.params.id); if (!row) { if (req.file?.path) fs.rmSync(req.file.path,{force:true}); return res.status(404).json({error:'Submission not found.'}); }
    await run('UPDATE assignment_submissions SET closed=1,closed_at=CURRENT_TIMESTAMP WHERE id=?',[row.id]);
    const updated = await assignmentSubmissionForUser(req.user,row.id);
    await auditBestEffort(req.user.id,'assignment_submission_closed','assignment_submission',row.id,{});
    res.json(assignmentSubmissionRow(updated));
  } catch(error) { res.status(500).json({error:`Could not close submission: ${error.message}`}); }
});

app.post('/admin/assignment-submissions/:id/marked-file', requireAdmin, zipUploadSafe, async (req,res) => {
  let moved = null;
  try {
    const row = await assignmentSubmissionForUser(req.user,req.params.id); if (!row) { if (req.file?.path) fs.rmSync(req.file.path,{force:true}); return res.status(404).json({error:'Submission not found.'}); }
    if (!zipUploadAllowed(req.file)) { if (req.file?.path) fs.rmSync(req.file.path,{force:true}); return res.status(415).json({error:'Marked feedback must be a valid ZIP file.'}); }
    const directory = path.join(STORAGE_ROOT,'assignment-marked'); fs.mkdirSync(directory,{recursive:true});
    const destination = path.join(directory,`${row.id}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${path.basename(req.file.originalname)}`);
    fs.renameSync(req.file.path,destination); moved = destination;
    await run('UPDATE assignment_submissions SET marked_file_name=?,marked_file_path=?,marked_uploaded_at=CURRENT_TIMESTAMP,closed=1,closed_at=COALESCE(closed_at,CURRENT_TIMESTAMP) WHERE id=?',[path.basename(req.file.originalname),storedRelativePath(destination),row.id]);
    moved = null; // SQLite now points at the permanent file; later response failures must not delete it.
    const updated = await assignmentSubmissionForUser(req.user,row.id);
    if (row.markedFilePath) removeStoredFile(row.markedFilePath);
    await run('UPDATE assignment_submissions SET marked_downloaded_at=NULL WHERE id=?',[row.id]);
    await auditBestEffort(req.user.id,'assignment_marked_file_uploaded','assignment_submission',row.id,{fileName:path.basename(req.file.originalname)});
    await notifyStudentOfReturnedWork(row.studentId,row.assignmentId,row.assignmentTitle,'marked-copy');
    res.json(assignmentSubmissionRow({ ...updated, markedDownloadedAt: null }));
  } catch(error) {
    if (moved) fs.rmSync(moved,{force:true}); if (req.file?.path) fs.rmSync(req.file.path,{force:true});
    res.status(error.status || 500).json({error:`Could not upload marked feedback: ${error.message}`});
  } finally {
    if (req.file?.path && !moved) fs.rmSync(req.file.path,{force:true});
  }
});

app.get('/api/assignment-submissions/:id/marked-download', requireAuth, async (req,res) => {
  try {
    const row = await assignmentSubmissionForUser(req.user,req.params.id); if (!row || !(row.markedFilePath || row.markedFileName)) return res.status(404).json({error:'Marked feedback file not found.'});
    if (req.user.role === 'student' && row.markStatus && !['Published','Locked'].includes(String(row.markStatus))) return res.status(404).json({error:'Marked feedback file not found.'});
    const filePath = storedFilePath(row.markedFilePath || '') || storedFilePath(path.join('assignment-marked', String(row.markedFileName || '')));
    if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({error:'Marked feedback file not found.'});
    if (req.user.role === 'student' && !row.markedDownloadedAt) {
      await run('UPDATE assignment_submissions SET marked_downloaded_at=CURRENT_TIMESTAMP WHERE id=?',[row.id]);
    }
    res.download(filePath,row.markedFileName || 'marked-feedback.zip');
  } catch(error) { res.status(500).json({error:`Could not download marked feedback: ${error.message}`}); }
});

app.delete('/admin/assignment-submissions/:id/marked-file', requireAdmin, async (req,res) => {
  try {
    const row = await assignmentSubmissionForUser(req.user,req.params.id);
    if (!row) return res.status(404).json({error:'Submission not found.'});
    if (!row.markedFilePath && !row.markedFileName) return res.status(404).json({error:'No marked copy is attached to this submission.'});
    await run('UPDATE assignment_submissions SET marked_file_name=NULL,marked_file_path=NULL,marked_uploaded_at=NULL,marked_downloaded_at=NULL WHERE id=?',[row.id]);
    if (row.markedFilePath) removeStoredFile(row.markedFilePath);
    await auditBestEffort(req.user.id,'assignment_marked_file_removed','assignment_submission',row.id,{fileName:row.markedFileName});
    res.json(assignmentSubmissionRow(await assignmentSubmissionForUser(req.user,row.id)));
  } catch(error) { res.status(500).json({error:`Could not remove the marked copy: ${error.message}`}); }
});

// Learners record what they got wrong and what they will do differently. It is only accepted once
// a result is visible to them, so it is always a reflection on released feedback.
app.put('/student/assignment-submissions/:id/reflection', requireAuth, async (req,res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({error:'Only students may write a reflection.'});
    const row = await assignmentSubmissionForUser(req.user,req.params.id);
    if (!row) return res.status(404).json({error:'Submission not found.'});
    const released = ['Published','Locked'].includes(String(row.markStatus || '')) || Boolean(row.markedFilePath && !row.markStatus);
    if (!released) return res.status(409).json({error:'You can reflect on this assignment once your marked work has been returned.'});
    const text = String(req.body?.reflection ?? '').trim();
    if (text.length > 4000) return res.status(400).json({error:'Keep your reflection under 4000 characters.'});
    await run('UPDATE assignment_submissions SET reflection=?,reflection_updated_at=CASE WHEN ?=\'\' THEN NULL ELSE CURRENT_TIMESTAMP END WHERE id=?',[text || null,text,row.id]);
    res.json(assignmentSubmissionRow(await assignmentSubmissionForUser(req.user,row.id),true));
  } catch(error) { res.status(500).json({error:`Could not save your reflection: ${error.message}`}); }
});

app.get('/student/assignments', requireAuth, async (req,res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({error:'Only students may use this endpoint.'});
    const academicYear = await getStudentAcademicYear(req.user.studentId);
    const rows = await all(`
      SELECT a.id,a.title,a.subject,a.course,a.year_level AS yearLevel,a.academic_year AS academicYear,
             a.term,a.start_at AS startAt,a.due_date AS dueDate,a.due_time AS dueTime,a.duration,
             a.file_name AS fileName,a.file_path AS filePath,a.owner_id AS ownerId,u.name AS ownerName,
             a.completed,a.open_override AS openOverride,a.active,a.created_at AS createdAt,a.updated_at AS updatedAt
      FROM assignments a LEFT JOIN users u ON u.id=a.owner_id
      WHERE a.active=1
        AND LOWER(TRIM(a.course))=LOWER(TRIM(?))
        AND CAST(a.year_level AS INTEGER)=?
        AND CAST(a.academic_year AS INTEGER)=?
      ORDER BY a.due_date ASC,a.id ASC
    `,[req.user.course,Number(req.user.yearLevel),academicYear]);
    const submissions = await all(`
      SELECT s.id,s.assignment_id AS assignmentId,a.title AS assignmentTitle,a.subject,a.course,a.year_level AS yearLevel,
             s.student_id AS studentId,u.username AS studentUsername,u.name AS studentName,
             s.file_name AS fileName,s.file_path AS filePath,s.submitted_at AS submittedAt,s.completed,s.closed,
             s.closed_at AS closedAt,s.mark,s.mark_published_at AS markPublishedAt,
              m.status AS markStatus,m.feedback AS markFeedback,m.passing_mark AS passingMark,m.mark AS ledgerMark,m.updated_at AS markUpdatedAt,(SELECT mu.name FROM users mu WHERE mu.id=m.updated_by) AS markedByName,
              s.conduct_acknowledged AS conductAcknowledged,
             s.marked_file_name AS markedFileName,s.marked_file_path AS markedFilePath,s.marked_uploaded_at AS markedUploadedAt,s.marked_downloaded_at AS markedDownloadedAt,s.reflection,s.reflection_updated_at AS reflectionUpdatedAt
      FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN users u ON u.student_id=s.student_id
       LEFT JOIN marks m ON m.student_id=s.student_id AND m.assessment_id=('ASSIGN-' || CAST(s.assignment_id AS TEXT))
      WHERE s.student_id=? ORDER BY s.submitted_at DESC
    `,[req.user.studentId]);
    return res.json({assignments:rows.map(assignmentRow),submissions:submissions.map((row) => assignmentSubmissionRow(row, true))});
  } catch(error) { return res.status(500).json({error:`Could not load assignments: ${error.message}`});}
});

app.get('/api/tests', requireAuth, async (req,res) => {
  try {
    const currentYear = new Date().getFullYear();
    let rows;
    if (req.user.role === 'student') {
      rows = await all(`SELECT id,title,subject,course,year_level AS yearLevel,academic_year AS academicYear,
        start_at AS startAt,due_date AS dueDate,due_time AS dueTime,completed,open_override AS openOverride,
        passing_mark AS passingMark,duration_minutes AS durationMinutes,max_attempts AS maxAttempts,questions_json AS questionsJson,
        active,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt
        FROM tests WHERE active=1 AND course=? AND year_level=? ORDER BY academic_year DESC,id`,
        [req.user.course,Number(req.user.yearLevel)]);
    } else if (req.user.role === 'main-admin') {
      rows = await all(`SELECT id,title,subject,course,year_level AS yearLevel,academic_year AS academicYear,
        start_at AS startAt,due_date AS dueDate,due_time AS dueTime,completed,open_override AS openOverride,
        passing_mark AS passingMark,duration_minutes AS durationMinutes,max_attempts AS maxAttempts,questions_json AS questionsJson,
        active,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt
        FROM tests WHERE active=1 ORDER BY academic_year DESC,id`);
    } else {
      rows = await all(`SELECT t.id,t.title,t.subject,t.course,t.year_level AS yearLevel,t.academic_year AS academicYear,
        t.start_at AS startAt,t.due_date AS dueDate,t.due_time AS dueTime,t.completed,t.open_override AS openOverride,
        t.passing_mark AS passingMark,t.duration_minutes AS durationMinutes,t.max_attempts AS maxAttempts,t.questions_json AS questionsJson,
        t.active,t.created_by AS createdBy,t.created_at AS createdAt,t.updated_at AS updatedAt
        FROM tests t WHERE t.active=1 AND EXISTS (
          SELECT 1 FROM staff_course_assignments sc WHERE sc.user_id=? AND sc.course=t.course AND sc.year_level=t.year_level
          AND sc.academic_year=t.academic_year AND sc.active=1) ORDER BY t.academic_year DESC,t.id`,
        [req.user.id]);
    }
    res.json(rows.map((row) => testRow(row, req.user.role === 'student')));
  } catch(error) {
    res.status(500).json({error:`Could not load tests: ${error.message}`});
  }
});


function validateTestQuestions(questions) {
  if (!Array.isArray(questions) || !questions.length) throw Object.assign(new Error('At least one question is required.'), { status: 400 });
  return questions.map((input, index) => {
    const type = input?.type === 'essay' ? 'essay' : 'mcq';
    const question = String(input?.question || '').trim();
    const points = Number(input?.points ?? 1);
    if (!question) throw Object.assign(new Error(`Question ${index + 1} must contain text.`), { status: 400 });
    if (!Number.isFinite(points) || points <= 0 || points > 1000) throw Object.assign(new Error(`Question ${index + 1} must have a mark allocation greater than 0.`), { status: 400 });
    if (type === 'essay') {
      return {
        type,
        question,
        points,
        modelAnswer: String(input?.modelAnswer || '').trim(),
      };
    }
    const options = Array.isArray(input?.options) ? input.options.map((option) => String(option || '').trim()) : [];
    const correct = Number(input?.correct);
    if (options.length < 2 || options.some((option) => !option)) throw Object.assign(new Error(`Question ${index + 1} needs at least two non-empty multiple-choice options.`), { status: 400 });
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) throw Object.assign(new Error(`Question ${index + 1} has an invalid correct-answer index.`), { status: 400 });
    return { type, question, points, options, correct };
  });
}

// Test schedules are stored and displayed as local wall-clock strings ("YYYY-MM-DDTHH:mm"),
// which is what <input type="datetime-local"> both produces and requires. Legacy rows can
// instead hold SQLite's CURRENT_TIMESTAMP default ("YYYY-MM-DD HH:MM:SS", which is UTC) or a
// Z-suffixed ISO string. Both are silently misread as local time by `new Date(...)` and the
// Z form is rejected outright by datetime-local, so normalise every value through here.
const LOCAL_DATETIME_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/;

function toLocalWallClock(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeTestDateTime(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const match = LOCAL_DATETIME_RE.exec(raw);
  if (match) {
    // A space separator only ever comes from SQLite's CURRENT_TIMESTAMP, which is UTC.
    if (raw.includes(' ')) return toLocalWallClock(new Date(`${match[1]}T${match[2]}:00Z`));
    return `${match[1]}T${match[2]}`;
  }
  return toLocalWallClock(new Date(raw));
}

function normalizeTestDueDate(value) {
  const raw = String(value ?? '').trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match ? match[1] : '';
}

function normalizeTestDueTime(value) {
  const raw = String(value ?? '').trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(raw);
  return match ? `${match[1]}:${match[2]}` : '';
}

function validateTestDates(startAt, dueDate, dueTime) {
  const normalizedStart = normalizeTestDateTime(startAt);
  const normalizedDue = normalizeTestDueDate(dueDate);
  const normalizedTime = normalizeTestDueTime(dueTime === undefined || dueTime === null || dueTime === '' ? '23:59' : dueTime);
  if (!normalizedStart || !normalizedDue || !normalizedTime) {
    throw Object.assign(new Error('Test opening and closing date/time must be valid.'), { status: 400 });
  }
  const start = new Date(normalizedStart);
  const due = new Date(`${normalizedDue}T${normalizedTime}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime()) || due <= start) {
    throw Object.assign(new Error('The test closing date/time must be after its opening date/time.'), { status: 400 });
  }
  return { startAt: normalizedStart, dueDate: normalizedDue, dueTime: normalizedTime };
}

app.post('/admin/tests', requireAdmin, async (req,res)=>{
  try{
    const title=String(req.body?.title||'').trim();
    const subject=String(req.body?.subject||'').trim();
    const course=String(req.body?.course||'').trim();
    const yearLevel=Number(req.body?.yearLevel);
    const academicYear=Number(req.body?.academicYear)||new Date().getFullYear();
    const passingMark=Number(req.body?.passingMark??60);
    const duration=Number(req.body?.durationMinutes??20);
    const maxAttempts=Number(req.body?.maxAttempts??2);
    const questions=validateTestQuestions(req.body?.questions);
    const dates=validateTestDates(req.body?.startAt,req.body?.dueDate,req.body?.dueTime);
    const completed=Boolean(req.body?.completed);
    const openOverride=Boolean(req.body?.openOverride);

    if(!title||!subject||!course||!Number.isInteger(yearLevel)||yearLevel<1||yearLevel>6)return res.status(400).json({error:'Title, subject, course and year are required.'});
    if(!(await findCourse(course))) return res.status(400).json({error:'Choose a course from the current course catalogue.'});
    if(!(await staffHasGroup(req.user,course,yearLevel,academicYear)))return res.status(403).json({error:'You may only create tests for an assigned teaching course/year group.'});
    if(!Number.isFinite(passingMark)||passingMark<0||passingMark>100)return res.status(400).json({error:'Passing mark must be between 0 and 100.'});
    if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>10)return res.status(400).json({error:'Maximum attempts must be a whole number from 1 to 10.'});
    if(!Number.isFinite(duration)||duration<1||duration>1440)return res.status(400).json({error:'Duration must be between 1 and 1440 minutes.'});

    const duplicate=await get(`SELECT id FROM tests WHERE LOWER(title)=LOWER(?) AND course=? AND year_level=? AND academic_year=? AND active=1`,
      [title,course,yearLevel,academicYear]);
    if(duplicate) return res.status(409).json({error:'That test already exists for this course, year and academic year.'});

    const r=await run(`INSERT INTO tests(title,subject,course,year_level,academic_year,start_at,due_date,due_time,completed,open_override,passing_mark,duration_minutes,max_attempts,questions_json,created_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [title,subject,course,yearLevel,academicYear,dates.startAt,dates.dueDate,dates.dueTime,completed?1:0,openOverride?1:0,passingMark,duration,maxAttempts,JSON.stringify(questions),req.user.id]);
    const row=await get(`SELECT id,title,subject,course,year_level AS yearLevel,academic_year AS academicYear,start_at AS startAt,due_date AS dueDate,due_time AS dueTime,completed,open_override AS openOverride,
      passing_mark AS passingMark,duration_minutes AS durationMinutes,max_attempts AS maxAttempts,questions_json AS questionsJson,active,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM tests WHERE id=?`,[r.lastID]);
    await auditBestEffort(req.user.id,'test_created','test',r.lastID,{course,yearLevel,academicYear});
    res.status(201).json(testRow(row));
  }catch(error){
    res.status(error.status || (error.code==='SQLITE_CONSTRAINT'?409:500)).json({error:error.code==='SQLITE_CONSTRAINT'?'That test conflicts with existing data.':`Could not create test: ${error.message}`});
  }
});

app.patch('/admin/tests/:id', requireAdmin, async (req,res)=>{
  try{
    const existing=await get(`SELECT * FROM tests WHERE id=? AND active=1`,[req.params.id]);
    if(!existing)return res.status(404).json({error:'Test not found.'});
    if(!(await staffHasGroup(req.user,existing.course,existing.year_level,existing.academic_year)))return res.status(403).json({error:'That test is outside your teaching allocation.'});

    const title=String(req.body?.title??existing.title).trim();
    const subject=String(req.body?.subject??existing.subject).trim();
    const course=String(req.body?.course??existing.course).trim();
    const yearLevel=Number(req.body?.yearLevel??existing.year_level);
    const academicYear=Number(req.body?.academicYear??existing.academic_year);
    const passingMark=Number(req.body?.passingMark??existing.passing_mark);
    const duration=Number(req.body?.durationMinutes??existing.duration_minutes);
    const maxAttempts=Number(req.body?.maxAttempts??existing.max_attempts);
    const questions=validateTestQuestions(Array.isArray(req.body?.questions)?req.body.questions:JSON.parse(existing.questions_json||'[]'));
    const dates=validateTestDates(req.body?.startAt??existing.start_at,req.body?.dueDate??existing.due_date,req.body?.dueTime??existing.due_time);
    const completed=req.body?.completed===undefined ? Boolean(existing.completed) : Boolean(req.body.completed);
    const openOverride=req.body?.openOverride===undefined ? Boolean(existing.open_override) : Boolean(req.body.openOverride);

    if(!title||!subject||!course||!Number.isInteger(yearLevel)||yearLevel<1||yearLevel>6)return res.status(400).json({error:'Title, subject, course and year are required.'});
    if(!(await staffHasGroup(req.user,course,yearLevel,academicYear)))return res.status(403).json({error:'You may not move a test outside an assigned teaching group.'});
    if(!Number.isFinite(passingMark)||passingMark<0||passingMark>100)return res.status(400).json({error:'Passing mark must be between 0 and 100.'});
    if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>10)return res.status(400).json({error:'Maximum attempts must be a whole number from 1 to 10.'});
    if(!Number.isFinite(duration)||duration<1||duration>1440)return res.status(400).json({error:'Duration must be between 1 and 1440 minutes.'});

    const duplicate=await get(`SELECT id FROM tests WHERE id<>? AND LOWER(title)=LOWER(?) AND course=? AND year_level=? AND academic_year=? AND active=1`,
      [existing.id,title,course,yearLevel,academicYear]);
    if(duplicate)return res.status(409).json({error:'Another test already uses that title in the same course/year.'});

    await transaction(async () => {
      await run(`UPDATE tests SET title=?,subject=?,course=?,year_level=?,academic_year=?,start_at=?,due_date=?,due_time=?,completed=?,open_override=?,passing_mark=?,duration_minutes=?,max_attempts=?,questions_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [title,subject,course,yearLevel,academicYear,dates.startAt,dates.dueDate,dates.dueTime,completed?1:0,openOverride?1:0,passingMark,duration,maxAttempts,JSON.stringify(questions),existing.id]);
      await run('UPDATE assessments SET name=? WHERE id=?',[title,`TEST-${existing.id}`]);
    });
    const row=await get(`SELECT id,title,subject,course,year_level AS yearLevel,academic_year AS academicYear,start_at AS startAt,due_date AS dueDate,due_time AS dueTime,completed,open_override AS openOverride,
      passing_mark AS passingMark,duration_minutes AS durationMinutes,max_attempts AS maxAttempts,questions_json AS questionsJson,active,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM tests WHERE id=?`,[existing.id]);
    await auditBestEffort(req.user.id,'test_updated','test',existing.id,{course,yearLevel,academicYear,completed,openOverride});
    res.json(testRow(row));
  }catch(error){res.status(error.status || 500).json({error:`Could not update test: ${error.message}`});}
});

app.patch('/admin/tests/:id/status', requireAdmin, async (req,res)=>{
  try{
    const existing=await get(`SELECT * FROM tests WHERE id=? AND active=1`,[req.params.id]);
    if(!existing)return res.status(404).json({error:'Test not found.'});
    if(!(await staffHasGroup(req.user,existing.course,existing.year_level,existing.academic_year)))return res.status(403).json({error:'That test is outside your teaching allocation.'});
    const completed=Boolean(req.body?.completed);
    await run(`UPDATE tests SET completed=?,open_override=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[completed?1:0,completed?0:1,existing.id]);
    const row=await get(`SELECT id,title,subject,course,year_level AS yearLevel,academic_year AS academicYear,start_at AS startAt,due_date AS dueDate,due_time AS dueTime,completed,open_override AS openOverride,
      passing_mark AS passingMark,duration_minutes AS durationMinutes,max_attempts AS maxAttempts,questions_json AS questionsJson,active,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM tests WHERE id=?`,[existing.id]);
    await auditBestEffort(req.user.id,completed?'test_closed':'test_reopened','test',existing.id,{completed});
    res.json(testRow(row));
  }catch(error){res.status(500).json({error:`Could not change test status: ${error.message}`});}
});

app.delete('/admin/tests/:id', requireAdmin, async (req,res)=>{
  try{const t=await get(`SELECT * FROM tests WHERE id=? AND active=1`,[req.params.id]);if(!t)return res.status(404).json({error:'Test not found.'});if(!(await staffHasGroup(req.user,t.course,t.year_level,t.academic_year)))return res.status(403).json({error:'That test is outside your teaching allocation.'});await run(`UPDATE tests SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[t.id]);res.json({ok:true});}
  catch(error){res.status(500).json({error:`Could not delete test: ${error.message}`});}
});


app.get('/admin/data', requireAdmin, async (req, res) => {
  const academicYear = new Date().getFullYear();
  const [users, marks, assessments, auditLogs, remediations, testAttempts, teacherAssignments, courses, assignmentRows, assignmentSubmissionRows, testRows] = await Promise.all([
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
        m.weighting,
        m.passing_mark AS passingMark,
        m.feedback,
        m.status,
        m.updated_at AS updatedAt
      FROM marks m
      JOIN users u ON u.student_id = m.student_id
      WHERE EXISTS (
        SELECT 1 FROM staff_course_assignments sc
        WHERE u.role='student' AND sc.user_id=? AND sc.active=1
          AND sc.course=u.course AND sc.year_level=u.year_level
          AND sc.academic_year=COALESCE(
            (SELECT a.academic_year FROM assignments a WHERE m.assessment_id LIKE 'ASSIGN-%' AND a.id=CAST(substr(m.assessment_id,8) AS INTEGER) LIMIT 1),
            (SELECT t.academic_year FROM tests t WHERE m.assessment_id LIKE 'TEST-%' AND t.id=CAST(substr(m.assessment_id,6) AS INTEGER) LIMIT 1),
            ?
          )
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
        WHERE u.role='student' AND sc.user_id=? AND sc.active=1
          AND sc.course=u.course AND sc.year_level=u.year_level
          AND sc.academic_year=COALESCE(
            (SELECT a.academic_year FROM assignments a WHERE r.assessment_id LIKE 'ASSIGN-%' AND a.id=CAST(substr(r.assessment_id,8) AS INTEGER) LIMIT 1),
            (SELECT t.academic_year FROM tests t WHERE r.assessment_id LIKE 'TEST-%' AND t.id=CAST(substr(r.assessment_id,6) AS INTEGER) LIMIT 1),
            ?
          )
      ) OR ? = 'main-admin'
      ORDER BY r.updated_at DESC
    `, req.user.role === 'main-admin' ? [null, null, 'main-admin'] : [req.user.id, new Date().getFullYear(), req.user.role]),

    all(`
      SELECT
        ta.id, ta.test_id AS testId, ta.student_id AS studentId, u.name AS studentName,
        u.course, u.year_level AS yearLevel, ta.attempt_number AS attemptNumber, ta.score,
        ta.earned_points AS earnedPoints, ta.total_points AS totalPoints, ta.correct, ta.total,
        ta.question_marks_json AS questionMarks, ta.answers_json AS answersJson,
        ta.review_question_feedback_json AS questionFeedback, ta.question_snapshot_json AS questionSnapshot,
        ta.needs_review AS needsReview, ta.is_remediation AS isRemediation, ta.passed,
        ta.essay_answers AS essayAnswers, ta.review_feedback AS reviewFeedback, ta.reviewed_by AS reviewedBy,
        ta.reviewed_at AS reviewedAt, ta.taken_at AS takenAt, ta.created_at AS createdAt
      FROM test_attempts ta
      JOIN users u ON u.student_id=ta.student_id
      LEFT JOIN tests t ON t.id=CAST(ta.test_id AS INTEGER)
      WHERE ?='main-admin'
         OR EXISTS (
           SELECT 1 FROM staff_course_assignments sc
           WHERE sc.user_id=? AND sc.active=1
             AND sc.course=u.course AND sc.year_level=u.year_level
             AND sc.academic_year=COALESCE(t.academic_year, ?)
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

    listCourses(),

    all(`
      SELECT a.id,a.title,a.subject,a.course,a.year_level AS yearLevel,a.academic_year AS academicYear,
             a.term,a.start_at AS startAt,a.due_date AS dueDate,a.due_time AS dueTime,a.duration,
             a.file_name AS fileName,a.file_path AS filePath,a.owner_id AS ownerId,u.name AS ownerName,
             a.completed,a.open_override AS openOverride,a.active,a.created_at AS createdAt,a.updated_at AS updatedAt
      FROM assignments a LEFT JOIN users u ON u.id=a.owner_id
      WHERE a.active=1 AND (
        ?='main-admin' OR EXISTS (
          SELECT 1 FROM staff_course_assignments sc
          WHERE sc.user_id=? AND sc.course=a.course AND sc.year_level=a.year_level
            AND sc.academic_year=a.academic_year AND sc.active=1
        )
      )
      ORDER BY a.academic_year DESC,a.due_date ASC,a.id ASC
    `,[req.user.role, req.user.id]),

    all(`
      SELECT s.id,s.assignment_id AS assignmentId,a.title AS assignmentTitle,a.subject,a.course,a.year_level AS yearLevel,
             s.student_id AS studentId,u.username AS studentUsername,u.name AS studentName,
             s.file_name AS fileName,s.file_path AS filePath,s.submitted_at AS submittedAt,s.completed,s.closed,
             s.closed_at AS closedAt,s.mark,s.mark_published_at AS markPublishedAt,
              m.status AS markStatus,m.feedback AS markFeedback,m.passing_mark AS passingMark,m.mark AS ledgerMark,m.updated_at AS markUpdatedAt,(SELECT mu.name FROM users mu WHERE mu.id=m.updated_by) AS markedByName,
              s.conduct_acknowledged AS conductAcknowledged,
             s.marked_file_name AS markedFileName,s.marked_file_path AS markedFilePath,s.marked_uploaded_at AS markedUploadedAt,s.marked_downloaded_at AS markedDownloadedAt,s.reflection,s.reflection_updated_at AS reflectionUpdatedAt
      FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN users u ON u.student_id=s.student_id
       LEFT JOIN marks m ON m.student_id=s.student_id AND m.assessment_id=('ASSIGN-' || CAST(s.assignment_id AS TEXT))
      WHERE a.active=1 AND (
        ?='main-admin' OR EXISTS (
          SELECT 1 FROM staff_course_assignments sc
          WHERE sc.user_id=? AND sc.course=a.course AND sc.year_level=a.year_level
            AND sc.academic_year=a.academic_year AND sc.active=1
        )
      )
      ORDER BY s.submitted_at DESC
    `,[req.user.role, req.user.id]),

    all(`
      SELECT id,title,subject,course,year_level AS yearLevel,academic_year AS academicYear,
             start_at AS startAt,due_date AS dueDate,due_time AS dueTime,
             completed,open_override AS openOverride,
             passing_mark AS passingMark,duration_minutes AS durationMinutes,max_attempts AS maxAttempts,
             questions_json AS questionsJson,active,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt
      FROM tests
      WHERE active=1 AND (
        ?='main-admin' OR EXISTS (
          SELECT 1 FROM staff_course_assignments sc
          WHERE sc.user_id=? AND sc.course=tests.course AND sc.year_level=tests.year_level
            AND sc.academic_year=tests.academic_year AND sc.active=1
        )
      )
      ORDER BY academic_year DESC,id
    `,[req.user.role, req.user.id])
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
    assignments: assignmentRows.map(assignmentRow),
    assignmentSubmissions: assignmentSubmissionRows.map(assignmentSubmissionRow),
    tests: testRows.map(testRow),
    updatedAt: new Date().toISOString()
  });
});

app.get('/admin/marks.csv', requireAdmin, async (req, res) => {
  try {
    // Match the normal administrator data scope: main-admin sees institution-wide marks;
    // an admin only exports marks belonging to learners in their active teaching allocations
    // for the current academic year. This prevents the CSV endpoint from bypassing the
    // role-aware /admin/data filtering used everywhere else in the staff workspace.
    const currentYear = new Date().getFullYear();
    const rows = await all(`
      SELECT m.student_id AS studentId,m.assessment_id AS assessmentId,m.mark,m.weighting,m.status
      FROM marks m
      JOIN users u ON u.student_id=m.student_id AND u.role='student'
      WHERE ?='main-admin'
         OR EXISTS (
           SELECT 1 FROM staff_course_assignments sc
           WHERE sc.user_id=? AND sc.active=1 AND sc.academic_year=?
             AND sc.course=u.course AND sc.year_level=u.year_level
         )
      ORDER BY m.student_id,m.assessment_id
    `, [req.user.role, req.user.id, currentYear]);
    csvResponse(res, 'marks.csv', ['studentId', 'assessmentId', 'mark', 'weighting', 'status'], rows.map(row => [row.studentId, row.assessmentId, row.mark, row.weighting, row.status]));
  } catch (error) {
    res.status(500).json({ error: `Could not export marks: ${error.message}` });
  }
});

app.get('/admin/students.csv', requireAdmin, async (req, res) => {
  try {
    const requested = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requested) ? Math.min(100, Math.max(30, requested)) : 30;
    const currentYear = new Date().getFullYear();
    const rows = await all(`
      SELECT u.student_id AS studentId,u.name,u.username,u.role,u.created_at AS createdAt
      FROM users u
      WHERE u.role='student'
        AND (
          ?='main-admin'
          OR EXISTS (
            SELECT 1 FROM staff_course_assignments sc
            WHERE sc.user_id=? AND sc.active=1 AND sc.academic_year=?
              AND sc.course=u.course AND sc.year_level=u.year_level
          )
        )
      ORDER BY u.name
      LIMIT ?
    `, [req.user.role, req.user.id, currentYear, limit]);
    csvResponse(res, `students-${limit}.csv`, ['studentId', 'name', 'username', 'role', 'createdAt'], rows.map(row => [row.studentId, row.name, row.username, row.role, row.createdAt]));
  } catch (error) {
    res.status(500).json({ error: `Could not export students: ${error.message}` });
  }
});

app.post('/admin/upload-marks', requireAdmin, temporaryUploadSafe, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a CSV file to upload.' });
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
    const weightingRaw = r.weighting == null || r.weighting === '' ? 100 : r.weighting;
    const weighting = Number(weightingRaw);
    const key = `${studentId}|${assessmentId}`;
    let message = !/^[A-Za-z0-9_-]+$/.test(studentId) ? 'Invalid student ID format'
      : !/^[A-Za-z0-9_-]+$/.test(assessmentId) ? 'Invalid assessment ID format'
      : !/^\d+(\.\d+)?$/.test(String(value)) ? 'Mark must be numeric'
      : Number(value) < 0 || Number(value) > 100 ? 'Mark must be between 0 and 100'
      : !Number.isFinite(weighting) || weighting <= 0 || weighting > 100 ? 'Weighting must be greater than 0 and at most 100'
      : seen.has(key) ? 'Duplicate mark' : null;
    if (message) errors.push({ row: i + 2, studentId, assessmentId, error: message }); else { seen.add(key); valid.push({ studentId, assessmentId, mark: Number(value), weighting }); }
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
        await run(`INSERT INTO marks(student_id,assessment_id,mark,weighting,status) VALUES(?,?,?,?, 'Draft') ON CONFLICT(student_id,assessment_id) DO UPDATE SET mark=excluded.mark,weighting=excluded.weighting,status='Draft',updated_at=CURRENT_TIMESTAMP`, [r.studentId, r.assessmentId, r.mark, r.weighting]);
      } return { imported: valid.length };
    }); await auditBestEffort(req.user.id, 'marks_uploaded', 'marks', req.body.schoolId || 'local', { imported: result.imported, errors: errors.length });
    res.status(200).json({ ...result, errors });
  } catch (e) { res.status(500).json({ error: 'Could not import marks.', details: e.message }); } finally { fs.rmSync(req.file.path, { force: true }); }
});

app.get('/student/marks/:schoolId/:studentId', requireAuth, async (req, res) => {
  if (req.user.role === 'student' && req.user.studentId !== req.params.studentId) return res.status(403).json({ error: 'Students may only view their own published results.' });
  // A student having zero published marks yet (e.g. everything is still Draft/Submitted/Approved,
  // or they are a brand-new learner) is a normal empty state, not an error — return 200 with an
  // empty array so the frontend keeps syncing over the API instead of falling back to unreliable
  // browser-only mode just because nothing has been published yet.
  const rows = await all('SELECT student_id AS studentId, assessment_id AS assessmentId, mark, weighting, passing_mark AS passingMark, feedback, status FROM marks WHERE student_id=? AND status IN ("Published","Locked")', [req.params.studentId]);
  res.json(rows);
});

app.get('/student/marks/local/:studentId', requireAuth, async (req, res) => {
  if (req.user.role === 'student' && req.user.studentId !== req.params.studentId) return res.status(403).json({ error: 'Students may only view their own published results.' });
  const rows = await all('SELECT student_id AS studentId, assessment_id AS assessmentId, mark, weighting, passing_mark AS passingMark, feedback, status FROM marks WHERE student_id=? AND status IN ("Published","Locked")', [req.params.studentId]);
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
      ta.earned_points AS earnedPoints,
      ta.total_points AS totalPoints,
      ta.correct,
      ta.total,
      ta.question_marks_json AS questionMarks,
      ta.answers_json AS answersJson,
      ta.needs_review AS needsReview,
      ta.is_remediation AS isRemediation,
      ta.passed,
      ta.essay_answers AS essayAnswers,
      ta.review_feedback AS reviewFeedback,
      ta.reviewed_by AS reviewedBy,
      ta.reviewed_at AS reviewedAt,
      ta.review_question_feedback_json AS questionFeedback,
      ta.question_snapshot_json AS questionSnapshot,
      ta.taken_at AS takenAt,
      ta.created_at AS createdAt
    FROM test_attempts ta
    JOIN users u ON u.student_id=ta.student_id
    WHERE ta.student_id=?
    ORDER BY ta.test_id, ta.attempt_number
  `, [req.user.studentId]);
  res.json(rows.map((row) => testAttemptRow(row, true)));
});

function testIsOpenForStudents(test) {
  if (Boolean(test.completed)) return { open: false, reason: 'This test has been closed by staff.' };
  if (Boolean(test.open_override)) return { open: true, reason: null };
  const start = new Date(normalizeTestDateTime(test.start_at || test.startAt)).getTime();
  const due = new Date(`${normalizeTestDueDate(test.due_date || test.dueDate)}T${normalizeTestDueTime(test.due_time || test.dueTime) || '23:59'}`).getTime();
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(due)) return { open: false, reason: 'The test schedule is invalid.' };
  if (now < start) return { open: false, reason: `This test opens on ${new Date(start).toLocaleString()}.` };
  if (now > due) return { open: false, reason: `This test closed on ${new Date(due).toLocaleString()}.` };
  return { open: true, reason: null };
}

function calculateTestAttempt(questions, answers) {
  let correct = 0;
  let earnedPoints = 0;
  let totalPoints = 0;
  const questionMarks = [];
  const essayAnswers = [];

  questions.forEach((question, index) => {
    const max = Math.max(0.01, Number(question.points ?? 1) || 1);
    totalPoints += max;
    const value = answers[index];
    if (question.type === 'essay') {
      essayAnswers.push({ question: question.question, answer: String(value ?? '') });
      questionMarks.push({ index, awarded: null, max, auto: false, feedback: '' });
      return;
    }
    const selected = Number(value);
    const isCorrect = Number.isInteger(selected) && selected === Number(question.correct);
    if (isCorrect) correct += 1;
    const awarded = isCorrect ? max : 0;
    earnedPoints += awarded;
    questionMarks.push({ index, awarded, max, auto: true, feedback: '' });
  });

  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 10000) / 100 : 0;
  return {
    correct,
    total: questions.filter((question) => question.type !== 'essay').length,
    earnedPoints,
    totalPoints,
    score,
    questionMarks,
    essayAnswers,
    needsReview: questions.some((question) => question.type === 'essay'),
  };
}

async function getTestAttemptContext(id) {
  return get(`
    SELECT
      ta.id,ta.test_id AS testId,ta.student_id AS studentId,ta.attempt_number AS attemptNumber,
      ta.score,ta.earned_points AS earnedPoints,ta.total_points AS totalPoints,
      ta.correct,ta.total,ta.needs_review AS needsReview,ta.is_remediation AS isRemediation,
      ta.passed,ta.question_marks_json AS questionMarks,ta.answers_json AS answersJson,
      ta.essay_answers AS essayAnswers,ta.review_feedback AS reviewFeedback,
      ta.review_question_feedback_json AS questionFeedback,
      ta.question_snapshot_json AS questionSnapshot,
      ta.reviewed_by AS reviewedBy,ta.reviewed_at AS reviewedAt,ta.taken_at AS takenAt,
      ta.created_at AS createdAt,
      t.title,t.subject,t.course,t.year_level AS yearLevel,t.academic_year AS academicYear,
      t.passing_mark AS passingMark,t.max_attempts AS maxAttempts,t.questions_json AS questionsJson,
      t.start_at AS startAt,t.due_date AS dueDate,t.due_time AS dueTime,t.completed,t.open_override AS openOverride,
      u.name AS studentName
    FROM test_attempts ta
    JOIN tests t ON t.id=ta.test_id
    JOIN users u ON u.student_id=ta.student_id
    WHERE ta.id=?
  `, [id]);
}

app.post('/student/test-attempts/start', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students may start test attempts.' });
    const testId = String(req.body?.testId || '').trim();
    const isRemediation = req.body?.isRemediation ? 1 : 0;
    if (!testId) return res.status(400).json({ error: 'testId is required.' });

    const test = await get(`
      SELECT id,title,subject,course,year_level AS yearLevel,academic_year AS academicYear,
        start_at AS startAt,due_date AS dueDate,due_time AS dueTime,completed,open_override AS openOverride,
        passing_mark AS passingMark,duration_minutes AS durationMinutes,max_attempts AS maxAttempts,
        questions_json AS questionsJson,active
      FROM tests WHERE id=? AND active=1
    `, [testId]);
    if (!test) return res.status(404).json({ error: 'Test not found.' });
    if (test.course !== req.user.course || Number(test.yearLevel) !== Number(req.user.yearLevel)) {
      return res.status(403).json({ error: 'This test is outside your assigned course/year.' });
    }

    if (!isRemediation) {
      const window = testIsOpenForStudents(test);
      if (!window.open) return res.status(409).json({ error: window.reason });
    } else {
      const remediation = await fetchRemediationByStudentAssessment(req.user.studentId, `TEST-${testId}`);
      if (!remediation || !['Open','Scheduled','Marked'].includes(remediation.status)) return res.status(409).json({ error: 'No active remediation case exists for this test.' });
      if (remediation.remediationDate) {
        const scheduled = new Date(`${remediation.remediationDate}T${remediation.remediationTime || '00:00'}`).getTime();
        if (Number.isFinite(scheduled) && Date.now() < scheduled) return res.status(409).json({ error: `This remediation test opens on ${new Date(scheduled).toLocaleString()}.` });
      }
      if (Number(remediation.attempts || 0) >= Number(remediation.attemptLimit || 1)) return res.status(409).json({ error: 'The allowed remediation test attempt has already been used.' });
    }

    const existingActive = await get(`
      SELECT id,test_id AS testId,student_id AS studentId,attempt_number AS attemptNumber,
        is_remediation AS isRemediation,question_snapshot_json AS questionSnapshotJson,
        started_at AS startedAt,expires_at AS expiresAt,status
      FROM test_attempt_sessions
      WHERE test_id=? AND student_id=? AND is_remediation=? AND status='active'
      ORDER BY created_at DESC LIMIT 1
    `, [testId, req.user.studentId, isRemediation]);
    if (existingActive) {
      if (new Date(existingActive.expiresAt).getTime() <= Date.now()) {
        await run("UPDATE test_attempt_sessions SET status='expired' WHERE id=? AND status='active'", [existingActive.id]);
      } else {
        return res.json({ ok: true, resumed: true, session: testAttemptSessionRow(existingActive, true), test: testRow(test, true) });
      }
    }

    let questions;
    try { questions = validateTestQuestions(JSON.parse(test.questionsJson || '[]')); } catch (error) {
      return res.status(error.status || 400).json({ error: error.message });
    }

    const counts = await get(`
      SELECT
        SUM(CASE WHEN is_remediation=0 THEN 1 ELSE 0 END) AS normalCount,
        SUM(CASE WHEN is_remediation=1 THEN 1 ELSE 0 END) AS remediationCount,
        COUNT(*) AS totalCount
      FROM test_attempts WHERE test_id=? AND student_id=?
    `, [testId, req.user.studentId]);
    const normalCount = Number(counts?.normalCount || 0);
    const remediationCount = Number(counts?.remediationCount || 0);
    if (!isRemediation && normalCount >= Number(test.maxAttempts)) return res.status(409).json({ error: `No normal attempts remain for ${test.title}.` });
    if (Number(counts?.totalCount || 0) >= 10) return res.status(409).json({ error: 'This test has reached the maximum stored attempt history.' });

    const attemptNumber = Number(counts?.totalCount || 0) + 1;
    const startedAt = new Date();
    const scheduledDue = new Date(`${test.dueDate}T${test.dueTime || '23:59'}`);
    const durationExpiry = new Date(startedAt.getTime() + Number(test.durationMinutes || 20) * 60000);
    const expiresAt = !isRemediation && Number.isFinite(scheduledDue.getTime())
      ? new Date(Math.min(durationExpiry.getTime(), scheduledDue.getTime()))
      : durationExpiry;
    if (expiresAt.getTime() <= startedAt.getTime()) return res.status(409).json({ error: 'The test closing time has already passed.' });

    const sessionId = `TAS-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    await run(`
      INSERT INTO test_attempt_sessions(id,test_id,student_id,attempt_number,is_remediation,question_snapshot_json,started_at,expires_at,status)
      VALUES(?,?,?,?,?,?,?,?,'active')
    `, [sessionId,testId,req.user.studentId,attemptNumber,isRemediation,JSON.stringify(questions),startedAt.toISOString(),expiresAt.toISOString()]);

    const saved = await get(`
      SELECT id,test_id AS testId,student_id AS studentId,attempt_number AS attemptNumber,
        is_remediation AS isRemediation,question_snapshot_json AS questionSnapshotJson,
        started_at AS startedAt,expires_at AS expiresAt,status
      FROM test_attempt_sessions WHERE id=?
    `, [sessionId]);

    await auditBestEffort(req.user.id,'test_attempt_started','test_attempt_session',sessionId,{testId,attemptNumber,isRemediation});
    res.status(201).json({ ok:true, resumed:false, session:testAttemptSessionRow(saved,true), test:testRow(test,true) });
  } catch (error) {
    console.error('Test attempt start error:', error);
    res.status(error.status || (error.code === 'SQLITE_CONSTRAINT' ? 409 : 500)).json({ error:`Could not start test: ${error.message}` });
  }
});

app.get('/student/test-attempt-sessions/:id', requireAuth, async (req,res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error:'Only students may load test sessions.' });
    const row = await get(`
      SELECT id,test_id AS testId,student_id AS studentId,attempt_number AS attemptNumber,
        is_remediation AS isRemediation,question_snapshot_json AS questionSnapshotJson,
        started_at AS startedAt,expires_at AS expiresAt,status
      FROM test_attempt_sessions WHERE id=? AND student_id=?
    `, [req.params.id, req.user.studentId]);
    if (!row) return res.status(404).json({ error:'Test session not found.' });
    if (row.status === 'active' && new Date(row.expiresAt).getTime() <= Date.now()) {
      await run("UPDATE test_attempt_sessions SET status='expired' WHERE id=? AND status='active'", [row.id]);
      row.status = 'expired';
    }
    if (row.status !== 'active') return res.status(409).json({ error:`This test session is ${row.status}.` });
    res.json({ ok:true, session:testAttemptSessionRow(row,true) });
  } catch (error) {
    res.status(500).json({ error:`Could not load test session: ${error.message}` });
  }
});

app.post('/student/test-attempts', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students may submit test attempts.' });
    const testId = String(req.body?.testId || '').trim();
    const sessionId = String(req.body?.sessionId || '').trim();
    const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
    if (!testId || !sessionId) return res.status(400).json({ error: 'testId and sessionId are required.' });

    const context = await get(`
      SELECT s.id AS sessionId,s.test_id AS testId,s.student_id AS studentId,s.attempt_number AS attemptNumber,
        s.is_remediation AS isRemediation,s.question_snapshot_json AS questionSnapshotJson,
        s.started_at AS startedAt,s.expires_at AS expiresAt,s.status AS sessionStatus,
        t.title,t.subject,t.course,t.year_level AS yearLevel,t.academic_year AS academicYear,
        t.start_at AS startAt,t.due_date AS dueDate,t.due_time AS dueTime,t.passing_mark AS passingMark,
        t.max_attempts AS maxAttempts,t.duration_minutes AS durationMinutes,t.active,t.completed,t.open_override AS openOverride
      FROM test_attempt_sessions s JOIN tests t ON t.id=s.test_id
      WHERE s.id=? AND s.test_id=? AND s.student_id=?
    `, [sessionId,testId,req.user.studentId]);
    if (!context) return res.status(404).json({ error:'Test session not found.' });
    if (context.course !== req.user.course || Number(context.yearLevel) !== Number(req.user.yearLevel)) return res.status(403).json({ error:'This test is outside your assigned course/year.' });
    if (context.sessionStatus !== 'active') return res.status(409).json({ error:`This test session is ${context.sessionStatus}.` });
    if (new Date(context.expiresAt).getTime() <= Date.now()) {
      await run("UPDATE test_attempt_sessions SET status='expired' WHERE id=? AND status='active'", [sessionId]);
      return res.status(409).json({ error:'The test time has expired. Your last locally saved work remains in this browser.' });
    }

    let questions = [];
    try { questions = validateTestQuestions(JSON.parse(context.questionSnapshotJson || '[]')); } catch (error) {
      return res.status(error.status || 400).json({ error:error.message });
    }
    const calculated = calculateTestAttempt(questions, answers);

    const duplicate = await get(`
      SELECT ta.id,ta.test_id AS testId,ta.student_id AS studentId,u.name AS studentName,u.course,u.year_level AS yearLevel,
        ta.attempt_number AS attemptNumber,ta.score,ta.earned_points AS earnedPoints,ta.total_points AS totalPoints,
        ta.correct,ta.total,ta.question_marks_json AS questionMarks,ta.answers_json AS answersJson,
        ta.needs_review AS needsReview,ta.is_remediation AS isRemediation,ta.passed,
        ta.essay_answers AS essayAnswers,ta.review_feedback AS reviewFeedback,
        ta.review_question_feedback_json AS questionFeedback,ta.question_snapshot_json AS questionSnapshot,
        ta.reviewed_by AS reviewedBy,ta.reviewed_at AS reviewedAt,ta.taken_at AS takenAt,ta.created_at AS createdAt
      FROM test_attempts ta JOIN users u ON u.student_id=ta.student_id
      WHERE ta.session_id=?
    `, [sessionId]);
    if (duplicate) return res.json({ok:true,attempt:testAttemptRow(duplicate,true),duplicate:true,needsReview:Boolean(duplicate.needsReview)});

    let savedMark = null;
    let savedRemediation = null;
    await transaction(async () => {
      await run('INSERT OR IGNORE INTO assessments(id,name,max_mark) VALUES(?,?,?)', [`TEST-${testId}`,context.title,calculated.totalPoints]);
      await run(`
        INSERT INTO test_attempts(
          test_id,student_id,attempt_number,score,earned_points,total_points,correct,total,
          needs_review,passed,essay_answers,question_marks_json,answers_json,review_question_feedback_json,
          question_snapshot_json,session_id,is_remediation,taken_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `, [
        testId,req.user.studentId,Number(context.attemptNumber),calculated.score,calculated.earnedPoints,calculated.totalPoints,
        calculated.correct,calculated.total,calculated.needsReview ? 1 : 0,
        calculated.needsReview ? null : (calculated.score >= Number(context.passingMark) ? 1 : 0),
        JSON.stringify(calculated.essayAnswers),JSON.stringify(calculated.questionMarks),JSON.stringify(answers),JSON.stringify([]),
        JSON.stringify(questions),sessionId,Number(context.isRemediation),new Date().toISOString()
      ]);
      await run("UPDATE test_attempt_sessions SET status='submitted' WHERE id=? AND status='active'", [sessionId]);

      if (Number(context.isRemediation)) {
        const remediation = await fetchRemediationByStudentAssessment(req.user.studentId, `TEST-${testId}`);
        if (!remediation) throw new Error('No active remediation case exists for this test.');
        if (calculated.needsReview) {
          await run(`UPDATE remediations SET attempts=attempts+1,status='Submitted',updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [req.user.id,remediation.id]);
          savedRemediation = await fetchRemediationByStudentAssessment(req.user.studentId, `TEST-${testId}`);
        } else {
          await run(`UPDATE remediations SET attempts=attempts+1,remediation_mark=?,status=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [calculated.score,calculated.score >= Number(context.passingMark) ? 'Resolved' : 'Marked',req.user.id,remediation.id]);
          savedRemediation = await fetchRemediationByStudentAssessment(req.user.studentId, `TEST-${testId}`);
        }
      } else if (!calculated.needsReview) {
        const existingMark = await get('SELECT id,mark,status,feedback FROM marks WHERE student_id=? AND assessment_id=?',[req.user.studentId,`TEST-${testId}`]);
        const bestScore = Math.max(Number(existingMark?.mark ?? 0),calculated.score);
        const feedback = bestScore < Number(context.passingMark)
          ? `Remediation is required below ${Number(context.passingMark)}% on ${context.title}.`
          : `${context.title} passed at the ${Number(context.passingMark)}% threshold.`;
        await run(`
          INSERT INTO marks(student_id,assessment_id,mark,weighting,passing_mark,feedback,status,updated_at)
          VALUES(?,?,?,?,?,?,'Published',CURRENT_TIMESTAMP)
          ON CONFLICT(student_id,assessment_id) DO UPDATE SET
            mark=CASE WHEN excluded.mark > marks.mark THEN excluded.mark ELSE marks.mark END,
            weighting=excluded.weighting,passing_mark=excluded.passing_mark,feedback=excluded.feedback,status='Published',updated_at=CURRENT_TIMESTAMP
        `,[req.user.studentId,`TEST-${testId}`,bestScore,100,Number(context.passingMark),feedback]);
        savedMark = await get(`SELECT id,student_id AS studentId,assessment_id AS assessmentId,mark,weighting,passing_mark AS passingMark,feedback,status FROM marks WHERE student_id=? AND assessment_id=?`,[req.user.studentId,`TEST-${testId}`]);
        if (calculated.score < Number(context.passingMark)) {
          savedRemediation = await fetchRemediationByStudentAssessment(req.user.studentId,`TEST-${testId}`) || await upsertRemediationCase({
            studentId:req.user.studentId,assessmentId:`TEST-${testId}`,assignmentId:null,assignmentTitle:context.title,subject:context.subject,
            reason:'failed_mark',originalMark:calculated.score,passingMark:Number(context.passingMark),attemptLimit:1,status:'Open',createdBy:req.user.id
          });
        }
      }
    });

    const saved = await get(`
      SELECT ta.id,ta.test_id AS testId,ta.student_id AS studentId,u.name AS studentName,u.course,u.year_level AS yearLevel,
        ta.attempt_number AS attemptNumber,ta.score,ta.earned_points AS earnedPoints,ta.total_points AS totalPoints,
        ta.correct,ta.total,ta.question_marks_json AS questionMarks,ta.answers_json AS answersJson,
        ta.needs_review AS needsReview,ta.is_remediation AS isRemediation,ta.passed,
        ta.essay_answers AS essayAnswers,ta.review_feedback AS reviewFeedback,ta.review_question_feedback_json AS questionFeedback,
        ta.question_snapshot_json AS questionSnapshot,ta.reviewed_by AS reviewedBy,ta.reviewed_at AS reviewedAt,ta.taken_at AS takenAt,ta.created_at AS createdAt
      FROM test_attempts ta JOIN users u ON u.student_id=ta.student_id WHERE ta.session_id=?
    `,[sessionId]);

    let stakeholder = null;
    if (savedRemediation && savedRemediation.reason === 'failed_mark') {
      stakeholder = await notifyRemediationStakeholders(savedRemediation.id,'Test remediation required');
      savedRemediation = await fetchRemediationByStudentAssessment(req.user.studentId,`TEST-${testId}`);
    }
    await auditBestEffort(req.user.id,'test_attempt_submitted','test_attempt',saved?.id||null,{testId,studentId:req.user.studentId,attemptNumber:Number(context.attemptNumber),score:calculated.score,needsReview:calculated.needsReview,isRemediation:Number(context.isRemediation)});
    res.status(201).json({ok:true,attempt:testAttemptRow(saved,true),duplicate:false,mark:savedMark,remediation:savedRemediation,needsReview:Boolean(calculated.needsReview),email:stakeholder?.email||null});
  } catch(error) {
    console.error('Test attempt save error:',error);
    res.status(error.status || (error.code==='SQLITE_CONSTRAINT'?409:500)).json({error:`Could not save test attempt: ${error.message}`});
  }
});

app.patch('/admin/test-attempts/:id/mark', requireAdmin, async (req,res) => {
  try {
    const context = await getTestAttemptContext(req.params.id);
    if (!context) return res.status(404).json({ error: 'Test attempt not found.' });
    if (!(await staffHasGroup(req.user, context.course, context.yearLevel, context.academicYear))) {
      return res.status(403).json({ error: 'That test attempt is outside your teaching allocation.' });
    }

    let questions = [];
    try { questions = validateTestQuestions(JSON.parse(context.questionSnapshot || context.questionsJson || '[]')); } catch (error) {
      return res.status(error.status || 400).json({ error: error.message });
    }

    if (Number(context.isRemediation) && !['Open','Scheduled','Submitted','Marked'].includes(
      (await fetchRemediationByStudentAssessment(context.studentId, `TEST-${context.testId}`))?.status
    )) return res.status(409).json({ error: 'The remediation case is not open for marking.' });

    const values = Array.isArray(req.body?.questionMarks) ? req.body.questionMarks : [];
    const feedbackValues = Array.isArray(req.body?.questionFeedback) ? req.body.questionFeedback : [];
    if (values.length !== questions.length) return res.status(400).json({ error: 'A mark is required for every question.' });
    if (feedbackValues.length && feedbackValues.length !== questions.length) return res.status(400).json({ error: 'Question feedback must contain one entry per question or be omitted.' });

    const questionMarks = [];
    const questionFeedback = questions.map((_, index) => String(feedbackValues[index] || '').trim());
    let earnedPoints = 0;
    let totalPoints = 0;
    let correct = 0;

    questions.forEach((question, index) => {
      const max = Math.max(0.01, Number(question.points ?? 1));
      const awarded = Number(values[index]);
      if (!Number.isFinite(awarded) || awarded < 0 || awarded > max) {
        throw Object.assign(new Error(`Question ${index + 1} must be marked between 0 and ${max}.`), { status: 400 });
      }
      totalPoints += max;
      earnedPoints += awarded;
      if (question.type !== 'essay' && awarded >= max) correct += 1;
      questionMarks.push({
        index,
        awarded,
        max,
        auto: false,
        feedback: questionFeedback[index] || '',
      });
    });

    const score = Math.round((earnedPoints / totalPoints) * 10000) / 100;
    const passed = score >= Number(context.passingMark);
    const feedback = String(req.body?.feedback || '').trim();
    const existingMark = await get('SELECT id,mark,status,feedback FROM marks WHERE student_id=? AND assessment_id=?', [context.studentId, `TEST-${context.testId}`]);
    if (existingMark?.status === 'Locked' && req.user.role !== 'main-admin') {
      return res.status(403).json({ error: 'Only the main administrator can correct a locked test result.' });
    }
    const markStatus = req.user.role === 'main-admin' ? 'Published' : 'Approved';

    await transaction(async () => {
      // Keep the attempt review and the published/approved mark atomic. If the mark write or
      // remediation update fails, the learner's previous review state remains intact.
      await run(`
        UPDATE test_attempts SET score=?,earned_points=?,total_points=?,correct=?,total=?,question_marks_json=?,
          review_question_feedback_json=?,needs_review=0,passed=?,review_feedback=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP
        WHERE id=?
      `, [
        score,earnedPoints,totalPoints,correct,questions.filter((question) => question.type !== 'essay').length,
        JSON.stringify(questionMarks),JSON.stringify(questionFeedback),passed?1:0,feedback,req.user.id,context.id
      ]);
      await run('INSERT OR IGNORE INTO assessments(id,name,max_mark) VALUES(?,?,?)', [`TEST-${context.testId}`, context.title, totalPoints]);
      await run(`
        INSERT INTO marks(student_id,assessment_id,mark,weighting,passing_mark,feedback,status,updated_at)
        VALUES(?,?,?,?,?, ?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(student_id,assessment_id)
        DO UPDATE SET mark=excluded.mark,weighting=excluded.weighting,passing_mark=excluded.passing_mark,feedback=excluded.feedback,status=excluded.status,updated_at=CURRENT_TIMESTAMP
      `, [context.studentId,`TEST-${context.testId}`,score,100,Number(context.passingMark),feedback,markStatus]);

      if (context.isRemediation) {
        const remediation = await fetchRemediationByStudentAssessment(context.studentId, `TEST-${context.testId}`);
        if (!remediation) throw new Error('Remediation case not found.');
        await run(`UPDATE remediations SET remediation_mark=?,status=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
          [score, req.user.role === 'main-admin' && passed ? 'Resolved' : 'Marked', req.user.id, remediation.id]);
      } else if (!passed) {
        const existingRemediation = await fetchRemediationByStudentAssessment(context.studentId, `TEST-${context.testId}`);
        if (existingRemediation) {
          await run(`UPDATE remediations SET original_mark=?,passing_mark=?,status=CASE WHEN status IN ('Completed','Resolved','Cancelled') THEN 'Open' ELSE status END,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [score,Number(context.passingMark),req.user.id,existingRemediation.id]);
        } else {
          await upsertRemediationCase({
            studentId:context.studentId,assessmentId:`TEST-${context.testId}`,assignmentId:null,assignmentTitle:context.title,subject:context.subject,
            reason:'failed_mark',originalMark:score,passingMark:Number(context.passingMark),attemptLimit:1,status:'Open',createdBy:req.user.id
          });
        }
      } else {
        const remediationStatus = req.user.role === 'main-admin' ? 'Resolved' : 'Marked';
        await run(`UPDATE remediations SET status=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE student_id=? AND assessment_id=? AND status<>'Cancelled'`,
          [remediationStatus,req.user.id,context.studentId,`TEST-${context.testId}`]);
      }
    });

    const attemptRow = await get(`
      SELECT ta.id,ta.test_id AS testId,ta.student_id AS studentId,u.name AS studentName,u.course,u.year_level AS yearLevel,
        ta.attempt_number AS attemptNumber,ta.score,ta.earned_points AS earnedPoints,ta.total_points AS totalPoints,
        ta.correct,ta.total,ta.question_marks_json AS questionMarks,ta.answers_json AS answersJson,
        ta.needs_review AS needsReview,ta.is_remediation AS isRemediation,ta.passed,
        ta.essay_answers AS essayAnswers,ta.review_feedback AS reviewFeedback,ta.review_question_feedback_json AS questionFeedback,
        ta.question_snapshot_json AS questionSnapshot,ta.reviewed_by AS reviewedBy,
        ta.reviewed_at AS reviewedAt,ta.taken_at AS takenAt,ta.created_at AS createdAt
      FROM test_attempts ta JOIN users u ON u.student_id=ta.student_id WHERE ta.id=?`, [context.id]
    );
    const mark = await get(`SELECT id,student_id AS studentId,assessment_id AS assessmentId,mark,weighting,passing_mark AS passingMark,feedback,status FROM marks WHERE student_id=? AND assessment_id=?`,
      [context.studentId,`TEST-${context.testId}`]);
    let remediation = await fetchRemediationByStudentAssessment(context.studentId,`TEST-${context.testId}`);

    let stakeholder = null;
    if (remediation && !passed) {
      stakeholder = await notifyRemediationStakeholders(remediation.id, 'Test remediation required');
      remediation = await fetchRemediationByStudentAssessment(context.studentId,`TEST-${context.testId}`);
    }

    await auditBestEffort(req.user.id,'test_attempt_marked','test_attempt',context.id,{testId:context.testId,studentId:context.studentId,score,passed});

    res.json({
      ok:true,
      attempt:testAttemptRow(attemptRow),
      mark:{
        ...mark,
        mark: Number(mark.mark),
        passingMark: Number(mark.passingMark),
      },
      remediation,
      email:stakeholder?.email || null,
    });
  } catch(error) {
    console.error('Test attempt marking error:', error);
    res.status(error.status || 500).json({ error:`Could not mark test attempt: ${error.message}` });
  }
});


app.get('/admin/test-attempts', requireAdmin, async (req, res) => {
  const currentYear = new Date().getFullYear();
  const rows = await all(`
    SELECT
      ta.id, ta.test_id AS testId, ta.student_id AS studentId, u.name AS studentName,
      u.course, u.year_level AS yearLevel, ta.attempt_number AS attemptNumber, ta.score,
      ta.earned_points AS earnedPoints, ta.total_points AS totalPoints, ta.correct, ta.total,
      ta.question_marks_json AS questionMarks, ta.answers_json AS answersJson,
      ta.needs_review AS needsReview, ta.is_remediation AS isRemediation, ta.passed,
      ta.essay_answers AS essayAnswers, ta.review_feedback AS reviewFeedback, ta.review_question_feedback_json AS questionFeedback,
      ta.question_snapshot_json AS questionSnapshot, ta.reviewed_by AS reviewedBy,
      ta.reviewed_at AS reviewedAt, ta.taken_at AS takenAt, ta.created_at AS createdAt
    FROM test_attempts ta
    JOIN users u ON u.student_id=ta.student_id
    LEFT JOIN tests t ON t.id=CAST(ta.test_id AS INTEGER)
    WHERE ?='main-admin'
       OR EXISTS (
         SELECT 1
         FROM staff_course_assignments sc
         WHERE sc.user_id=? AND sc.active=1
           AND sc.course=u.course AND sc.year_level=u.year_level
           AND sc.academic_year=COALESCE(t.academic_year, ?)
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
    if (!(await staffCanManageStudent(req, res, mark.student_id, await academicYearForAssessment(mark.assessment_id)))) return;
    if (['Published', 'Locked'].includes(next) && req.user.role !== 'main-admin') {
      return res.status(403).json({ error: 'Only the main administrator can publish or lock final results.' });
    }
    await run('UPDATE marks SET status=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [next, req.user.id, req.params.id]);

    // Publishing through the approval workflow must leave the submission in the same state as a
    // direct release: published timestamp set and closed, so a resubmission cannot wipe the result
    // and the learner can see the marked copy.
    const approvedAssignmentId = String(mark.assessment_id).startsWith('ASSIGN-') ? Number(String(mark.assessment_id).slice(7)) : null;
    if (next === 'Published' && Number.isInteger(approvedAssignmentId) && approvedAssignmentId > 0) {
      await run(`UPDATE assignment_submissions SET mark=?,mark_published_at=CURRENT_TIMESTAMP,closed=1,closed_at=COALESCE(closed_at,CURRENT_TIMESTAMP)
        WHERE assignment_id=? AND student_id=?`, [Number(mark.mark), approvedAssignmentId, mark.student_id]);
      const assignment = await get('SELECT title FROM assignments WHERE id=?', [approvedAssignmentId]);
      await notifyStudentOfReturnedWork(mark.student_id, approvedAssignmentId, assignment?.title || mark.assessment_id, 'result');
    }

    if (next === 'Published') {
      const passingMark = Number(mark.passing_mark ?? 60);
      const assessment = await get('SELECT name FROM assessments WHERE id=?', [mark.assessment_id]);
      if (Number(mark.mark) < passingMark) {
        const remediation = await upsertRemediationCase({
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
        await notifyRemediationStakeholders(remediation.id, 'Remediation required');
      } else {
        await run("UPDATE remediations SET status='Resolved', updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE student_id=? AND assessment_id=? AND status<>'Cancelled'", [req.user.id, mark.student_id, mark.assessment_id]);
      }
    }

    await auditBestEffort(req.user.id, next === 'Published' ? 'marks_published' : 'mark_status_changed', 'mark', req.params.id, { status: next });
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
      passingMark,
      weighting
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
    const numericWeighting = weighting === undefined || weighting === null || weighting === '' ? 100 : Number(weighting);
    if (!Number.isFinite(numericWeighting) || numericWeighting <= 0 || numericWeighting > 100) {
      return res.status(400).json({ error: 'Weighting must be greater than 0 and at most 100.' });
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

    const requestedStatus = String(status || '').trim();
    if (requestedStatus === 'Locked') return res.status(400).json({ error: 'Locked is managed by the result workflow, not the marking-room release action.' });
    // The Results page uses this endpoint to create a stored Draft, while the marking room
    // uses it to submit/publish a completed marking sheet. Never let an arbitrary client status
    // bypass the role workflow: admins can only create/submit, and only the main administrator
    // can publish.
    const releaseStatus = requestedStatus === 'Draft'
      ? 'Draft'
      : req.user.role === 'main-admin'
        ? 'Published'
        : 'Submitted';
    const isOverride = req.user.role === 'main-admin' && Boolean(override);

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
    if (!(await staffCanManageStudent(req, res, studentId, await academicYearForAssessment(assessmentId, req.body?.academicYear)))) return;
    // ------------------------------------------------------------
    // See whether this mark already exists
    // ------------------------------------------------------------

    const existing = await get(
      `SELECT
         id,
         student_id,
         assessment_id,
         mark,
         weighting,
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
        // A retry can arrive after the learner submitted (or after an earlier sync failed), so the
        // submission row is repaired here too; otherwise the learner could re-upload over a result.
        if (String(assessmentId).startsWith('ASSIGN-')) {
          const assignmentId = Number(String(assessmentId).slice('ASSIGN-'.length));
          if (Number.isInteger(assignmentId) && assignmentId > 0) {
            await run(`UPDATE assignment_submissions
              SET mark=?, mark_published_at=COALESCE(mark_published_at, CURRENT_TIMESTAMP),
                  closed=1, closed_at=COALESCE(closed_at, CURRENT_TIMESTAMP)
              WHERE assignment_id=? AND student_id=? AND (mark IS NULL OR mark<>? OR closed=0)`,
              [numericMark, assignmentId, studentId, numericMark]);
          }
        }
        return res.json({
          ok: true,
          id: existing.id,
          studentId,
          assessmentId,
          mark: numericMark,
          weighting: Number(existing.weighting ?? numericWeighting),
          status: existing.status,
          release: existing,
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
           weighting,
           passing_mark,
           feedback,
           status,
           updated_by
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(student_id, assessment_id)
         DO UPDATE SET
           mark=excluded.mark,
           weighting=excluded.weighting,
           passing_mark=excluded.passing_mark,
           feedback=excluded.feedback,
           status=excluded.status,
           updated_by=excluded.updated_by,
           updated_at=CURRENT_TIMESTAMP`,
        [
          studentId,
          assessmentId,
          numericMark,
          numericWeighting,
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

    // Keep the assignment submission record and the marks ledger in sync.
    if (String(assessmentId).startsWith('ASSIGN-')) {
      const assignmentId = Number(String(assessmentId).slice('ASSIGN-'.length));
      if (Number.isInteger(assignmentId) && assignmentId > 0) {
        await run(`UPDATE assignment_submissions
          SET mark=?,mark_published_at=CASE WHEN ?='Published' THEN CURRENT_TIMESTAMP ELSE mark_published_at END,
              closed=CASE WHEN ?='Published' THEN 1 ELSE closed END,
              closed_at=CASE WHEN ?='Published' THEN COALESCE(closed_at,CURRENT_TIMESTAMP) ELSE closed_at END
          WHERE assignment_id=? AND student_id=?`,
          [numericMark, releaseStatus, releaseStatus, releaseStatus, assignmentId, studentId]);
        if (releaseStatus === 'Published') {
          const assignment = await get('SELECT title FROM assignments WHERE id=?', [assignmentId]);
          await notifyStudentOfReturnedWork(studentId, assignmentId, assignment?.title || assessmentName || assessmentId, 'result');
        }
      }
    }

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

    await auditBestEffort(
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
         weighting,
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
    const existing = await get('SELECT * FROM marks WHERE id=?',[req.params.id]);
    if (!existing) {
      return res.status(404).json({ error:'Mark not found.' });
    }
    const academicYear = await academicYearForAssessment(existing.assessment_id);
    if (!(await staffCanManageStudent(req, res, existing.student_id, academicYear))) return;

    const remediationRows = await all('SELECT id,file_path AS filePath FROM remediations WHERE student_id=? AND assessment_id=?',[existing.student_id,existing.assessment_id]);
    const remediationIds = remediationRows.map((row)=>row.id).filter(Boolean);
    const remediationAttempts = remediationIds.length
      ? await all(`SELECT file_path AS filePath FROM remediation_attempts WHERE remediation_id IN (${remediationIds.map(() => '?').join(',')})`, remediationIds)
      : [];
    const mark = await deleteMark(req.params.id);
    if (!mark) return res.status(404).json({ error:'Mark not found.' });

    for (const filePath of [...remediationRows.map((row)=>row.filePath), ...remediationAttempts.map((row)=>row.filePath)]) {
      removeStoredFile(filePath);
    }

    await auditBestEffort(
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
    if (!(await staffCanManageStudent(req, res, current.student_id, await academicYearForAssessment(current.assessment_id)))) return;
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
    if (req.body.weighting !== undefined) {
      const value = Number(req.body.weighting);
      if (!Number.isFinite(value) || value <= 0 || value > 100) return res.status(400).json({ error: 'Weighting must be greater than 0 and at most 100.' });
      fields.push('weighting=?'); params.push(value);
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
        const remediation = await upsertRemediationCase({
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
        await notifyRemediationStakeholders(remediation.id, 'Remediation required');
      } else {
        await run("UPDATE remediations SET status='Resolved', updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE student_id=? AND assessment_id=? AND status<>'Cancelled'", [req.user.id, updated.student_id, updated.assessment_id]);
      }
    }
    await auditBestEffort(req.user.id, updated.status === 'Locked' ? 'marks_corrected' : 'marks_edited', 'mark', req.params.id, { changed: fields });
    res.json({ ok: true, mark: updated });
  } catch (error) {
    console.error('Mark update error:', error);
    res.status(500).json({ error: `Could not update the mark: ${error.message}` });
  }
});
app.patch('/admin/accounts/:id', requireAdmin, async (req, res) => {
  const user = await get('SELECT * FROM users WHERE id=?', [req.params.id]); if (!user) return res.status(404).json({ error: 'Account not found.' });
  const fields = [], params = []; if (typeof req.body.name === 'string') { fields.push('name=?'); params.push(req.body.name.trim()); }
  if (typeof req.body.studentId === 'string') { fields.push('student_id=?'); params.push(req.body.studentId.trim()); }
  if (!fields.length) return res.status(400).json({ error: 'No account changes supplied.' }); params.push(req.params.id);
  await run(`UPDATE users SET ${fields.join(',')} WHERE id=?`, params); await auditBestEffort(req.user.id, 'student_account_changed', 'user', req.params.id, req.body); res.json({ ok: true });
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

  if (target.role === 'main-admin' && role !== 'main-admin') {
    return res.status(403).json({
      error: 'The primary main administrator cannot be demoted.'
    });
  }

  if (role === 'main-admin') {
    if (req.user.role !== 'main-admin') {
      return res.status(403).json({
        error: 'Only the main administrator can create or assign the main administrator role.'
      });
    }
    const existingMainAdmin = await get(
      "SELECT id FROM users WHERE role='main-admin' AND id<>? LIMIT 1",
      [req.params.id]
    );
    if (existingMainAdmin) {
      return res.status(409).json({
        error: 'A main administrator already exists.'
      });
    }
  }

  await run(
    'UPDATE users SET role=? WHERE id=?',
    [role, req.params.id]
  );

  await auditBestEffort(
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
      `SELECT id, username, role, student_id AS studentId
       FROM users
       WHERE id=?`,
      [req.params.id]
    );

    if (!target) return res.status(404).json({ error: 'Account not found.' });
    if (target.role === 'main-admin') return res.status(403).json({ error: 'The main administrator account cannot be deleted.' });
    if (req.user.role !== 'main-admin' && target.role !== 'student') {
      return res.status(403).json({ error: 'Only the main administrator can delete administrator accounts.' });
    }

    const files = [];
    if (target.studentId) {
      const submissions = await all('SELECT file_path AS filePath,marked_file_path AS markedFilePath FROM assignment_submissions WHERE student_id=?',[target.studentId]);
      files.push(...submissions.flatMap((row)=>[row.filePath,row.markedFilePath]));
      const remediations = await all('SELECT id,file_path AS filePath FROM remediations WHERE student_id=?',[target.studentId]);
      files.push(...remediations.map((row)=>row.filePath));
      const remediationIds = remediations.map((row)=>row.id).filter(Boolean);
      if (remediationIds.length) {
        const attempts = await all(`SELECT file_path AS filePath FROM remediation_attempts WHERE remediation_id IN (${remediationIds.map(() => '?').join(',')})`, remediationIds);
        files.push(...attempts.map((row)=>row.filePath));
      }
      const photo = await get('SELECT photo_path AS photoPath FROM student_card_profiles WHERE student_id=?',[target.studentId]);
      if (photo?.photoPath) files.push(photo.photoPath);
    }

    await transaction(async () => {
      if (target.studentId) {
        await run('DELETE FROM marks WHERE student_id=?',[target.studentId]);
      }
      await run('DELETE FROM password_resets WHERE user_id=?',[target.id]);
      await run('DELETE FROM sessions WHERE user_id=?',[target.id]);
      await run('DELETE FROM users WHERE id=?',[target.id]);
    });

    for (const filePath of files) {
      // Keep cleanup within the intended storage root; missing/locked files are logged but do not
      // make an already-committed account deletion look like a failed operation.
      removeStoredFile(filePath);
    }

    await auditBestEffort(req.user.id,'user_deleted','user',target.id,{username:target.username,role:target.role});
    return res.json({ ok:true });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'Could not delete account.' });
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
         WHERE sc.user_id=? AND sc.active=1
           AND sc.course=u.course AND sc.year_level=u.year_level
           AND sc.academic_year=COALESCE(
             (SELECT a.academic_year FROM assignments a WHERE r.assessment_id LIKE 'ASSIGN-%' AND a.id=CAST(substr(r.assessment_id,8) AS INTEGER) LIMIT 1),
             (SELECT t.academic_year FROM tests t WHERE r.assessment_id LIKE 'TEST-%' AND t.id=CAST(substr(r.assessment_id,6) AS INTEGER) LIMIT 1),
             ?
           )
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
    const remediationAcademicYear = req.body?.academicYear != null
      ? Number(req.body.academicYear)
      : await academicYearForAssessment(assessmentId);
    if (!Number.isInteger(remediationAcademicYear) || remediationAcademicYear < 2000 || remediationAcademicYear > 2100) {
      return res.status(400).json({ error: 'Academic year must be between 2000 and 2100.' });
    }
    if (!(await staffCanManageStudent(req, res, studentId, remediationAcademicYear))) return;
    const existingRemediation = await fetchRemediationByStudentAssessment(studentId, assessmentId);
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
    let stakeholder = null;
    if (!existingRemediation) stakeholder = await notifyRemediationStakeholders(remediation.id, remediation.reason === 'missed_deadline' ? 'Missed-deadline remediation required' : 'Remediation required');
    await auditBestEffort(req.user.id, 'remediation_created', 'remediation', remediation.id, { studentId, assessmentId, reason: remediation.reason });
    res.status(201).json({ ok: true, case: remediation, email: stakeholder?.email || null });
  } catch (error) {
    console.error('Create remediation error:', error);
    res.status(500).json({ error: `Could not create remediation: ${error.message}` });
  }
});

app.patch('/admin/remediations/:id', requireAdmin, async (req, res) => {
  try {
    const current = await fetchRemediationById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Remediation case not found.' });
    if (!(await staffCanManageStudent(req, res, current.studentId, await academicYearForRemediation(current)))) return;
    if (['Completed', 'Resolved'].includes(req.body?.status) && req.user.role !== 'main-admin') {
      return res.status(403).json({ error: 'Only the main administrator can complete or resolve a remediation case.' });
    }
    if (req.body?.attempts !== undefined) {
      return res.status(400).json({ error: 'Attempts used is controlled by successful student submissions. Set Allowed attempts instead.' });
    }

    const fieldMap = { remediationDate: 'remediation_date', remediationTime: 'remediation_time', venue: 'venue', instructions: 'instructions', feedback: 'feedback', attemptLimit: 'attempt_limit', remediationMark: 'remediation_mark', status: 'status' };
    const fields = [];
    const params = [];
    for (const [input, column] of Object.entries(fieldMap)) {
      if (req.body?.[input] === undefined) continue;
      if (input === 'status' && !REMEDIATION_STATUSES.includes(req.body[input])) return res.status(400).json({ error: 'Invalid remediation status.' });
      if (input === 'attemptLimit') {
        const value = Number(req.body[input]);
        if (!Number.isInteger(value) || value < 1 || value > 10) return res.status(400).json({ error: 'Allowed attempts must be a whole number from 1 to 10.' });
        if (value < Number(current.attempts || 0)) return res.status(409).json({ error: `Allowed attempts cannot be lower than the ${Number(current.attempts || 0)} attempts already used.` });
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

    const hasNewMark = req.body?.remediationMark !== undefined && req.body?.remediationMark !== null && req.body?.remediationMark !== '';
    if (hasNewMark) {
      const markValue = Number(req.body.remediationMark);
      const passed = markValue >= Number(current.passingMark ?? 60);
      const remaining = Number(current.attempts || 0) < Number(current.attemptLimit || 1);
      // A stale 'Submitted' value from an older client must never trap a failed case. Once the
      // current attempt is marked as failed and another attempt is available, the case reopens.
      // A passed attempt is marked for staff review/closure instead of being silently reopened.
      let nextStatus = passed ? 'Marked' : (remaining ? 'Open' : 'Marked');
      if (passed && req.user.role === 'main-admin' && ['Completed', 'Resolved'].includes(req.body.status)) nextStatus = req.body.status;
      if (req.body.status === 'Cancelled' && !passed) nextStatus = 'Cancelled';
      const existingStatusAssignments = fields.findIndex((value) => value === 'status=?');
      if (existingStatusAssignments >= 0) {
        params[existingStatusAssignments] = nextStatus;
      } else {
        fields.push('status=?');
        params.push(nextStatus);
      }
    }
    if (req.body?.status === 'Completed') fields.push('completed_at=CURRENT_TIMESTAMP');
    fields.push('updated_by=?'); params.push(req.user.id);
    fields.push('updated_at=CURRENT_TIMESTAMP');
    params.push(req.params.id);

    await transaction(async () => {
      await run(`UPDATE remediations SET ${fields.join(',')} WHERE id=?`, params);
      if (hasNewMark && Number(current.attempts || 0) > 0) {
        const attempt = await get(`SELECT id, passing_mark AS passingMark FROM remediation_attempts WHERE remediation_id=? AND attempt_number=? AND status<>'Deleted'`, [req.params.id, Number(current.attempts)]);
        if (attempt) {
          const markValue = Number(req.body.remediationMark);
          const passed = markValue >= Number(attempt.passingMark ?? current.passingMark ?? 60);
          await run(`UPDATE remediation_attempts SET mark=?,status=?,feedback=?,marked_by=?,marked_at=CURRENT_TIMESTAMP WHERE id=?`, [markValue, passed ? 'Passed' : 'Failed', String(req.body.feedback ?? current.feedback ?? ''), req.user.id, attempt.id]);
        }
      }
    });
    const updated = remediationRow(await fetchRemediationById(req.params.id));
    const scheduleChanged = req.body?.remediationDate !== undefined || req.body?.remediationTime !== undefined || req.body?.status === 'Scheduled';
    let email = null;
    if (scheduleChanged && ['Scheduled','Open'].includes(updated.status)) {
      const stakeholder = await notifyRemediationStakeholders(updated.id, 'Test / assessment remediation scheduled');
      email = stakeholder.email || null;
    }
    await auditBestEffort(req.user.id, 'remediation_updated', 'remediation', req.params.id, req.body);
    res.json({ ok: true, case: updated, email });
  } catch (error) {
    console.error('Update remediation error:', error);
    res.status(500).json({ error: `Could not update remediation: ${error.message}` });
  }
});

app.post('/student/remediations/:id/submit', requireAuth, remediationUploadSafe, async (req, res) => {
  let permanentPath = null;
  let committed = false;
  let attempts = null;
  try {
    if (req.user.role !== 'student') {
      if (req.file) fs.rmSync(req.file.path, { force: true });
      return res.status(403).json({ error: 'Only students can submit remediation work.' });
    }
    if (!zipUploadAllowed(req.file)) {
      if (req.file) fs.rmSync(req.file.path, { force: true });
      return res.status(415).json({ error: 'Remediation work must be uploaded as a valid ZIP file.' });
    }

    let previousFilePath = null;
    let current = null;
    await transaction(async () => {
      current = await fetchRemediationById(req.params.id);
      if (!current || current.studentId !== req.user.studentId) throw Object.assign(new Error('Remediation case not found.'), { status: 404 });
      if (!['Open', 'Scheduled'].includes(current.status)) throw Object.assign(new Error(`This remediation case is ${current.status.toLowerCase()} and cannot accept another submission.`), { status: 409 });
      if (current.remediationDate) {
        const scheduled = new Date(`${current.remediationDate}T${current.remediationTime || '00:00'}`).getTime();
        if (Number.isFinite(scheduled) && Date.now() < scheduled) throw Object.assign(new Error(`This remediation opens on ${new Date(scheduled).toLocaleString()}.`), { status: 409 });
      }
      if (Number(current.attempts || 0) >= Number(current.attemptLimit || 1)) throw Object.assign(new Error('The allowed remediation attempts have been used.'), { status: 409 });

      attempts = Number(current.attempts || 0) + 1;
      const originalFileName = path.basename(req.file.originalname || `remediation-attempt-${attempts}.zip`);
      const directory = path.join(STORAGE_ROOT, 'remediations');
      fs.mkdirSync(directory, { recursive: true });
      permanentPath = path.join(directory, `${req.params.id}-${attempts}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeSegment(originalFileName)}`);
      fs.renameSync(req.file.path, permanentPath);
      if (!fs.existsSync(permanentPath)) throw new Error('The remediation upload could not be stored in the designated storage directory.');
      const persistedPath = storedRelativePath(permanentPath);
      if (!persistedPath) throw new Error('The remediation upload path is outside the application storage directory.');
      previousFilePath = current.fileName && Number(current.attempts || 0) === 0 ? current.filePath : null;

      await run(`INSERT INTO remediation_attempts(remediation_id,attempt_number,file_name,file_path,status,passing_mark,feedback,submitted_at) VALUES(?,?,?,?, 'Submitted', ?, ?, CURRENT_TIMESTAMP)`, [req.params.id, attempts, originalFileName, persistedPath, Number(current.passingMark ?? 60), String(current.feedback || '')]);
      await run(`UPDATE remediations SET attempts=?, status='Submitted', file_name=?, file_path=?, submitted_at=CURRENT_TIMESTAMP, remediation_mark=NULL, updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [attempts, originalFileName, persistedPath, req.user.id, req.params.id]);
    });

    // The transaction committed successfully. From this point on, the permanent file is owned by
    // SQLite metadata and must never be removed merely because a later SELECT/audit/response fails.
    committed = true;
    permanentPath = null;
    if (previousFilePath) {
      const oldPath = storedFilePath(previousFilePath);
      if (oldPath) removeStoredFile(previousFilePath);
    }

    const updated = remediationRow(await fetchRemediationById(req.params.id));
    await auditBestEffort(req.user.id, 'remediation_submitted', 'remediation', req.params.id, { attempts });
    res.status(201).json({ ok: true, case: updated });
  } catch (error) {
    if (!committed && permanentPath) fs.rmSync(permanentPath, { force: true });
    if (req.file?.path) fs.rmSync(req.file.path, { force: true });
    console.error('Submit remediation error:', error);
    const status = Number(error?.status) >= 400 && Number(error?.status) < 500 ? Number(error.status) : 500;
    res.status(status).json({ error: status === 500 ? `Could not submit remediation: ${error.message}` : error.message });
  } finally {
    if (!committed && req.file?.path) fs.rmSync(req.file.path, { force: true });
  }
});

function findUniqueStoredFile(directoryName, fileName) {
  const root = path.resolve(STORAGE_ROOT, directoryName);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return null;
  const base = path.basename(String(fileName || '').replace(/\\/g, '/'));
  if (!base || base === '.' || base === '..') return null;
  const inside = (candidate) => candidate === root || candidate.startsWith(`${root}${path.sep}`);
  const safeExisting = (candidate) => {
    if (!inside(candidate) || !fs.existsSync(candidate)) return null;
    try {
      if (!fs.statSync(candidate).isFile()) return null;
      const realCandidate = fs.realpathSync(candidate);
      return inside(realCandidate) ? realCandidate : null;
    } catch (_) {
      return null;
    }
  };
  const exact = safeExisting(path.resolve(root, base));
  if (exact) return exact;
  const matches = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && (entry.name === base || entry.name.endsWith(`-${base}`)))
    .map((entry) => safeExisting(path.resolve(root, entry.name)))
    .filter(Boolean);
  return matches.length === 1 ? matches[0] : null;
}

async function sendRemediationDownload(req, res, row) {
  const fileRecord = await get('SELECT file_path AS filePath, file_name AS fileName FROM remediations WHERE id=?', [row.id]);
  if (!fileRecord?.fileName && !fileRecord?.filePath) return res.status(404).send('Remediation file not found');
  const rawPath = String(fileRecord?.filePath || '').trim();
  const hasDirectory = /[\\/]/.test(rawPath);
  let resolved = hasDirectory ? storedFilePath(rawPath) : null;
  if (!resolved) resolved = findUniqueStoredFile('remediations', fileRecord?.fileName || rawPath);

  // Recover older cases whose parent path was lost but whose attempt-history row still has the
  // correct permanent path. This also makes migrated databases tolerant of an old absolute-path
  // record after the project directory has moved.
  if (!resolved || !fs.existsSync(resolved)) {
    const latest = await get(`
      SELECT file_name AS fileName, file_path AS filePath
      FROM remediation_attempts
      WHERE remediation_id=? AND status<>'Deleted'
      ORDER BY attempt_number DESC
      LIMIT 1
    `, [row.id]);
    if (latest) {
      resolved = storedFilePath(latest.filePath) || findUniqueStoredFile('remediations', latest.fileName);
      if (resolved && fs.existsSync(resolved)) {
        await run('UPDATE remediations SET file_name=?,file_path=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [latest.fileName, storedRelativePath(resolved), row.id]);
        fileRecord.fileName = latest.fileName;
      }
    }
  }

  if (!resolved || !fs.existsSync(resolved)) return res.status(404).send('Remediation file not found');
  return res.download(resolved, fileRecord.fileName || path.basename(resolved));
}

async function listRemediationAttempts(id) {
  return all(`
    SELECT ra.id, ra.remediation_id AS remediationId, ra.attempt_number AS attemptNumber,
           ra.file_name AS fileName, ra.status, ra.mark, ra.passing_mark AS passingMark,
           ra.feedback, ra.submitted_at AS submittedAt, ra.marked_by AS markedBy,
           ra.marked_at AS markedAt, ra.deleted_at AS deletedAt
    FROM remediation_attempts ra
    WHERE ra.remediation_id=?
    ORDER BY ra.attempt_number ASC
  `, [id]);
}

function publicRemediationAttempt(row, currentAttempts) {
  const attemptNumber = Number(row.attemptNumber);
  const failed = row.status === 'Failed' || (row.mark != null && Number(row.mark) < Number(row.passingMark ?? 60));
  const deleted = row.status === 'Deleted' || Boolean(row.deletedAt);
  return {
    id: row.id,
    remediationId: row.remediationId,
    attemptNumber,
    fileName: row.fileName,
    status: deleted ? 'Deleted' : row.status,
    mark: row.mark == null ? null : Number(row.mark),
    passingMark: Number(row.passingMark ?? 60),
    feedback: row.feedback || '',
    submittedAt: row.submittedAt || null,
    markedAt: row.markedAt || null,
    deletedAt: row.deletedAt || null,
    canDownload: !deleted,
    // First failed attempt is removable only until a second attempt exists. The moment attempt 2
    // is submitted, attempt 1 becomes immutable history. Attempts 2+ are always read-only files.
    canDelete: attemptNumber === 1 && currentAttempts === 1 && failed && !deleted,
    locked: attemptNumber >= 2 || (attemptNumber === 1 && currentAttempts >= 2),
  };
}

app.get('/admin/remediations/:id/attempts', requireAdmin, async (req, res) => {
  try {
    const remediation = await fetchRemediationById(req.params.id);
    if (!remediation) return res.status(404).json({ error: 'Remediation case not found.' });
    if (!(await staffCanManageStudent(req, res, remediation.studentId, await academicYearForRemediation(remediation)))) return;
    const rows = await listRemediationAttempts(req.params.id);
    res.json({ attempts: rows.map((row) => publicRemediationAttempt(row, Number(remediation.attempts || 0))) });
  } catch (error) {
    res.status(500).json({ error: `Could not load remediation attempts: ${error.message}` });
  }
});

app.get('/student/remediations/:id/attempts', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Student access required.' });
    const remediation = await fetchRemediationById(req.params.id);
    if (!remediation || remediation.studentId !== req.user.studentId) return res.status(404).json({ error: 'Remediation case not found.' });
    const rows = await listRemediationAttempts(req.params.id);
    res.json({ attempts: rows.map((row) => ({ ...publicRemediationAttempt(row, Number(remediation.attempts || 0)), canDelete: false })) });
  } catch (error) {
    res.status(500).json({ error: `Could not load remediation attempts: ${error.message}` });
  }
});

async function sendRemediationAttemptDownload(req, res, attemptId, remediationId) {
  const row = await get(`
    SELECT ra.id, ra.remediation_id AS remediationId, ra.file_name AS fileName, ra.file_path AS filePath,
           ra.status, r.attempts
    FROM remediation_attempts ra
    JOIN remediations r ON r.id=ra.remediation_id
    WHERE ra.id=? AND ra.remediation_id=?
  `, [attemptId, remediationId]);
  if (!row || row.status === 'Deleted') return res.status(404).send('Remediation attempt file not found');
  const rawPath = String(row.filePath || '').trim();
  const safeFile = rawPath ? storedFilePath(rawPath) : null;
  const resolved = safeFile || findUniqueStoredFile('remediations', row.fileName);
  if (!resolved || !fs.existsSync(resolved)) return res.status(404).send('Remediation attempt file not found');
  return res.download(resolved, row.fileName || path.basename(resolved));
}

app.get('/admin/remediations/:id/attempts/:attemptId/download', requireAdmin, async (req, res) => {
  try {
    const remediation = await fetchRemediationById(req.params.id);
    if (!remediation) return res.status(404).send('Remediation case not found');
    if (!(await staffCanManageStudent(req, res, remediation.studentId, await academicYearForRemediation(remediation)))) return;
    return await sendRemediationAttemptDownload(req, res, req.params.attemptId, req.params.id);
  } catch (error) {
    return res.status(500).send(`Could not download remediation attempt: ${error.message}`);
  }
});

app.get('/student/remediations/:id/attempts/:attemptId/download', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).send('Student access required');
    const remediation = await fetchRemediationById(req.params.id);
    if (!remediation || remediation.studentId !== req.user.studentId) return res.status(404).send('Remediation case not found');
    return await sendRemediationAttemptDownload(req, res, req.params.attemptId, req.params.id);
  } catch (error) {
    return res.status(500).send(`Could not download remediation attempt: ${error.message}`);
  }
});

app.delete('/admin/remediations/:id/attempts/:attemptId', requireAdmin, async (req, res) => {
  try {
    const remediation = await fetchRemediationById(req.params.id);
    if (!remediation) return res.status(404).json({ error: 'Remediation case not found.' });
    if (!(await staffCanManageStudent(req, res, remediation.studentId, await academicYearForRemediation(remediation)))) return;
    const attempt = await get(`SELECT * FROM remediation_attempts WHERE id=? AND remediation_id=?`, [req.params.attemptId, req.params.id]);
    if (!attempt) return res.status(404).json({ error: 'Remediation attempt not found.' });
    if (attempt.status === 'Deleted') return res.json({ ok: true, alreadyDeleted: true, case: remediationRow(await fetchRemediationById(req.params.id)) });
    const failed = attempt.status === 'Failed' || (attempt.mark != null && Number(attempt.mark) < Number(attempt.passing_mark ?? remediation.passingMark ?? 60));
    if (Number(attempt.attempt_number) !== 1 || Number(remediation.attempts || 0) !== 1 || !failed) {
      return res.status(409).json({ error: 'Only the first failed remediation attempt may be removed. Once a second attempt exists, earlier files are locked as history.' });
    }
    const resolved = storedFilePath(attempt.file_path) || findUniqueStoredFile('remediations', attempt.file_name);
    await transaction(async () => {
      await run(`UPDATE remediation_attempts SET status='Deleted',deleted_by=?,deleted_at=CURRENT_TIMESTAMP WHERE id=?`, [req.user.id, attempt.id]);
      await run(`UPDATE remediations SET file_name=NULL,file_path=NULL,submitted_at=NULL,remediation_mark=NULL,status=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [Number(remediation.attempts || 0) < Number(remediation.attemptLimit || 1) ? 'Open' : 'Marked', req.user.id, remediation.id]);
    });
    if (resolved) fs.rmSync(resolved, { force: true });
    const updated = remediationRow(await fetchRemediationById(req.params.id));
    await auditBestEffort(req.user.id, 'remediation_attempt_deleted', 'remediation_attempt', attempt.id, { remediationId: req.params.id, attemptNumber: 1, reason: 'first failed attempt' });
    res.json({ ok: true, case: updated });
  } catch (error) {
    res.status(500).json({ error: `Could not remove remediation attempt: ${error.message}` });
  }
});

app.get('/student/remediations/:id/download', requireAuth, async (req, res) => {
  const row = await fetchRemediationById(req.params.id);
  if (!row || req.user.role !== 'student' || row.studentId !== req.user.studentId) return res.status(404).send('Remediation file not found');
  try { return await sendRemediationDownload(req, res, row); }
  catch (error) { return res.status(500).send(`Could not download remediation file: ${error.message}`); }
});

app.get('/admin/remediations/:id/download', requireAdmin, async (req, res) => {
  try {
    const row = await fetchRemediationById(req.params.id);
    if (!row) return res.status(404).send('Remediation case not found');
    if (!(await staffCanManageStudent(req, res, row.studentId, await academicYearForRemediation(row)))) return;
    return await sendRemediationDownload(req, res, row);
  } catch (error) {
    return res.status(500).send(`Could not download remediation file: ${error.message}`);
  }
});

app.post('/admin/2fa/setup', requireAdmin, async (req, res) => { const secret = speakeasy.generateSecret({ length: 20 }); await run('UPDATE users SET two_factor_secret=? WHERE id=?', [secret.base32, req.user.id]); res.json({ secret: secret.base32, otpauthUrl: secret.otpauth_url }); });
app.post('/admin/2fa/verify', requireAdmin, async (req, res) => { const user = await get('SELECT two_factor_secret FROM users WHERE id=?', [req.user.id]); const ok = !!user?.two_factor_secret && speakeasy.totp.verify({ secret: user.two_factor_secret, encoding: 'base32', token: String(req.body?.token || ''), window: 1 }); res.status(ok ? 200 : 401).json({ verified: ok }); });

module.exports = app;
if (require.main === module) {
  setInterval(() => { processEmailOutbox().catch((error) => console.warn('Email outbox worker:', error.message)); }, 30000);
  processEmailOutbox().catch(() => {});
  seeded.then(async () => {
    const install = await installationInfo().catch(() => ({ demo: false }));
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Installation: ${install.demo ? 'DEMO (sample data, public demo passwords)' : 'standard'}`);
      console.log(`Data folder:  ${DATA_ROOT}`);
      console.log(`Database:     ${DB_PATH}`);
    });
  });
}


