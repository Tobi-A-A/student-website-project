// Deletes every row of school data from an existing database, for turning a demo install into a
// clean one without hunting for the SQLite file.
//
//   npm run reset-db -- --yes
//
// Tables are emptied in foreign-key-safe order inside a single transaction, so the database is
// never left half-wiped. The schema itself is preserved.
const path = require('path');
// Requiring ../db triggers demo seeding unless disabled — which would re-create the demo accounts
// this script exists to delete. Always load the database with seeding off.
process.env.SEED_DEMO = 'false';
const { run, get, transaction } = require('../db');

const TABLES = ['marks', 'assessments', 'password_resets', 'sessions', 'audit_logs', 'users'];

(async () => {
  const confirmed = process.argv.includes('--yes');
  const target = process.env.DB_PATH || path.join(__dirname, '..', 'school_data', 'portal.sqlite');

  if (!confirmed) {
    const counts = [];
    for (const table of TABLES) counts.push(`${(await get(`SELECT count(*) c FROM ${table}`)).c} ${table}`);
    console.log(`\nThis would permanently delete all data from:\n  ${target}\n`);
    console.log(`Currently holding: ${counts.join(', ')}.\n`);
    console.log('Re-run with --yes to confirm:\n  npm run reset-db -- --yes\n');
    return;
  }

  try {
    await transaction(async () => {
      for (const table of TABLES) await run(`DELETE FROM ${table}`);
      // Reset AUTOINCREMENT counters so a clean install starts from id 1 rather than continuing
      // the demo's numbering.
      await run("DELETE FROM sqlite_sequence WHERE name IN ('users','marks','audit_logs')").catch(() => {});
    });
    console.log(`\nDatabase cleared: ${target}`);
    console.log('Create an administrator with:  npm run create-admin\n');
  } catch (error) {
    console.error(`\nReset failed, no data was changed: ${error.message}\n`);
    process.exitCode = 1;
  }
})();
