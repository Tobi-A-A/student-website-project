const fs = require("fs");
const os = require("os");
const path = require("path");

const { test } = require("node:test");
const assert = require("node:assert/strict");

// IMPORTANT: set these before importing db.js so the test uses a temporary database
// and does not touch the real school_data/portal.sqlite.
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "student-portal-unit-test-"));
process.env.DB_PATH = path.join(testDir, "test.sqlite");
process.env.SEED_DEMO = "false";

const {
  createStudent,
  run,
  get,
  deleteMark,
} = require("../db");

test("UT01 createStudent rejects invalid and duplicate identities", async () => {
  const created = await createStudent({
    name: "Unit Test Student",
    username: "unit_student",
    password: "Password123!",
    studentId: "UT-001",
    course: "Computer Science",
    yearLevel: 1,
  });

  assert.equal(created.role, "student");
  assert.equal(created.studentId, "UT-001");
  assert.equal(created.course, "Computer Science");
  assert.equal(created.yearLevel, 1);

  await assert.rejects(
    () =>
      createStudent({
        name: "Duplicate Username",
        username: "unit_student",
        password: "Password123!",
        studentId: "UT-002",
        course: "Computer Science",
        yearLevel: 1,
      }),
    /username already exists/i
  );

  await assert.rejects(
    () =>
      createStudent({
        name: "Duplicate Student ID",
        username: "unit_student_2",
        password: "Password123!",
        studentId: "UT-001",
        course: "Computer Science",
        yearLevel: 1,
      }),
    /student ID is already registered/i
  );

  await assert.rejects(
    () =>
      createStudent({
        name: "",
        username: "unit_student_3",
        password: "Password123!",
        studentId: "UT-003",
        course: "Computer Science",
        yearLevel: 1,
      }),
    /student name is required/i
  );
});

test("UT02 deleteMark removes the mark and matching remediation", async () => {
  const studentId = "UT-DEL-001";
  const assessmentId = "ASSIGN-UT-DELETE";

  await run(
    `INSERT INTO users
      (name, username, password, student_id, role, course, year_level)
     VALUES (?, ?, ?, ?, 'student', ?, ?)`,
    [
      "Delete Test Student",
      "delete_test_student",
      "not-used-in-test",
      studentId,
      "Computer Science",
      1,
    ]
  );

  await run(
    `INSERT INTO assessments (id, name, max_mark)
     VALUES (?, ?, 100)`,
    [assessmentId, "Delete test assessment"]
  );

  await run(
    `INSERT INTO marks
      (student_id, assessment_id, mark, passing_mark, status)
     VALUES (?, ?, ?, ?, 'Published')`,
    [studentId, assessmentId, 45, 60]
  );

  await run(
    `INSERT INTO remediations
      (student_id, assessment_id, assignment_id, assignment_title,
       original_mark, passing_mark, status)
     VALUES (?, ?, ?, ?, ?, ?, 'Open')`,
    [
      studentId,
      assessmentId,
      "UT-DELETE",
      "Delete test assessment",
      45,
      60,
    ]
  );

  const mark = await get(
    "SELECT id FROM marks WHERE student_id=? AND assessment_id=?",
    [studentId, assessmentId]
  );

  assert.ok(mark?.id);

  const deleted = await deleteMark(mark.id);

  assert.ok(deleted);
  assert.equal(deleted.mark, 45);

  const markAfterDelete = await get(
    "SELECT id FROM marks WHERE id=?",
    [mark.id]
  );

  assert.equal(markAfterDelete, null);

  const remediationAfterDelete = await get(
    "SELECT id FROM remediations WHERE student_id=? AND assessment_id=?",
    [studentId, assessmentId]
  );

  assert.equal(remediationAfterDelete, null);

  const missing = await deleteMark(999999999);
  assert.equal(missing, null);
});
