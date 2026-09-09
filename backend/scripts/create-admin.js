// Creates the first administrator on a clean install, where no demo accounts exist and there
// would otherwise be no way to sign in.
//
//   npm run create-admin
//
// The password is requested interactively rather than passed as an argument, so it cannot leak
// into shell history or a process listing, and only its bcrypt hash is stored.
const readline = require('readline');
const bcrypt = require('bcryptjs');

// Requiring ../db opens the database, which triggers demo seeding unless it is switched off.
// Creating an administrator must never have the side effect of inventing 50 demo students, so
// seeding is disabled here before the module loads. Setting SEED_DEMO=true explicitly still wins,
// for anyone deliberately adding an admin to the demo dataset.
if (process.env.SEED_DEMO !== 'true') process.env.SEED_DEMO = 'false';
const { run, get } = require('../db');

const interactive = process.stdin.isTTY;

// When input is piped, stdin reaches end-of-file almost immediately — long before the async
// database checks below finish — which would close readline and abort the run. So piped input is
// drained into a queue up front and answers are shifted off it, letting the script work both
// interactively and from a provisioning script.
let piped = [];
const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;

function readAllStdin() {
  if (interactive) return Promise.resolve();
  return new Promise((resolve) => {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { buffer += chunk; });
    process.stdin.on('end', () => { piped = buffer.split(/\r?\n/); resolve(); });
  });
}

const ask = (question) => {
  if (!interactive) { process.stdout.write(question + '\n'); return Promise.resolve((piped.shift() || '').trim()); }
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
};

// Masks the password so it is not left visible on screen. Masking only applies to a real
// terminal — piped input has no screen to shoulder-surf and the redraw would corrupt output.
function askHidden(question) {
  if (!interactive) return ask(question);
  return new Promise((resolve) => {
    const onData = () => rl.output.write('\x1B[2K\x1B[200D' + question + '*'.repeat(rl.line.length));
    process.stdin.on('data', onData);
    rl.question(question, (answer) => {
      process.stdin.removeListener('data', onData);
      rl.output.write('\n');
      resolve(answer.trim());
    });
  });
}

const done = () => { if (rl) rl.close(); };

(async () => {
  try {
    await readAllStdin();
    const existing = await get("SELECT username FROM users WHERE role = 'main-admin' LIMIT 1");
    if (existing) {
      console.log(`\nA main administrator already exists (${existing.username}).`);
      const proceed = await ask('Create an additional one anyway? [y/N] ');
      if (proceed.toLowerCase() !== 'y') { done(); return; }
    }

    console.log('\nCreate the first administrator account\n');
    const name = await ask('Full name: ');
    const username = await ask('Username: ');
    const password = await askHidden('Password (min 8 characters): ');
    const confirm = await askHidden('Confirm password: ');

    if (!name || !username) throw new Error('Name and username are both required.');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    if (password !== confirm) throw new Error('Passwords do not match.');
    if (await get('SELECT id FROM users WHERE username = ?', [username])) {
      throw new Error(`Username "${username}" is already taken.`);
    }

    const hash = await bcrypt.hash(password, 12);
    await run('INSERT INTO users(name,username,password,role) VALUES(?,?,?,?)', [name, username, hash, 'main-admin']);
    console.log(`\nMain administrator "${username}" created. You can now sign in.\n`);
    done();
  } catch (error) {
    console.error(`\nCould not create the administrator: ${error.message}\n`);
    done();
    process.exitCode = 1;
  }
})();
