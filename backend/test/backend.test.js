const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { after, before } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'student-portal-api-test-'));
const database = path.join(testDir, 'test.sqlite');
process.env.DB_PATH = database;
process.env.SEED_DEMO = 'false';
const db = require('../db');
const app = require('../server');

before(async () => {
  await db.ready;
  const mainAdmin = await db.createAdmin({
    name: 'Test Main Administrator',
    username: 'mainadmin',
    password: 'ChangeMe123!',
    role: 'main-admin',
    temporary: false,
  });
  await db.createCourse({
    name: 'Computer Science',
    requirement: 'Test course fixture.',
    createdBy: mainAdmin.id,
  });
  await db.createStudent({
    name: 'Demo Student',
    username: 'student',
    password: 'Student123!',
    studentId: 'STU-001',
    course: 'Computer Science',
    yearLevel: 1,
  });
});

after(async () => {
  await new Promise((resolve, reject) => db.db.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(testDir, { recursive: true, force: true });
});

test('creates a bcrypt-backed student and authenticates it', { concurrency: false }, async () => {
  const student = await db.createStudent({
    name: 'Test Student',
    username: 'test-user',
    password: 'correct horse battery staple',
    studentId: 'ST-1',
    trustedEmail: 'test-user@example.test',
  });
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
      body: JSON.stringify({ username: 'test-user', email: 'test-user@example.test' })
    });
    assert.equal(request.status, 200);
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

test('authenticated password change updates the stored password', { concurrency: false }, async () => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${base}/api/accounts/sign-in`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'test-user', password: 'new secure password' })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    const changed = await fetch(`${base}/api/accounts/password`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ currentPassword: 'new secure password', newPassword: 'changed secure password' })
    });
    assert.equal(changed.status, 200);
    assert.equal((await db.findUser('test-user', 'changed secure password')).username, 'test-user');
    assert.equal(await db.findUser('test-user', 'new secure password'), null);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('a student sees the staff allocated to their course and their explicit lecturer', { concurrency: false }, async () => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const academicYear = new Date().getFullYear();
  try {
    const lecturer = await db.createAdmin({
      name: 'Course Lead Lecturer',
      username: 'course-lead',
      password: 'Lecturer123!',
      role: 'admin',
      temporary: false,
    });
    await db.run(
      'INSERT INTO staff_course_assignments(user_id,course,year_level,academic_year,active) VALUES(?,?,?,?,1)',
      [lecturer.id, 'Computer Science', 1, academicYear]
    );

    const login = await fetch(`${base}/api/accounts/sign-in`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'student', password: 'Student123!' })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');

    // No explicit allocation row exists yet, so the course/year teaching group is the fallback.
    const fallback = await (await fetch(`${base}/api/accounts/support-team`, { headers: { cookie } })).json();
    assert.equal(fallback.advisor.name, 'Course Lead Lecturer');
    assert.equal(fallback.advisor.source, 'course-team');
    assert.equal(fallback.course, 'Computer Science');
    assert.ok(fallback.administrators.some((admin) => admin.username === 'mainadmin'));

    const meFallback = await (await fetch(`${base}/api/accounts/me`, { headers: { cookie } })).json();
    assert.equal(meFallback.teacherName, 'Course Lead Lecturer');
    assert.equal(meFallback.teacherSource, 'course-team');

    const named = await db.createAdmin({
      name: 'Named Personal Lecturer',
      username: 'named-lecturer',
      password: 'Lecturer123!',
      role: 'admin',
      temporary: false,
    });
    await db.run(
      'INSERT INTO student_teacher_assignments(student_id,teacher_user_id,academic_year,active) VALUES(?,?,?,1)',
      ['STU-001', named.id, academicYear]
    );

    const allocated = await (await fetch(`${base}/api/accounts/support-team`, { headers: { cookie } })).json();
    assert.equal(allocated.advisor.name, 'Named Personal Lecturer');
    assert.equal(allocated.advisor.source, 'allocated');

    const meAllocated = await (await fetch(`${base}/api/accounts/me`, { headers: { cookie } })).json();
    assert.equal(meAllocated.teacherName, 'Named Personal Lecturer');
    assert.equal(meAllocated.teacherAcademicYear, academicYear);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('a closed assignment blocks student download and upload but staff keep access', { concurrency: false }, async () => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const academicYear = new Date().getFullYear();
  const storageDir = path.join(__dirname, '..', 'school_data', 'assignments');
  const submissionDir = path.join(__dirname, '..', 'school_data', 'assignment-submissions');
  const briefName = `close-test-${Date.now()}.txt`;
  const briefPath = path.join(storageDir, briefName);
  // STORAGE_ROOT is fixed to backend/school_data regardless of DB_PATH, so this test writes
  // into the real upload folder. Snapshot it first and remove only what the test adds, so a
  // developer's existing uploads are never touched.
  const listSubmissions = () => fs.existsSync(submissionDir) ? fs.readdirSync(submissionDir) : [];
  const submissionsBefore = new Set(listSubmissions());

  const signIn = async (username, password) => {
    const res = await fetch(`${base}/api/accounts/sign-in`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    assert.equal(res.status, 200);
    return res.headers.get('set-cookie');
  };

  const submit = async (assignmentId, cookie) => {
    const form = new FormData();
    form.set('conductAcknowledged', 'true');
    form.set('file', new Blob([Buffer.from('PK\u0003\u0004 fake zip')], { type: 'application/zip' }), 'work.zip');
    return fetch(`${base}/student/assignments/${assignmentId}/submit`, { method: 'POST', headers: { cookie }, body: form });
  };

  try {
    fs.mkdirSync(storageDir, { recursive: true });
    fs.writeFileSync(briefPath, 'assignment brief');

    const staff = await db.createAdmin({
      name: 'Close Test Lecturer', username: 'close-lecturer',
      password: 'Lecturer123!', role: 'admin', temporary: false,
    });
    await db.run(
      'INSERT INTO staff_course_assignments(user_id,course,year_level,academic_year,active) VALUES(?,?,?,?,1)',
      [staff.id, 'Computer Science', 1, academicYear]
    );

    const inserted = await db.run(
      `INSERT INTO assignments(title,subject,course,year_level,academic_year,start_at,due_date,due_time,file_name,file_path,owner_id,completed,open_override,active)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,0,0,1)`,
      ['Close Window Test', 'Systems', 'Computer Science', 1, academicYear,
       '2000-01-01T00:00', '2999-12-31', '23:59', briefName, path.join('assignments', briefName), staff.id]
    );
    const assignmentId = inserted.lastID;

    const studentCookie = await signIn('student', 'Student123!');
    const staffCookie = await signIn('close-lecturer', 'Lecturer123!');

    // While open the learner can fetch the brief and submit.
    assert.equal((await fetch(`${base}/api/assignments/${assignmentId}/download`, { headers: { cookie: studentCookie } })).status, 200);
    assert.equal((await submit(assignmentId, studentCookie)).status, 201);

    // Closing by staff must revoke both download and upload for the learner.
    await db.run('UPDATE assignments SET completed=1, open_override=0 WHERE id=?', [assignmentId]);

    const closedDownload = await fetch(`${base}/api/assignments/${assignmentId}/download`, { headers: { cookie: studentCookie } });
    assert.equal(closedDownload.status, 409);
    assert.match((await closedDownload.json()).error, /closed by staff/i);

    const closedUpload = await submit(assignmentId, studentCookie);
    assert.equal(closedUpload.status, 409);
    assert.match((await closedUpload.json()).error, /closed by staff/i);

    // Staff must still be able to retrieve the brief for a closed assignment.
    assert.equal((await fetch(`${base}/api/assignments/${assignmentId}/download`, { headers: { cookie: staffCookie } })).status, 200);

    // A past deadline closes the window just as staff completion does.
    await db.run("UPDATE assignments SET completed=0, due_date='2000-01-02' WHERE id=?", [assignmentId]);
    const overdueDownload = await fetch(`${base}/api/assignments/${assignmentId}/download`, { headers: { cookie: studentCookie } });
    assert.equal(overdueDownload.status, 409);
    assert.equal((await submit(assignmentId, studentCookie)).status, 409);

    // Reopening via the staff override restores access without moving the deadline.
    await db.run('UPDATE assignments SET open_override=1 WHERE id=?', [assignmentId]);
    assert.equal((await fetch(`${base}/api/assignments/${assignmentId}/download`, { headers: { cookie: studentCookie } })).status, 200);

    // A learner must never reach an assignment outside their own course/year.
    await db.run("UPDATE assignments SET course='Nursing', open_override=1 WHERE id=?", [assignmentId]);
    assert.equal((await fetch(`${base}/api/assignments/${assignmentId}/download`, { headers: { cookie: studentCookie } })).status, 404);
  } finally {
    fs.rmSync(briefPath, { force: true });
    listSubmissions()
      .filter((name) => !submissionsBefore.has(name))
      .forEach((name) => fs.rmSync(path.join(submissionDir, name), { force: true }));
    await new Promise(resolve => server.close(resolve));
  }
});

test('test schedules are normalised to local wall-clock and survive a partial edit', { concurrency: false }, async () => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const academicYear = new Date().getFullYear();
  try {
    const login = await fetch(`${base}/api/accounts/sign-in`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'mainadmin', password: 'ChangeMe123!' })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');

    // A row created without dates inherits SQLite's CURRENT_TIMESTAMP, which is UTC and
    // space separated. The API must hand back a local wall-clock string instead, otherwise
    // the browser reads the UTC value as local time and the window is wrong by the offset.
    const legacy = await db.run(
      `INSERT INTO tests(title,subject,course,year_level,academic_year,questions_json,passing_mark,max_attempts,duration_minutes,completed,open_override,active)
       VALUES(?,?,?,?,?,?,?,?,?,0,0,1)`,
      ['Legacy Schedule', 'Systems', 'Computer Science', 1, academicYear,
       JSON.stringify([{ type: 'mcq', question: 'Q', options: ['a', 'b'], correct: 0, points: 1 }]), 60, 2, 20]
    );
    const stored = await db.get('SELECT start_at FROM tests WHERE id=?', [legacy.id ?? legacy.lastID]);
    assert.match(stored.start_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

    const listed = await (await fetch(`${base}/api/tests`, { headers: { cookie } })).json();
    const legacyRow = listed.find((row) => row.title === 'Legacy Schedule');
    assert.ok(legacyRow, 'the legacy test should be listed');
    assert.match(legacyRow.startAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const expectedLocal = (() => {
      const d = new Date(`${stored.start_at.replace(' ', 'T')}Z`);
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    })();
    assert.equal(legacyRow.startAt, expectedLocal);

    // Explicit dates must round-trip untouched, and a title-only edit must not disturb them.
    const created = await fetch(`${base}/admin/tests`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Scheduled Paper', subject: 'Systems', course: 'Computer Science',
        yearLevel: 1, academicYear, startAt: '2030-03-04T08:30', dueDate: '2030-03-04', dueTime: '10:45',
        passingMark: 60, maxAttempts: 2, durationMinutes: 45,
        questions: [{ type: 'mcq', question: 'Q', options: ['a', 'b'], correct: 0, points: 1 }],
      })
    });
    assert.equal(created.status, 201);
    const createdTest = await created.json();
    assert.equal(createdTest.startAt, '2030-03-04T08:30');
    assert.equal(createdTest.dueDate, '2030-03-04');
    assert.equal(createdTest.dueTime, '10:45');

    const patched = await fetch(`${base}/admin/tests/${createdTest.id}`, {
      method: 'PATCH', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Scheduled Paper v2' })
    });
    assert.equal(patched.status, 200);
    const patchedTest = await patched.json();
    assert.equal(patchedTest.title, 'Scheduled Paper v2');
    assert.equal(patchedTest.startAt, '2030-03-04T08:30');
    assert.equal(patchedTest.dueDate, '2030-03-04');
    assert.equal(patchedTest.dueTime, '10:45');

    // A closing moment that is not after the opening moment must be rejected.
    const invalid = await fetch(`${base}/admin/tests/${createdTest.id}`, {
      method: 'PATCH', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ startAt: '2030-03-04T12:00', dueDate: '2030-03-04', dueTime: '10:45' })
    });
    assert.equal(invalid.status, 400);

    // /admin/data is what the staff workspace loads tests from. It once omitted the schedule
    // columns, so testRow fell back to "now" and the 2099-12-31 column default; saving from
    // that editor then wrote the invented closing date back as if staff had chosen it.
    const adminData = await (await fetch(`${base}/admin/data`, { headers: { cookie } })).json();
    const adminTest = adminData.tests.find((row) => row.id === createdTest.id);
    assert.ok(adminTest, 'the staff workspace payload should include the test');
    assert.equal(adminTest.startAt, '2030-03-04T08:30');
    assert.equal(adminTest.dueDate, '2030-03-04');
    assert.equal(adminTest.dueTime, '10:45');

    // The same payload must carry the open/closed state, or a closed test reappears as open.
    await db.run('UPDATE tests SET completed=1 WHERE id=?', [createdTest.id]);
    const afterClose = await (await fetch(`${base}/admin/data`, { headers: { cookie } })).json();
    assert.equal(afterClose.tests.find((row) => row.id === createdTest.id).completed, true);

    // A row with no usable schedule must report empty values rather than an invented window.
    await db.run("UPDATE tests SET start_at='', due_date='' WHERE id=?", [createdTest.id]);
    const blankData = await (await fetch(`${base}/admin/data`, { headers: { cookie } })).json();
    const blankTest = blankData.tests.find((row) => row.id === createdTest.id);
    assert.equal(blankTest.startAt, '');
    assert.equal(blankTest.dueDate, '');
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
    assert.equal(first.status, 201);
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
test('assignment memos persist in SQLite and respect teaching allocation', { concurrency: false }, async () => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const academicYear = new Date().getFullYear();
  const signIn = async (username, password) => {
    const response = await fetch(`${base}/api/accounts/sign-in`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie');
  };
  const putMemo = (cookie, id, body) => fetch(`${base}/admin/memos/${id}`, {
    method: 'PUT', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body)
  });
  try {
    const owner = await db.createAdmin({ name: 'Memo Lecturer', username: 'memo-lecturer', password: 'Lecturer123!', role: 'admin', temporary: false });
    await db.createAdmin({ name: 'Other Lecturer', username: 'memo-outsider', password: 'Lecturer123!', role: 'admin', temporary: false });
    await db.run('INSERT INTO staff_course_assignments(user_id,course,year_level,academic_year,active) VALUES(?,?,?,?,1)', [owner.id, 'Computer Science', 2, academicYear]);
    const inserted = await db.run(
      `INSERT INTO assignments(title,subject,course,year_level,academic_year,start_at,due_date,due_time,file_name,file_path,owner_id,completed,open_override,active)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,0,0,1)`,
      ['Memo Test', 'Systems', 'Computer Science', 2, academicYear, '2000-01-01T00:00', '2999-12-31', '23:59', 'brief.pdf', 'assignments/brief.pdf', owner.id]
    );
    const assignmentId = inserted.lastID;
    const ownerCookie = await signIn('memo-lecturer', 'Lecturer123!');
    const outsiderCookie = await signIn('memo-outsider', 'Lecturer123!');
    const adminCookie = await signIn('mainadmin', 'ChangeMe123!');

    const created = await putMemo(ownerCookie, assignmentId, { title: 'Memo Test memo', criteria: [
      { id: 'c1', label: 'Correctness', max: 60, guidance: 'Runs cleanly' },
      { id: 'c2', label: 'Style', max: 40 },
    ] });
    assert.equal(created.status, 201);
    const stored = await db.get('SELECT title,criteria,updated_by FROM assignment_memos WHERE assignment_id=?', [assignmentId]);
    assert.equal(stored.title, 'Memo Test memo');
    assert.equal(stored.updated_by, owner.id);
    assert.deepEqual(JSON.parse(stored.criteria).map((c) => [c.id, c.max]), [['c1', 60], ['c2', 40]]);

    // Updating replaces the rubric (criteria removed in the editor are gone) and keeps ids stable.
    const updated = await putMemo(ownerCookie, assignmentId, { title: 'Memo Test memo', criteria: [{ id: 'c1', label: 'Correctness', max: 100 }] });
    assert.equal(updated.status, 200);
    assert.deepEqual((await updated.json()).criteria.map((c) => c.id), ['c1']);

    // Another marker on the same allocation (here the main admin) sees the same memo.
    const shared = await (await fetch(`${base}/admin/memos`, { headers: { cookie: adminCookie } })).json();
    assert.ok(shared.some((memo) => memo.assignmentId === assignmentId && memo.updatedBy === 'Memo Lecturer'));

    // Validation.
    assert.equal((await putMemo(ownerCookie, assignmentId, { title: 'x', criteria: [] })).status, 400);
    assert.equal((await putMemo(ownerCookie, assignmentId, { title: 'x', criteria: [{ label: '', max: 10 }] })).status, 400);
    assert.equal((await putMemo(ownerCookie, assignmentId, { title: 'x', criteria: [{ label: 'A', max: 0 }] })).status, 400);
    assert.equal((await putMemo(ownerCookie, 999999, { title: 'x', criteria: [{ label: 'A', max: 5 }] })).status, 404);

    // Staff outside the allocation can neither see, change nor delete it; students cannot reach it.
    const outsiderList = await (await fetch(`${base}/admin/memos`, { headers: { cookie: outsiderCookie } })).json();
    assert.ok(!outsiderList.some((memo) => memo.assignmentId === assignmentId));
    assert.equal((await putMemo(outsiderCookie, assignmentId, { title: 'x', criteria: [{ label: 'A', max: 5 }] })).status, 403);
    assert.equal((await fetch(`${base}/admin/memos/${assignmentId}`, { method: 'DELETE', headers: { cookie: outsiderCookie } })).status, 403);
    const studentCookie = await signIn('student', 'Student123!');
    assert.equal((await fetch(`${base}/admin/memos`, { headers: { cookie: studentCookie } })).status, 403);

    // Delete, then confirm deleting an assignment also removes its memo.
    const removed = await fetch(`${base}/admin/memos/${assignmentId}`, { method: 'DELETE', headers: { cookie: ownerCookie } });
    assert.equal(removed.status, 200);
    assert.equal((await removed.json()).deleted, true);
    assert.equal(await db.get('SELECT 1 FROM assignment_memos WHERE assignment_id=?', [assignmentId]), null);
    assert.equal((await putMemo(ownerCookie, assignmentId, { title: 'again', criteria: [{ label: 'A', max: 5 }] })).status, 201);
    assert.equal((await fetch(`${base}/admin/assignments/${assignmentId}`, { method: 'DELETE', headers: { cookie: ownerCookie } })).status, 200);
    assert.equal(await db.get('SELECT 1 FROM assignment_memos WHERE assignment_id=?', [assignmentId]), null);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('student-card templates keep one default and learner photos are versioned, replaceable and rejectable', { concurrency: false }, async () => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const photoDir = path.join(__dirname, '..', 'school_data', 'student-cards', 'photos');
  const listPhotos = () => fs.existsSync(photoDir) ? fs.readdirSync(photoDir) : [];
  const photosBefore = new Set(listPhotos());
  const signIn = async (username, password) => {
    const response = await fetch(`${base}/api/accounts/sign-in`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie');
  };
  const design = (name) => ({
    name, title: 'Student Card', subtitle: '', widthMm: 85.6, heightMm: 54,
    background: '#123456', accent: '#abcdef', textColor: '#ffffff', showPhoto: true, fields: ['name', 'studentId'],
  });
  const json = (cookie, method, url, body) => fetch(`${base}${url}`, {
    method, headers: { 'content-type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body)
  });
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const uploadPhoto = (cookie, bytes = png, type = 'image/png', name = 'me.png') => {
    const form = new FormData();
    form.set('file', new Blob([bytes], { type }), name);
    return fetch(`${base}/student/student-card/photo`, { method: 'POST', headers: { cookie }, body: form });
  };
  try {
    const adminCookie = await signIn('mainadmin', 'ChangeMe123!');
    const studentCookie = await signIn('student', 'Student123!');

    // The first template becomes the default automatically; later ones do not.
    const first = await (await json(adminCookie, 'POST', '/admin/student-cards/templates', design('Alpha card'))).json();
    assert.equal(first.template.isDefault, true);
    const second = await (await json(adminCookie, 'POST', '/admin/student-cards/templates', design('Beta card'))).json();
    assert.equal(second.template.isDefault, false);

    // Switching the default leaves exactly one default template.
    const switched = await (await json(adminCookie, 'POST', `/admin/student-cards/templates/${second.template.id}/default`)).json();
    assert.deepEqual(switched.templates.filter((t) => t.isDefault).map((t) => t.id), [second.template.id]);
    assert.equal((await json(adminCookie, 'POST', '/admin/student-cards/templates/999999/default')).status, 404);
    assert.equal((await json(studentCookie, 'POST', `/admin/student-cards/templates/${first.template.id}/default`)).status, 403);

    // The learner sees the default design so their preview matches what will be printed.
    const self = await (await fetch(`${base}/student/student-card`, { headers: { cookie: studentCookie } })).json();
    assert.equal(self.template.id, second.template.id);
    assert.equal(self.photoUrl, null);

    // Uploading returns a versioned URL; a replacement gets a different URL so browsers refetch it.
    const rejectedType = await uploadPhoto(studentCookie, Buffer.from('not an image'), 'image/png', 'fake.png');
    assert.equal(rejectedType.status, 415);
    const uploaded = await uploadPhoto(studentCookie);
    assert.equal(uploaded.status, 201);
    const firstPhoto = await uploaded.json();
    assert.match(firstPhoto.photoUrl, /^\/student\/student-card\/photo\?v=/);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const replaced = await (await uploadPhoto(studentCookie)).json();
    assert.notEqual(replaced.photoUrl, firstPhoto.photoUrl);
    assert.equal(listPhotos().filter((name) => !photosBefore.has(name)).length, 1, 'the replaced photo file is removed');
    const served = await fetch(`${base}${replaced.photoUrl}`, { headers: { cookie: studentCookie } });
    assert.equal(served.status, 200);

    // The learner may delete their photo at will and upload again.
    const deleted = await (await json(studentCookie, 'DELETE', '/student/student-card/photo')).json();
    assert.equal(deleted.photoUrl, null);
    assert.equal((await fetch(`${base}/student/student-card/photo`, { headers: { cookie: studentCookie } })).status, 404);
    assert.equal((await uploadPhoto(studentCookie)).status, 201);

    // The admin list carries the same versioned URL pattern.
    const learners = await (await fetch(`${base}/admin/student-cards/students`, { headers: { cookie: adminCookie } })).json();
    const learner = learners.find((row) => row.studentId === 'STU-001');
    assert.match(learner.photoUrl, /^\/admin\/student-cards\/students\/STU-001\/photo\?v=/);

    // Rejecting a photo is main-admin only, removes it and notifies the learner with the reason.
    assert.equal((await json(studentCookie, 'DELETE', '/admin/student-cards/students/STU-001/photo', { reason: 'x' })).status, 403);
    const rejected = await json(adminCookie, 'DELETE', '/admin/student-cards/students/STU-001/photo', { reason: 'Face not visible' });
    assert.equal(rejected.status, 200);
    assert.equal((await rejected.json()).photoUrl, null);
    assert.equal((await json(adminCookie, 'DELETE', '/admin/student-cards/students/STU-001/photo', {})).status, 404);
    assert.equal((await json(adminCookie, 'DELETE', '/admin/student-cards/students/NOPE/photo', {})).status, 404);
    const note = await db.get("SELECT message FROM notifications n JOIN users u ON u.id=n.user_id WHERE u.student_id='STU-001' AND n.type='student-card' ORDER BY n.id DESC LIMIT 1");
    assert.match(note.message, /Face not visible/);
    assert.equal(listPhotos().filter((name) => !photosBefore.has(name)).length, 0, 'rejected photo file is removed');

    // Deleting the default promotes another template so a default always exists.
    assert.equal((await json(adminCookie, 'DELETE', `/admin/student-cards/templates/${second.template.id}`)).status, 200);
    const remaining = await (await fetch(`${base}/admin/student-cards/templates`, { headers: { cookie: adminCookie } })).json();
    assert.deepEqual(remaining.map((t) => [t.id, t.isDefault]), [[first.template.id, true]]);
  } finally {
    listPhotos().filter((name) => !photosBefore.has(name)).forEach((name) => fs.rmSync(path.join(photoDir, name), { force: true }));
    await new Promise(resolve => server.close(resolve));
  }
});
test('marked work reaches the learner only once published, with download receipt and reflection', { concurrency: false }, async () => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const academicYear = new Date().getFullYear();
  const watched = ['assignment-submissions', 'assignment-marked'].map((name) => path.join(__dirname, '..', 'school_data', name));
  const list = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const before = watched.map((dir) => new Set(list(dir)));

  const signIn = async (username, password) => {
    const res = await fetch(`${base}/api/accounts/sign-in`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
    assert.equal(res.status, 200);
    return res.headers.get('set-cookie');
  };
  const zipForm = (name, extra = {}) => {
    const form = new FormData();
    Object.entries(extra).forEach(([key, value]) => form.set(key, value));
    form.set('file', new Blob([Buffer.from('PK\u0003\u0004 fake zip')], { type: 'application/zip' }), name);
    return form;
  };
  const studentView = async (cookie, assignmentId) => {
    const res = await fetch(`${base}/student/assignments`, { headers: { cookie } });
    assert.equal(res.status, 200);
    return (await res.json()).submissions.find((row) => row.assignmentId === assignmentId);
  };

  try {
    const lecturer = await db.createAdmin({ name: 'Feedback Lecturer', username: 'feedback-lecturer', password: 'Lecturer123!', role: 'admin', temporary: false });
    await db.run('INSERT INTO staff_course_assignments(user_id,course,year_level,academic_year,active) VALUES(?,?,?,?,1)', [lecturer.id, 'Computer Science', 1, academicYear]);
    await db.createStudent({ name: 'Feedback Learner', username: 'feedback-learner', password: 'Student123!', studentId: 'FB-001', course: 'Computer Science', yearLevel: 1 });
    const inserted = await db.run(
      `INSERT INTO assignments(title,subject,course,year_level,academic_year,start_at,due_date,due_time,file_name,file_path,owner_id,completed,open_override,active)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,0,0,1)`,
      ['Feedback Loop Essay', 'Writing', 'Computer Science', 1, academicYear, '2000-01-01T00:00', '2999-12-31', '23:59', 'brief.txt', 'assignments/brief.txt', lecturer.id]
    );
    const assignmentId = inserted.lastID;
    const learner = await signIn('feedback-learner', 'Student123!');
    const staff = await signIn('feedback-lecturer', 'Lecturer123!');
    const main = await signIn('mainadmin', 'ChangeMe123!');

    const submitted = await fetch(`${base}/student/assignments/${assignmentId}/submit`, { method: 'POST', headers: { cookie: learner }, body: zipForm('essay.zip', { conductAcknowledged: 'true' }) });
    assert.equal(submitted.status, 201);
    const submissionId = (await submitted.json()).id;

    // A lecturer marks it (awaiting approval) and attaches the annotated copy.
    const release = await fetch(`${base}/admin/marking/release`, { method: 'POST', headers: { cookie: staff, 'content-type': 'application/json' },
      body: JSON.stringify({ studentId: 'FB-001', assessmentId: `ASSIGN-${assignmentId}`, assessmentName: 'Feedback Loop Essay', mark: 45, passingMark: 60, feedback: 'Argument: 3/10 · Structure: 6/10 — Cite your sources.' }) });
    assert.ok([200, 201].includes(release.status), `release status ${release.status}`);
    const upload = await fetch(`${base}/admin/assignment-submissions/${submissionId}/marked-file`, { method: 'POST', headers: { cookie: staff }, body: zipForm('essay-marked.zip') });
    assert.equal(upload.status, 200);
    const uploaded = await upload.json();
    assert.equal(uploaded.markedFileName, 'essay-marked.zip');
    assert.equal(uploaded.closed, true, 'returning a marked copy closes the submission');

    // Not yet published: the learner sees neither score nor marked copy and cannot overwrite the work.
    let mine = await studentView(learner, assignmentId);
    assert.equal(mine.mark, undefined);
    assert.equal(mine.markedFileUrl, null);
    assert.equal((await fetch(`${base}/api/assignment-submissions/${submissionId}/marked-download`, { headers: { cookie: learner } })).status, 404);
    assert.equal((await fetch(`${base}/student/assignment-submissions/${submissionId}/reflection`, { method: 'PUT', headers: { cookie: learner, 'content-type': 'application/json' }, body: JSON.stringify({ reflection: 'early' }) })).status, 409);
    assert.equal((await fetch(`${base}/student/assignments/${assignmentId}/submit`, { method: 'POST', headers: { cookie: learner }, body: zipForm('again.zip', { conductAcknowledged: 'true' }) })).status, 409);

    // The main administrator approves and publishes through the workflow.
    const markRow = await db.get('SELECT id FROM marks WHERE student_id=? AND assessment_id=?', ['FB-001', `ASSIGN-${assignmentId}`]);
    for (const status of ['Approved', 'Published']) {
      const res = await fetch(`${base}/admin/marks/${markRow.id}/status`, { method: 'POST', headers: { cookie: main, 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
      assert.equal(res.status, 200, status);
    }
    const stored = await db.get('SELECT mark,mark_published_at AS publishedAt,closed FROM assignment_submissions WHERE id=?', [submissionId]);
    assert.equal(stored.mark, 45);
    assert.ok(stored.publishedAt, 'workflow publish stamps the submission');

    // An outbox retry of the same published mark repairs a submission row that fell out of sync.
    await db.run('UPDATE assignment_submissions SET mark=NULL, closed=0 WHERE id=?', [submissionId]);
    const retry = await fetch(`${base}/admin/marking/release`, { method: 'POST', headers: { cookie: main, 'content-type': 'application/json' },
      body: JSON.stringify({ studentId: 'FB-001', assessmentId: `ASSIGN-${assignmentId}`, assessmentName: 'Feedback Loop Essay', mark: 45, passingMark: 60 }) });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);
    const repaired = await db.get('SELECT mark,closed FROM assignment_submissions WHERE id=?', [submissionId]);
    assert.equal(repaired.mark, 45);
    assert.equal(repaired.closed, 1);

    mine = await studentView(learner, assignmentId);
    assert.equal(mine.mark, 45);
    assert.equal(mine.passed, false);
    assert.match(mine.markFeedback, /Argument: 3\/10/);
    assert.ok(mine.markedFileUrl, 'marked copy visible after publishing');
    assert.equal(mine.markedDownloadedAt, null);
    const notes = await (await fetch(`${base}/api/notifications`, { headers: { cookie: learner } })).json();
    assert.ok(notes.some((note) => /result released/i.test(note.title) && /Feedback Loop Essay/.test(note.message)), 'learner is notified');

    const download = await fetch(`${base}/api/assignment-submissions/${submissionId}/marked-download`, { headers: { cookie: learner } });
    assert.equal(download.status, 200);
    await download.arrayBuffer();
    assert.ok((await studentView(learner, assignmentId)).markedDownloadedAt, 'download receipt recorded');

    const reflect = await fetch(`${base}/student/assignment-submissions/${submissionId}/reflection`, { method: 'PUT', headers: { cookie: learner, 'content-type': 'application/json' }, body: JSON.stringify({ reflection: 'I need stronger evidence for my argument.' }) });
    assert.equal(reflect.status, 200);
    assert.equal((await reflect.json()).reflection, 'I need stronger evidence for my argument.');

    // Staff can withdraw a wrongly attached copy.
    assert.equal((await fetch(`${base}/admin/assignment-submissions/${submissionId}/marked-file`, { method: 'DELETE', headers: { cookie: staff } })).status, 200);
    assert.equal((await studentView(learner, assignmentId)).markedFileUrl, null);
  } finally {
    watched.forEach((dir, index) => list(dir).filter((name) => !before[index].has(name)).forEach((name) => fs.rmSync(path.join(dir, name), { force: true })));
    await new Promise(resolve => server.close(resolve));
  }
});
