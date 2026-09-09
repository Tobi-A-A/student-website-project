const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const database = path.join(__dirname, '..', 'school_data', 'test.sqlite');
process.env.DB_PATH = database;
fs.rmSync(database, { force: true });
const db = require('../db');
const app = require('../server');

test('creates a bcrypt-backed student and authenticates it', { concurrency: false }, async () => {
  const student = await db.createStudent({ name: 'Test Student', username: 'test-user', password: 'correct horse battery staple', studentId: 'ST-1' });
  assert.equal(student.role, 'student');
  assert.equal((await db.findUser('test-user', 'wrong password')), null);
  assert.equal((await db.findUser('test-user', 'correct horse battery staple')).studentId, 'ST-1');
});

test('schema enforces unique marks and foreign keys', { concurrency: false }, async () => {
  await db.run('INSERT INTO assessments(id,name) VALUES(?,?)', ['A-1', 'Assessment']);
  await db.run('INSERT INTO marks(student_id,assessment_id,mark) VALUES(?,?,?)', ['ST-1', 'A-1', 75]);
  await assert.rejects(() => db.run('INSERT INTO marks(student_id,assessment_id,mark) VALUES(?,?,?)', ['ST-1', 'A-1', 80]));
  await assert.rejects(() => db.run('INSERT INTO marks(student_id,assessment_id,mark) VALUES(?,?,?)', ['MISSING', 'A-1', 80]));
});

test('password reset changes the password and consumes the token', { concurrency: false }, async () => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const request = await fetch(`${base}/api/accounts/password-reset/request`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'test-user' })
    });

    test('local API authenticates demo admin and exposes SQLite data and exports', { concurrency: false }, async () => {
      const server = http.createServer(app);
      await new Promise(resolve => server.listen(0, resolve));
      const base = `http://127.0.0.1:${server.address().port}`;
      try {
        const login = await fetch(`${base}/api/accounts/sign-in`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: 'mainadmin', password: 'ChangeMe123!' })
        });
        assert.equal(login.status, 200);
        const cookie = login.headers.get('set-cookie');
        assert.ok(cookie);
        const data = await fetch(`${base}/admin/data`, { headers: { cookie } });
        assert.equal(data.status, 200);
        assert.ok(Array.isArray((await data.json()).users));
        const students = await fetch(`${base}/admin/students.csv?limit=30`, { headers: { cookie } });
        assert.equal(students.status, 200);
        assert.match(await students.text(), /"studentId","name","username"/);
      } finally {
        await new Promise(resolve => server.close(resolve));
      }
    });
    const { token } = await request.json();
    const confirm = await fetch(`${base}/api/accounts/password-reset/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, password: 'new secure password' })
    });
    assert.equal(confirm.status, 200);
    assert.equal((await db.findUser('test-user', 'new secure password')).username, 'test-user');
    const reused = await fetch(`${base}/api/accounts/password-reset/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, password: 'another password' })
    });
    assert.equal(reused.status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('locked marks can be corrected by an admin but published marks cannot', { concurrency: false }, async () => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${base}/api/accounts/sign-in`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'mainadmin', password: 'ChangeMe123!' })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');

    await db.run('INSERT INTO assessments(id,name) VALUES(?,?)', ['A-CORRECT', 'Correction test']);
    const inserted = await db.run('INSERT INTO marks(student_id,assessment_id,mark,status) VALUES(?,?,?,?)', ['ST-1', 'A-CORRECT', 50, 'Published']);
    const markId = inserted.lastID;

    // Published marks must be locked first — direct edits are rejected.
    const rejected = await fetch(`${base}/admin/marks/${markId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ mark: 65 })
    });
    assert.equal(rejected.status, 409);

    await db.run('UPDATE marks SET status=? WHERE id=?', ['Locked', markId]);

    // Once locked, an admin can correct a mistaken score.
    const corrected = await fetch(`${base}/admin/marks/${markId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ mark: 65 })
    });
    assert.equal(corrected.status, 200);
    const row = await db.get('SELECT mark, status FROM marks WHERE id=?', [markId]);
    assert.equal(row.mark, 65);
    assert.equal(row.status, 'Locked');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

// The marking room can produce marks while the API is offline; its outbox retries until it gets a
// success. That makes idempotency a correctness requirement, not a nicety: a retry sent after a
// response was lost in flight must not create a second mark or change an already-released one.
test('marking room release is idempotent and protects already-published marks', { concurrency: false }, async () => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const release = (cookie, body) => fetch(`${base}/admin/marking/release`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body)
  });
  try {
    const login = await fetch(`${base}/api/accounts/sign-in`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'mainadmin', password: 'ChangeMe123!' })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');

    const student = await db.get("SELECT student_id FROM users WHERE role='student' LIMIT 1");
    const payload = { studentId: student.student_id, assessmentId: 'ASSIGN-OFFLINE', assessmentName: 'Offline marking test', mark: 74, status: 'Published' };

    const first = await release(cookie, payload);
    assert.equal(first.status, 200);
    const stored = await db.get('SELECT mark,status FROM marks WHERE student_id=? AND assessment_id=?', [student.student_id, 'ASSIGN-OFFLINE']);
    assert.equal(stored.mark, 74);
    assert.equal(stored.status, 'Published');

    // Replaying the identical entry (the outbox retrying a request whose reply was lost) succeeds
    // without creating a duplicate row.
    const replay = await release(cookie, payload);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).duplicate, true);
    const count = await db.get('SELECT COUNT(*) AS n FROM marks WHERE student_id=? AND assessment_id=?', [student.student_id, 'ASSIGN-OFFLINE']);
    assert.equal(count.n, 1);

    // A different score for an already-published mark must be refused, not silently applied.
    const conflicting = await release(cookie, { ...payload, mark: 91 });
    assert.equal(conflicting.status, 409);
    const unchanged = await db.get('SELECT mark FROM marks WHERE student_id=? AND assessment_id=?', [student.student_id, 'ASSIGN-OFFLINE']);
    assert.equal(unchanged.mark, 74);

    // Validation: unknown student and out-of-range marks are rejected before touching the database.
    assert.equal((await release(cookie, { ...payload, studentId: 'NOPE-999', assessmentId: 'ASSIGN-X' })).status, 404);
    assert.equal((await release(cookie, { ...payload, assessmentId: 'ASSIGN-Y', mark: 150 })).status, 400);

    // Staff re-marking a released submission is a deliberate override: it succeeds, replaces the
    // score, and is recorded as marks_edited with the previous mark so the change stays traceable.
    const remark = await release(cookie, { ...payload, mark: 91, override: true, reason: 'Criterion 3 was added up wrong' });
    assert.equal(remark.status, 200);
    assert.equal((await remark.json()).remark, true);
    const corrected = await db.get('SELECT mark,status FROM marks WHERE student_id=? AND assessment_id=?', [student.student_id, 'ASSIGN-OFFLINE']);
    assert.equal(corrected.mark, 91);
    assert.equal(corrected.status, 'Published');
    const rows = await db.get('SELECT COUNT(*) AS n FROM marks WHERE student_id=? AND assessment_id=?', [student.student_id, 'ASSIGN-OFFLINE']);
    assert.equal(rows.n, 1);
    const logged = await db.get("SELECT action,details FROM audit_logs WHERE action='marks_edited' ORDER BY id DESC LIMIT 1");
    assert.equal(logged.action, 'marks_edited');
    assert.match(logged.details, /Criterion 3 was added up wrong/);
    assert.match(logged.details, /"previousMark":74/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
// A typo in the assessmentId column used to create a brand-new assessment silently, which then
// polluted averages and report cards. The import must now reject unknown assessment ids unless the
// uploader deliberately opts in, and it must remain all-or-nothing.
test('CSV import rejects unknown assessment ids unless explicitly allowed', { concurrency: false }, async () => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${base}/api/accounts/sign-in`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'mainadmin', password: 'ChangeMe123!' })
    });
    const cookie = login.headers.get('set-cookie');
    const student = await db.get("SELECT student_id FROM users WHERE role='student' AND student_id IS NOT NULL LIMIT 1");
    const post = async (assessmentId, create) => {
      const form = new FormData();
      form.append('schoolId', 'test');
      if (create) form.append('createAssessments', 'true');
      form.append('file', new Blob([`studentId,assessmentId,mark\n${student.student_id},${assessmentId},80`], { type: 'text/csv' }), 'marks.csv');
      return fetch(`${base}/admin/upload-marks`, { method: 'POST', headers: { cookie }, body: form });
    };

    const typo = await post('DOES-NOT-EXIST-1', false);
    assert.equal(typo.status, 422);
    const body = await typo.json();
    assert.equal(body.imported, 0);
    assert.match(body.errors[0].error, /Assessment not found/);
    // Nothing may be written when the file is rejected.
    assert.ok(!(await db.get("SELECT id FROM assessments WHERE id='DOES-NOT-EXIST-1'")));

    const optedIn = await post('DOES-NOT-EXIST-1', true);
    assert.equal(optedIn.status, 200);
    assert.equal((await optedIn.json()).imported, 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});