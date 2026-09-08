// Starts the API with demo seeding switched off, without needing `cross-env` or shell-specific
// syntax (`SEED_DEMO=false node server.js` does not work in PowerShell/cmd).
//
//   npm run start:clean
//
// server.js only calls listen() when it is the main module, so it is spawned as a child process
// rather than required — requiring it here would load the app but never bind the port.
const path = require('path');
const { spawn } = require('child_process');

const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
  stdio: 'inherit',
  env: { ...process.env, SEED_DEMO: 'false' },
});

child.on('exit', (code) => process.exit(code ?? 0));
