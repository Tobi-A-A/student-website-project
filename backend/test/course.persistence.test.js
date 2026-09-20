
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, after } = require('node:test');
const assert = require('node:assert/strict');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'student-portal-course-test-'));
process.env.DB_PATH = path.join(testDir, 'course-test.sqlite');
process.env.SEED_DEMO = 'false';
process.env.SEED_COURSE_EXAMPLES = 'true';

const {
  ready,
  run,
  get,
  createCourse,
  listCourses,
  findCourse,
  deleteCourse,
} = require('../db');

test('CT01 custom course persists and becomes part of the shared catalogue', async () => {
  await ready;
  await run(
    `INSERT INTO users(name, username, password, role) VALUES(?,?,?,'main-admin')`,
    ['Course Creator', 'course_creator', 'not-used']
  );

  const created = await createCourse({
    name: 'Ancient History',
    requirement: 'English and an interest in historical research.',
    createdBy: 1,
  });

  assert.equal(created.name, 'Ancient History');
  assert.equal(created.isDefault, false);

  const persistedRow = await get(
    'SELECT id, name, requirement, active FROM courses WHERE id=?',
    [created.id]
  );
  assert.equal(persistedRow.name, 'Ancient History');
  assert.equal(persistedRow.active, 1);

  const catalogue = await listCourses();
  assert.ok(catalogue.some((course) => course.name === 'Ancient History' && course.isDefault === false));

  const lookup = await findCourse('  ancient history  ');
  assert.equal(lookup.id, created.id);
  assert.equal(lookup.name, 'Ancient History');
});

test('CT02 duplicate course names are rejected case-insensitively', async () => {
  await assert.rejects(
    () => createCourse({
      name: 'ancient   HISTORY',
      requirement: 'Different requirements.',
      createdBy: 1,
    }),
    /already exists/i
  );
});

test('CT03 removing an unused course works and a later create reactivates it', async () => {
  const course = await findCourse('Ancient History');
  assert.ok(course?.id);

  const removed = await deleteCourse(course.id);
  assert.equal(removed.active, false);
  assert.equal(await findCourse('Ancient History'), null);

  const recreated = await createCourse({
    name: 'Ancient History',
    requirement: 'Updated entry requirements.',
    createdBy: 1,
  });
  assert.equal(recreated.id, course.id);
  assert.equal((await findCourse('Ancient History')).requirement, 'Updated entry requirements.');
});

test('CT04 course cannot be removed while a student or teaching group uses it', async () => {
  const course = await findCourse('Ancient History');
  assert.ok(course?.id);

  await run(
    `INSERT INTO users(name, username, password, student_id, role, course, year_level)
     VALUES(?,?,?,?,?,?,?)`,
    ['Course User', 'course_student', 'not-used', 'CT-STU-001', 'student', course.name, 1]
  );

  await assert.rejects(
    () => deleteCourse(course.id),
    /cannot be removed while students or teaching groups are using it/i
  );

  await run('DELETE FROM users WHERE student_id=?', ['CT-STU-001']);
  await run(
    `INSERT INTO users(name, username, password, role)
     VALUES(?,?,?,'admin')`,
    ['Course Teacher', 'course_teacher', 'not-used']
  );
  const teacher = await get('SELECT id FROM users WHERE username=?', ['course_teacher']);

  await run(
    `INSERT INTO staff_course_assignments(user_id, course, year_level, academic_year)
     VALUES(?,?,?,?)`,
    [teacher.id, course.name, 1, 2026]
  );

  await assert.rejects(
    () => deleteCourse(course.id),
    /cannot be removed while students or teaching groups are using it/i
  );
});

after(async () => {
  try {
    await new Promise((resolve) => {
      const db = require('../db').db;
      db.close(() => resolve());
    });
  } catch (_) {}
  fs.rmSync(testDir, { recursive: true, force: true });
});
