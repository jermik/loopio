const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const variant = process.argv[2] || 'trial';
const targetPlatform = process.argv[3] || process.platform;
const root = process.cwd();
const releaseDir = path.join(root, 'release');
const mainSource = path.join(root, 'electron', variant === 'trial' ? 'main-trial.cjs' : 'main-full.cjs');
const mainTarget = path.join(root, 'electron', 'main.cjs');
const appName = variant === 'trial' ? 'MyLoopio-Trial' : 'MyLoopio-Full';

if (!fs.existsSync(mainSource)) {
  console.error(`Missing entry file: ${mainSource}`);
  process.exit(1);
}
if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('Missing dist build. Run "npm run build" first.');
  process.exit(1);
}
fs.mkdirSync(releaseDir, { recursive: true });
fs.copyFileSync(mainSource, mainTarget);

function resolvePackagerCli() {
  const candidates = [
    path.join(root, 'node_modules', '@electron', 'packager', 'bin', 'electron-packager.js'),
    path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'electron-packager.cmd' : 'electron-packager'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const cli = resolvePackagerCli();
if (!cli) {
  console.error('Could not find electron-packager. Run "npm install" first.');
  process.exit(1);
}

const cliArgs = [
  '.',
  appName,
  `--platform=${targetPlatform}`,
  '--arch=x64',
  '--out=release',
  '--overwrite',
  '--prune=true',
  '--ignore=^/release$',
  '--ignore=^/.git$',
  '--ignore=^/.github$',
  '--ignore=^/private$',
  '--ignore=^/scripts/pack\\.mjs$',
  '--ignore=^/scripts/pack-cli\\.cjs$',
];

if (targetPlatform === 'win32') cliArgs.push('--icon=build/icon.ico');
if (targetPlatform === 'linux') cliArgs.push('--icon=build/icon.png');
if (targetPlatform === 'darwin') cliArgs.push('--icon=build/icon.icns');

let cmd;
let args;
if (cli.endsWith('.cmd')) {
  cmd = cli;
  args = cliArgs;
} else {
  cmd = process.execPath;
  args = [cli, ...cliArgs];
}

console.log(`\nPacking ${variant} for ${targetPlatform}...`);
console.log([cmd, ...args].join(' '));

const result = spawnSync(cmd, args, {
  cwd: root,
  stdio: 'inherit',
  shell: cli.endsWith('.cmd'),
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status || 0);
