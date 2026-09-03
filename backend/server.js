const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { createStudent, findUser, run, get, all, transaction, audit, bcrypt } = require('./db');
const speakeasy = require('speakeasy');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
const PORT = process.env.PORT || 5000;
const STORAGE_ROOT = path.resolve(__dirname, 'school_data');
const sessions = new Map();
const attempts = new Map();
const safeSegment = v => String(v || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
const upload = multer({ storage: multer.diskStorage({
  destination: (req, file, cb) => { const d = path.join(STORAGE_ROOT, safeSegment(req.body.schoolId), 'uploads'); fs.mkdirSync(d, { recursive: true }); cb(null, d); },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${path.basename(file.originalname)}`)
}), limits: { fileSize: 25 * 1024 * 1024 } });

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

app.post('/api/accounts/students', async (req, res) => {
  const { name, username, password, studentId } = req.body || {};
  if (![name, username, password, studentId].every(v => typeof v === 'string' && v.trim())) return res.status(400).json({ error: 'name, username, password and studentId are required.' });
  try { res.status(201).json(await createStudent({ name: name.trim(), username: username.trim(), password, studentId: studentId.trim() })); }
  catch (e) { res.status(e.code === 'SQLITE_CONSTRAINT' ? 409 : 500).json({ error: e.code === 'SQLITE_CONSTRAINT' ? 'That account already exists.' : 'Could not create the local account.' }); }
});
app.post('/api/accounts/sign-in', async (req, res) => {
  const { username, password } = req.body || {}; const key = `${req.ip}:${String(username).toLowerCase()}`;
  if (!username || !password) return res.status(400).json({ error: 'username and password are required.' });
  if (!rate(key)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  const user = await findUser(String(username).trim(), password);
  if (!user) return res.status(401).json({ error: 'Those details do not match a local account.' });
  setSession(res, user); res.json(user);
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
  await run('UPDATE users SET password=?, failed_attempts=0, locked_until=NULL WHERE id=?', [await bcrypt.hash(req.body.password, 12), row.user_id]);
  await run('UPDATE password_resets SET used=1 WHERE token_hash=?', [hash]);
  res.json({ ok: true });
});
app.post('/api/accounts/password-reset/confirm-legacy', async (req, res) => {
  return res.status(410).json({ error: 'Password reset legacy endpoint is no longer supported.' });
  const hash = crypto.createHash('sha256').update(String(req.body?.token || '')).digest('hex'); const row = await get('SELECT * FROM password_resets WHERE token_hash=? AND used=0 AND expires_at>?', [hash, new Date().toISOString()]);
  if (!row || typeof req.body?.password !== 'string' || req.body.password.length < 8) return res.status(400).json({ error: 'Invalid or expired reset token.' });
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  await run('UPDATE users SET password=?, failed_attempts=0, locked_until=NULL WHERE id=?', [passwordHash, row.user_id]);
  await run('UPDATE password_resets SET used=1 WHERE token_hash=?', [hash]);
  return res.json({ ok: true });
  await run('UPDATE users SET password=?, failed_attempts=0, locked_until=NULL WHERE id=?', [await bcrypt.hash(req.body.password, 12), row.user_id]); await run('UPDATE password_resets SET used=1 WHERE token_hash=?', [hash]); res.json({ ok: true });
});

function parseCsv(file) { return new Promise((resolve, reject) => { const rows = []; fs.createReadStream(file).pipe(csv()).on('data', r => rows.push(r)).on('end', () => resolve(rows)).on('error', reject); }); }
app.post('/admin/upload-marks', upload.single('file'), async (req, res) => {
  if (!req.body.schoolId || !req.file) return res.status(400).json({ error: 'schoolId and a CSV file are required.' });
  let rows;
  try { rows = await parseCsv(req.file.path); } catch (e) { fs.rmSync(req.file.path, { force: true }); return res.status(400).json({ error: `Could not parse CSV: ${e.message}` }); }
  const errors = [], seen = new Set(), valid = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], studentId = String(r.studentId || r.student_id || '').trim(), assessmentId = String(r.assessmentId || r.assessment_id || '').trim(), value = r.mark;
    const key = `${studentId}|${assessmentId}`; let message = !/^[A-Za-z0-9_-]+$/.test(studentId) ? 'Invalid student ID format' : !/^[A-Za-z0-9_-]+$/.test(assessmentId) ? 'Invalid assessment ID format' : !/^\d+(\.\d+)?$/.test(String(value)) ? 'Mark must be numeric' : Number(value) < 0 || Number(value) > 100 ? 'Mark must be between 0 and 100' : seen.has(key) ? 'Duplicate mark' : null;
    if (message) errors.push({ row: i + 2, studentId, assessmentId, error: message }); else { seen.add(key); valid.push({ studentId, assessmentId, mark: Number(value) }); }
  }
  for (const r of valid) {
    const student = await get('SELECT student_id FROM users WHERE student_id=?', [r.studentId]);
    if (!student) errors.push({ studentId: r.studentId, assessmentId: r.assessmentId, error: 'Student not found' });
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
      } return { imported: valid.length - errors.filter(e => e.error === 'Student not found').length };
    }); await audit(sessionUser(req)?.id, 'marks_uploaded', 'marks', req.body.schoolId, { imported: result.imported, errors: errors.length });
    res.status(errors.length ? 422 : 200).json({ ...result, errors });
  } catch (e) { res.status(500).json({ error: 'Could not import marks.', details: e.message }); } finally { fs.rmSync(req.file.path, { force: true }); }
});

app.get('/student/marks/:schoolId/:studentId', async (req, res) => { const rows = await all('SELECT student_id AS studentId, assessment_id AS assessmentId, mark, status FROM marks WHERE student_id=? AND status IN ("Published","Locked")', [req.params.studentId]); rows.length ? res.json(rows) : res.status(404).send('Student record not found'); });
app.post('/admin/marks/:id/status', requireAdmin, async (req, res) => { const next = req.body?.status; const allowed = { Draft: ['Submitted'], Submitted: ['Approved'], Approved: ['Published'], Published: ['Locked'] }; const mark = await get('SELECT * FROM marks WHERE id=?', [req.params.id]); if (!mark || !allowed[mark.status]?.includes(next)) return res.status(409).json({ error: 'Invalid workflow transition.' }); await run('UPDATE marks SET status=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [next, req.user.id, req.params.id]); if (next === 'Published') await audit(req.user.id, 'marks_published', 'mark', req.params.id); res.json({ ...mark, status: next }); });
app.patch('/admin/marks/:id', requireAdmin, async (req, res) => { const mark = await get('SELECT * FROM marks WHERE id=?', [req.params.id]); if (!mark || ['Published', 'Locked'].includes(mark.status)) return res.status(409).json({ error: 'Published or locked marks cannot be edited.' }); if (typeof req.body.mark !== 'number' || req.body.mark < 0 || req.body.mark > 100) return res.status(400).json({ error: 'Mark must be between 0 and 100.' }); await run('UPDATE marks SET mark=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [req.body.mark, req.user.id, req.params.id]); await audit(req.user.id, 'marks_edited', 'mark', req.params.id); res.json({ ok: true }); });
app.get('/student/download/:schoolId/:filename', (req, res) => { const dir = path.resolve(STORAGE_ROOT, safeSegment(req.params.schoolId), 'uploads'); const file = path.resolve(dir, req.params.filename); if (!file.startsWith(`${dir}${path.sep}`)) return res.status(400).send('Invalid file path'); fs.existsSync(file) ? res.download(file) : res.status(404).send('File not found'); });
app.patch('/admin/accounts/:id', requireAdmin, async (req, res) => {
  const user = await get('SELECT * FROM users WHERE id=?', [req.params.id]); if (!user) return res.status(404).json({ error: 'Account not found.' });
  const fields = [], params = []; if (typeof req.body.name === 'string') { fields.push('name=?'); params.push(req.body.name.trim()); }
  if (typeof req.body.studentId === 'string') { fields.push('student_id=?'); params.push(req.body.studentId.trim()); }
  if (!fields.length) return res.status(400).json({ error: 'No account changes supplied.' }); params.push(req.params.id);
  await run(`UPDATE users SET ${fields.join(',')} WHERE id=?`, params); await audit(req.user.id, 'student_account_changed', 'user', req.params.id, req.body); res.json({ ok: true });
});
app.patch('/admin/accounts/:id/role', requireAdmin, async (req, res) => {
  if (!['student', 'admin', 'main-admin'].includes(req.body?.role)) return res.status(400).json({ error: 'Invalid role.' });
  await run('UPDATE users SET role=? WHERE id=?', [req.body.role, req.params.id]); await audit(req.user.id, 'role_changed', 'user', req.params.id, { role: req.body.role }); res.json({ ok: true });
});
app.delete('/admin/accounts/:id', requireAdmin, async (req, res) => { await run('DELETE FROM users WHERE id=?', [req.params.id]); await audit(req.user.id, 'user_deleted', 'user', req.params.id); res.json({ ok: true }); });
app.post('/admin/2fa/setup', requireAdmin, async (req, res) => { const secret = speakeasy.generateSecret({ length: 20 }); await run('UPDATE users SET two_factor_secret=? WHERE id=?', [secret.base32, req.user.id]); res.json({ secret: secret.base32, otpauthUrl: secret.otpauth_url }); });
app.post('/admin/2fa/verify', requireAdmin, async (req, res) => { const user = await get('SELECT two_factor_secret FROM users WHERE id=?', [req.user.id]); const ok = !!user?.two_factor_secret && speakeasy.totp.verify({ secret: user.two_factor_secret, encoding: 'base32', token: String(req.body?.token || ''), window: 1 }); res.status(ok ? 200 : 401).json({ verified: ok }); });

module.exports = app;
if (require.main === module) app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
