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

test('creates a bcrypt-backed student and authenticates it', async () => {
  const student = await db.createStudent({ name: 'Test Student', username: 'test-user', password: 'correct horse battery staple', studentId: 'ST-1' });
  assert.equal(student.role, 'student');
  assert.equal((await db.findUser('test-user', 'wrong password')), null);
  assert.equal((await db.findUser('test-user', 'correct horse battery staple')).studentId, 'ST-1');
});

test('schema enforces unique marks and foreign keys', async () => {
  await db.run('INSERT INTO assessments(id,name) VALUES(?,?)', ['A-1', 'Assessment']);
  await db.run('INSERT INTO marks(student_id,assessment_id,mark) VALUES(?,?,?)', ['ST-1', 'A-1', 75]);
  await assert.rejects(() => db.run('INSERT INTO marks(student_id,assessment_id,mark) VALUES(?,?,?)', ['ST-1', 'A-1', 80]));
  await assert.rejects(() => db.run('INSERT INTO marks(student_id,assessment_id,mark) VALUES(?,?,?)', ['MISSING', 'A-1', 80]));
});

test('password reset changes the password and consumes the token', async () => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const request = await fetch(`${base}/api/accounts/password-reset/request`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'test-user' })
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
