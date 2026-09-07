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
