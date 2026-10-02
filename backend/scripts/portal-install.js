#!/usr/bin/env node
/**
 * Installation manager for Meridian Learning Hub.
 *
 * Three installations can live side by side. Each one is a separate folder holding its own
 * SQLite database and uploaded files, so testing a demo or a clean install never touches the
 * real data:
 *
 *   real   backend/school_data      your institution's data (the default `npm start`)
 *   demo   backend/installs/demo    sample accounts, courses, assignments and marks
 *   clean  backend/installs/clean   empty; the first main administrator is created in the browser
 *
 * Commands (run from the backend folder):
 *   npm run demo            start the demo install (seeded automatically on first start)
 *   npm run demo:fresh      wipe the demo install, re-seed it and start it
 *   npm run clean           start the clean install
 *   npm run clean:fresh     wipe the clean install and start it empty
 *   npm run real            start the real install (same as npm start)
 *   npm run installs        show what each install contains
 *   npm run backup          snapshot the real install into backend/backups/
 *   npm run backup -- demo  snapshot another install
 *
 * Only one install can use port 5000 at a time: stop the running backend (Ctrl+C) before
 * starting another. The real install is never deleted by this script; use reset-install.js
 * (which requires ALLOW_RESET=true) for that deliberately destructive operation.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BACKEND = path.resolve(__dirname, '..');
const INSTALLS = {
  real: { dir: path.join(BACKEND, 'school_data'), env: { SEED_DEMO: 'false' }, label: 'Real install (your data)' },
  demo: { dir: path.join(BACKEND, 'installs', 'demo'), env: { SEED_DEMO: 'true', SEED_COURSE_EXAMPLES: 'true' }, label: 'Demo install (sample data)' },
  clean: { dir: path.join(BACKEND, 'installs', 'clean'), env: { SEED_DEMO: 'false', SEED_COURSE_EXAMPLES: 'false' }, label: 'Clean install (empty)' },
};
const DEMO_LOGINS = [
  ['Main administrator', 'mainadmin', 'ChangeMe123!'],
  ['Lecturer', 'admin', 'Admin123!'],
  ['Temporary lecturer', 'tempadmin', 'TempAdmin123!'],
  ['Student', 'student', 'Student123!'],
];

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function pickInstall(name, fallback) {
  const key = String(name || fallback || '').toLowerCase();
  if (!INSTALLS[key]) fail(`Unknown install "${name || ''}". Use one of: ${Object.keys(INSTALLS).join(', ')}.`);
  return [key, INSTALLS[key]];
}

function wipe(key, install) {
  if (key === 'real') fail('This script never deletes the real install. Use reset-install.js with ALLOW_RESET=true if you truly mean to.');
  const relative = path.relative(path.join(BACKEND, 'installs'), install.dir);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) fail(`Refusing to delete unexpected folder ${install.dir}.`);
  try {
    fs.rmSync(install.dir, { recursive: true, force: true });
    console.log(`✔ Wiped ${install.label}: ${install.dir}`);
  } catch (error) {
    fail(`Could not wipe ${install.dir} (${error.code || error.message}). Stop the running backend (Ctrl+C in its terminal) and try again.`);
  }
}

function start(key, install) {
  const port = process.env.PORT || '5000';
  console.log('');
  console.log(`▶ Starting the ${install.label}`);
  console.log(`  Data folder: ${install.dir}`);
  console.log(`  API:         http://localhost:${port}`);
  console.log('  Portal:      start the frontend in a second terminal (cd frontend; npm start) and open http://localhost:3000');
  if (key === 'demo') {
    console.log('  Demo sign-ins (the first start seeds them; this takes a few seconds):');
    DEMO_LOGINS.forEach(([role, user, password]) => console.log(`    ${role.padEnd(20)} ${user.padEnd(10)} ${password}`));
  }
  if (key === 'clean') {
    console.log('  The portal opens on the setup screen until you create the first main administrator.');
  }
  console.log('  Stop with Ctrl+C.\n');

  const env = { ...process.env, ...install.env, PORTAL_DATA_DIR: install.dir };
  // A DB_PATH left in the shell would silently point every install at the same database.
  delete env.DB_PATH;
  const child = spawn(process.execPath, [path.join(BACKEND, 'server.js')], { cwd: BACKEND, env, stdio: 'inherit' });
  const forward = (signal) => () => { if (!child.killed) child.kill(signal); };
  process.on('SIGINT', forward('SIGINT'));
  process.on('SIGTERM', forward('SIGTERM'));
  child.on('exit', (code) => process.exit(code ?? 0));
}

function folderStats(dir) {
  let files = 0;
  let bytes = 0;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) { files += 1; bytes += fs.statSync(full).size; }
    }
  };
  walk(dir);
  return { files, bytes };
}

function openReadOnly(file) {
  const sqlite3 = require('sqlite3');
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(file, sqlite3.OPEN_READONLY, (error) => (error ? reject(error) : resolve(database)));
  });
}
const query = (database, sql) => new Promise((resolve) => database.get(sql, (error, row) => resolve(error ? null : row)));

async function describe(key, install) {
  console.log(`\n${install.label}  [${key}]`);
  console.log(`  Folder:   ${install.dir}`);
  const dbFile = path.join(install.dir, 'portal.sqlite');
  if (!fs.existsSync(dbFile)) {
    console.log(`  Status:   not created yet — run "npm run ${key}" to create it`);
    return;
  }
  const { files, bytes } = folderStats(install.dir);
  console.log(`  Size:     ${(bytes / 1024 / 1024).toFixed(2)} MB in ${files} file(s)`);
  try {
    const database = await openReadOnly(dbFile);
    const users = await query(database, `SELECT COUNT(*) AS total,
      SUM(role='main-admin') AS mainAdmins, SUM(role='admin') AS staff, SUM(role='student') AS students FROM users`);
    const counts = await query(database, `SELECT (SELECT COUNT(*) FROM courses WHERE active=1) AS courses,
      (SELECT COUNT(*) FROM assignments WHERE active=1) AS assignments,
      (SELECT COUNT(*) FROM assignment_submissions) AS submissions,
      (SELECT COUNT(*) FROM marks) AS marks`);
    const demo = await query(database, "SELECT value FROM install_meta WHERE key='demo_seeded'");
    database.close();
    const type = demo
      ? `demo data (seeded ${demo.value})`
      : Number(users?.total) ? 'standard' : 'empty — waiting for the first main administrator';
    console.log(`  Type:     ${type}`);
    console.log(`  Accounts: ${Number(users?.total || 0)} (${Number(users?.mainAdmins || 0)} main admin, ${Number(users?.staff || 0)} staff, ${Number(users?.students || 0)} students)`);
    if (counts) console.log(`  Content:  ${counts.courses} courses, ${counts.assignments} assignments, ${counts.submissions} submissions, ${counts.marks} marks`);
  } catch (error) {
    console.log(`  Could not read the database: ${error.message}`);
  }
}

async function backup(key, install) {
  const dbFile = path.join(install.dir, 'portal.sqlite');
  if (!fs.existsSync(dbFile)) fail(`${install.label} has no database to back up yet.`);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const target = path.join(BACKEND, 'backups', `${key}-${stamp}`);
  fs.mkdirSync(target, { recursive: true });
  // Uploaded files are copied as they are; the database is written with VACUUM INTO, which
  // produces a consistent single-file copy even while the backend is running.
  for (const entry of fs.readdirSync(install.dir, { withFileTypes: true })) {
    if (/^portal\.sqlite(-wal|-shm|-journal)?$/.test(entry.name) || entry.name === 'tmp') continue;
    fs.cpSync(path.join(install.dir, entry.name), path.join(target, entry.name), { recursive: true });
  }
  const sqlite3 = require('sqlite3');
  await new Promise((resolve, reject) => {
    const database = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY, (openError) => {
      if (openError) return reject(openError);
      return database.run('VACUUM INTO ?', [path.join(target, 'portal.sqlite')], (error) => database.close(() => (error ? reject(error) : resolve())));
    });
  });
  console.log(`✔ Backed up ${install.label} to ${target}`);
  console.log('  To restore: stop the backend, then copy everything in that folder back into');
  console.log(`  ${install.dir}`);
}

async function main() {
  const [command, name] = process.argv.slice(2);
  switch (command) {
    case 'start': {
      const [key, install] = pickInstall(name);
      return start(key, install);
    }
    case 'fresh': {
      const [key, install] = pickInstall(name);
      wipe(key, install);
      return start(key, install);
    }
    case 'wipe': {
      const [key, install] = pickInstall(name);
      return wipe(key, install);
    }
    case 'status':
      for (const [key, install] of Object.entries(INSTALLS)) await describe(key, install);
      console.log('');
      return undefined;
    case 'backup': {
      const [key, install] = pickInstall(name, 'real');
      return backup(key, install);
    }
    default:
      console.log('Usage: node scripts/portal-install.js <start|fresh|wipe|status|backup> [real|demo|clean]');
      console.log('See "Installation manual" in README.md.');
      return process.exit(command ? 1 : 0);
  }
}

main().catch((error) => fail(error.message));
