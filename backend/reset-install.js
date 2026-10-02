
/**
 * FULL PORTAL RESET / CLEAN INSTALL
 *
 * Destructive operation: removes backend/school_data/ and therefore deletes the local
 * SQLite database, sessions, uploaded files, generated encryption key and live portal data.
 *
 * After the reset, the application is intentionally empty and the first main administrator
 * is created through the portal setup screen. No hidden/demo administrator is created.
 *
 * Usage:
 *   ALLOW_RESET=true node reset-install.js
 *
 * ALLOW_RESET=true is required in every environment. When DB_PATH points outside
 * school_data/, ALLOW_EXTERNAL_DB_RESET=true is also required.
 */

const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.resolve(__dirname, 'school_data');
const configuredDbPath = String(process.env.DB_PATH || '').trim();
const CONFIGURED_DB_PATH = configuredDbPath && configuredDbPath !== ':memory:' ? path.resolve(configuredDbPath) : null;
const isInsideDataRoot = (candidate) => {
  const relative = path.relative(DATA_ROOT, candidate);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
};

if (process.env.ALLOW_RESET !== 'true') {
  console.error(
    'Refusing to reset portal data. Review the deletion targets, then set ALLOW_RESET=true only when you deliberately intend to destroy this installation.'
  );
  process.exit(1);
}

const deletesExternalDatabase = CONFIGURED_DB_PATH && !isInsideDataRoot(CONFIGURED_DB_PATH);
if (deletesExternalDatabase && process.env.ALLOW_EXTERNAL_DB_RESET !== 'true') {
  console.error(
    `Refusing to delete the configured database outside school_data/: ${CONFIGURED_DB_PATH}. Set ALLOW_EXTERNAL_DB_RESET=true as well as ALLOW_RESET=true only when this external database should also be destroyed.`
  );
  process.exit(1);
}

console.log('Reset targets:');
console.log(`- ${DATA_ROOT}${path.sep} (portal database, uploads, sessions, encryption key, and runtime data)`);
if (deletesExternalDatabase) {
  console.log(`- ${CONFIGURED_DB_PATH}`);
  console.log(`- ${CONFIGURED_DB_PATH}-wal`);
  console.log(`- ${CONFIGURED_DB_PATH}-shm`);
}

try {
  fs.rmSync(DATA_ROOT, { recursive: true, force: true });
  // db.js supports DB_PATH for installations that deliberately keep the SQLite database outside
  // school_data. Reset that exact database and its SQLite WAL/SHM sidecars too, but never delete
  // the rest of the configured parent directory.
  if (deletesExternalDatabase) {
    fs.rmSync(CONFIGURED_DB_PATH, { force: true });
    fs.rmSync(`${CONFIGURED_DB_PATH}-wal`, { force: true });
    fs.rmSync(`${CONFIGURED_DB_PATH}-shm`, { force: true });
  }
} catch (error) {
  console.error(
    'Could not complete the full reset. Stop the backend/server process and any open database clients, then run this command again.'
  );
  console.error(error.message);
  process.exit(1);
}

console.log('');
console.log('FULL PORTAL RESET COMPLETE');
console.log('===========================');
console.log('Deleted: school_data/, SQLite database, server sessions, uploaded files, encryption key, and live portal data.');
if (deletesExternalDatabase) console.log(`Also deleted configured DB_PATH: ${CONFIGURED_DB_PATH} (+ WAL/SHM sidecars).`);
console.log('');
console.log('STEP-BY-STEP CLEAN INSTALL');
console.log('1. Start the backend/server.');
console.log('2. Open the frontend/portal.');
console.log('3. Create the first main administrator on the setup screen.');
console.log('4. Sign in as the main administrator.');
console.log('5. Create permanent administrator/teacher/lecturer accounts.');
console.log('6. Create temporary administrator accounts only when temporary access is required.');
console.log('7. Create the institution course catalogue.');
console.log('8. Allocate each teacher/lecturer to the correct course + year teaching group.');
console.log('9. Create learner accounts and allocate each learner to the correct course + year group and lecturer.');
console.log('10. Create institution calendar events and course/year remediation weeks.');
console.log('11. Create assignments/tests only against an assigned course + year group.');
console.log('12. Test assignment opening, closing, reopening, student submission, marking, and cross-account visibility.');
console.log('13. Refresh/sign out/in and verify database-backed records persist.');

console.log('');
console.log('CLEAN INSTALL DEFAULTS');
console.log('SEED_DEMO=false');
console.log('SEED_COURSE_EXAMPLES=false');
console.log('No demo username/password is created by this reset.');
console.log('');
console.log('CROSS-PLATFORM DEVELOPMENT');
console.log('Web: use the responsive React build on Windows, Linux, macOS, ChromeOS, Android and iOS browsers.');
console.log('Local phone/tablet testing: set REACT_APP_API_BASE to the host computer LAN address and CORS_ORIGINS to the frontend origin.');
console.log('Android native wrapper: use the Capacitor steps documented in the README after the responsive web build is working.');
console.log('iOS/iPadOS native wrapper: use Capacitor + Xcode on a Mac; use the current Apple SDK requirements documented in the README.');
console.log('PWA: optionally add a manifest/service worker to the responsive web build for an installable web experience.');
console.log('');
console.log('OPTIONAL SHOWCASE MODE');
console.log('SEED_DEMO=true');
console.log('SEED_COURSE_EXAMPLES=true');
console.log('Demo mode must be deliberately enabled; it is never created by this clean reset.');

