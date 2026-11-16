// One command to look at Moodie with sample people and films.
// Starts a disposable API (its own temporary database, never your personal one)
// and the web client pointed at it. Ctrl-C stops both and the data is discarded.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const self = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(self), '..');
const supported = version => { const major = Number(String(version).split('.')[0]); return major >= 20 && major < 26; };

// The default `node` on a machine is often newer than Moodie supports. Rather
// than stop, look for a supported one in the usual places and run under it.
if (!supported(process.versions.node)) {
  const home = os.homedir();
  const nvm = path.join(home, '.nvm/versions/node');
  const candidates = [
    path.join(home, '.local/bin/node'),
    ...(existsSync(nvm) ? readdirSync(nvm).sort().reverse().map(name => path.join(nvm, name, 'bin/node')) : []),
    ...['24', '22', '20'].flatMap(major => [`/opt/homebrew/opt/node@${major}/bin/node`, `/usr/local/opt/node@${major}/bin/node`]),
  ];
  const node = candidates.find(candidate => existsSync(candidate)
    && supported(spawnSync(candidate, ['-p', 'process.versions.node'], { encoding: 'utf8' }).stdout?.trim()));
  if (!node) {
    console.error(`Moodie needs Node.js 20 to 25 (22 recommended). This is ${process.version}, and no supported version was found in ~/.local/bin, ~/.nvm or Homebrew. Install Node 22 and run this again.`);
    process.exit(1);
  }
  // Its folder goes first on PATH so `npx` and anything it starts use the same Node.
  const child = spawn(node, [self, ...process.argv.slice(2)], { cwd: root, stdio: 'inherit', env: { ...process.env, PATH: `${path.dirname(node)}${path.delimiter}${process.env.PATH}` } });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('exit', code => process.exit(code ?? 0));
  await new Promise(() => {});
}
const apiPort = 3101, webPort = 5273;
const run = (command, args, env = {}) => spawn(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
const children = [
  run(process.execPath, ['--import', 'tsx', 'ios/scripts/start-fixture.ts']),
  run('npx', ['vite', '--port', String(webPort), '--strictPort', '--host'], { MOODIE_API_PROXY: `http://127.0.0.1:${apiPort}` }),
];
console.log(`
Moodie preview
  Web:      http://localhost:${webPort}  (the Network address Vite prints below opens it on a phone on the same Wi-Fi)
  Sign in:  ios_viewer / native-test-password   (sample account with people and recommendations)
  Sign up:  create any account to see the first-run choice
  iPhone:   see ios/README.md, "Preview in the simulator"
`);
let stopping = false;
const stop = code => { if (stopping) return; stopping = true; for (const child of children) child.kill('SIGTERM'); process.exitCode = code ?? 0; };
for (const child of children) child.on('exit', code => stop(code ?? 0));
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
