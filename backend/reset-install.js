
const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.resolve(__dirname, 'school_data');

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_RESET !== 'true') {
  console.error('Refusing to reset production data. Set ALLOW_RESET=true only when you deliberately intend to destroy this installation.');
  process.exit(1);
}

if (!fs.existsSync(DATA_ROOT)) {
  console.log('No school_data directory exists. The installation is already empty.');
  process.exit(0);
}

try {
  fs.rmSync(DATA_ROOT, { recursive: true, force: true });
} catch (error) {
  console.error('Could not reset school_data. Stop the backend/server process first, then run this command again.');
  console.error(error.message);
  process.exit(1);
}

console.log('Fresh-install reset complete: school_data/ was deleted.');
console.log('Start the backend again to recreate SQLite and return to Initial system setup.');
