#!/usr/bin/env node
/**
 * Create a main administrator from the command line — for recovery when nobody can sign in.
 *
 *   npm run create-admin -- --name "Thandi Mokoena" --username thandi --password "S3cure-pass!"
 *   npm run create-admin -- --install demo --name ... --username ... --password ...
 *
 * --install chooses real (default), demo or clean. Stop the backend first.
 * --reset   when a main administrator already exists, give that account the new name,
 *           username and password (unlocks it and signs it out everywhere).
 */

const path = require('path');

const args = {};
const argv = process.argv.slice(2);
for (let index = 0; index < argv.length; index += 1) {
  const match = /^--([a-z-]+)(?:=(.*))?$/.exec(argv[index]);
  if (!match) continue;
  args[match[1]] = match[2] !== undefined ? match[2] : argv[index + 1];
  if (match[1] === 'reset') { args.reset = true; continue; }
  if (match[2] === undefined) index += 1;
}
const reset = Boolean(args.reset);

const folders = {
  real: path.resolve(__dirname, '..', 'school_data'),
  demo: path.resolve(__dirname, '..', 'installs', 'demo'),
  clean: path.resolve(__dirname, '..', 'installs', 'clean'),
};
const install = String(args.install || 'real').toLowerCase();
const name = String(args.name || '').trim();
const username = String(args.username || '').trim().toLowerCase();
const password = String(args.password || '');

if (!folders[install] || !name || !username || password.length < 8) {
  console.error('Usage: npm run create-admin -- --name "Full Name" --username user --password "at-least-8-chars" [--install real|demo|clean] [--reset]');
  process.exit(1);
}

// db.js reads these at load time, so they must be set before it is required.
process.env.PORTAL_DATA_DIR = folders[install];
process.env.SEED_DEMO = 'false';
delete process.env.DB_PATH;
const bcrypt = require('bcryptjs');
const { ready, createAdmin, get, run, db } = require('../db');

(async () => {
  await ready;
  const existingMain = await get("SELECT id, username FROM users WHERE role='main-admin' ORDER BY id LIMIT 1");
  if (existingMain) {
    if (!reset) {
      throw new Error(`A main administrator ("${existingMain.username}") already exists in the ${install} install. `
        + 'Only one is allowed. Add --reset to give that account the new username and password instead.');
    }
    const clash = await get('SELECT id FROM users WHERE LOWER(username)=? AND id<>?', [username, existingMain.id]);
    if (clash) throw new Error(`The username "${username}" belongs to another account in the ${install} install.`);
    const hash = await bcrypt.hash(password, 12);
    await run('UPDATE users SET name=?, username=?, password=?, failed_attempts=0, locked_until=NULL WHERE id=?',
      [name, username, hash, existingMain.id]);
    await run('DELETE FROM sessions WHERE user_id=?', [existingMain.id]);
    console.log(`✔ Main administrator reset in the ${install} install: sign in as "${username}" with the new password.`);
    return;
  }
  if (await get('SELECT id FROM users WHERE LOWER(username)=?', [username])) {
    throw new Error(`The username "${username}" already exists in the ${install} install.`);
  }
  await createAdmin({ name, username, password, role: 'main-admin', temporary: false });
  console.log(`✔ Main administrator "${username}" created in the ${install} install (${folders[install]}).`);
})()
  .catch((error) => {
    console.error(`✖ ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.close());
