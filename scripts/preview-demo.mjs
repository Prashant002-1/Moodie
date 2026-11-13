// One command to look at Moodie with sample people and films.
// Starts a disposable API (its own temporary database, never your personal one)
// and the web client pointed at it. Ctrl-C stops both and the data is discarded.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [major] = process.versions.node.split('.').map(Number);
if (major < 20 || major >= 26) {
  console.error(`Moodie needs Node.js 20 to 25 (22 recommended). This is ${process.version}. Run \`nvm use\` or put Node 22 first on PATH.`);
  process.exit(1);
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
