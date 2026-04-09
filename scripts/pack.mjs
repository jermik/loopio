import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packager = require('@electron/packager');

const variant = process.argv[2] || 'trial';
const targetPlatform = process.argv[3] || process.platform;
const supportedPlatforms = new Set(['win32', 'linux', 'darwin']);
const supportedVariants = new Set(['trial', 'full']);

if (!supportedPlatforms.has(targetPlatform)) {
  console.error(`Unsupported platform target: ${targetPlatform}`);
  process.exit(1);
}
if (!supportedVariants.has(variant)) {
  console.error(`Unsupported variant: ${variant}`);
  process.exit(1);
}

const root = process.cwd();
const releaseDir = path.join(root, 'release');
const packageJsonPath = path.join(root, 'package.json');
const mainFile = variant === 'trial' ? 'electron/main-trial.cjs' : 'electron/main-full.cjs';
const productName = variant === 'trial' ? 'MyLoopio Trial' : 'MyLoopio';
const appName = variant === 'trial' ? 'MyLoopio-Trial' : 'MyLoopio';
const executableName = variant === 'trial' ? 'MyLoopio-Trial' : 'MyLoopio';

if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('Missing dist build. Run "npm run build" first.');
  process.exit(1);
}
if (!fs.existsSync(path.join(root, mainFile))) {
  console.error(`Missing entry file: ${mainFile}`);
  process.exit(1);
}

fs.mkdirSync(releaseDir, { recursive: true });

const originalPkgRaw = fs.readFileSync(packageJsonPath, 'utf8');
const pkg = JSON.parse(originalPkgRaw);
const tempPkg = {
  ...pkg,
  main: mainFile,
  productName,
};

const options = {
  dir: root,
  name: appName,
  platform: targetPlatform,
  arch: 'x64',
  out: releaseDir,
  overwrite: true,
  prune: true,
  electronVersion: '41.1.0',
  appVersion: pkg.version || '1.0.0',
  appBundleId: variant === 'trial' ? 'com.myloopio.trial' : 'com.myloopio.full',
  ignore: [
    /^\/release$/,
    /^\/\.git$/,
    /^\/\.github$/,
    /^\/scripts$/,
    /^\/private$/,
    /^\/node_modules\/\.cache$/,
  ],
  executableName,
  quiet: false,
};

if (targetPlatform === 'win32') {
  options.icon = path.join(root, 'build', 'icon.ico');
  options.win32metadata = {
    ProductName: productName,
    FileDescription: 'MyLoopio Automation App',
    CompanyName: 'MyLoopio',
  };
}

if (targetPlatform === 'linux') {
  options.icon = path.join(root, 'build', 'icon.png');
}

if (targetPlatform === 'darwin') {
  options.icon = path.join(root, 'build', 'icon.icns');
  options.appCategoryType = 'public.app-category.productivity';
}

try {
  fs.writeFileSync(packageJsonPath, JSON.stringify(tempPkg, null, 2));
  const appPaths = await packager(options);
  console.log('\nCreated:');
  for (const p of appPaths) console.log(p);
  console.log(`\nDone: ${variant} build for ${targetPlatform} created in ./release`);
} catch (error) {
  console.error('\nPackaging failed.');
  console.error(error);
  process.exit(1);
} finally {
  fs.writeFileSync(packageJsonPath, originalPkgRaw);
}
