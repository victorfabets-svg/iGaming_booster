// Build script - creates bundled worker.js
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const appDir = path.join(__dirname, '..');
const outdir = path.join(appDir, 'dist');
const outfile = path.join(outdir, 'worker.js');

// Ensure dist exists
if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir, { recursive: true });
}

console.log('Building worker...');
console.log('Entry:', path.join(appDir, 'src/index.ts'));
console.log('Output:', outfile);

esbuild.buildSync({
  entryPoints: [path.join(appDir, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: outfile,
  external: [],
  sourcemap: false,
  minify: false,
});

console.log('Build complete');

// Verify output
if (fs.existsSync(outfile)) {
  console.log('Output file exists:', fs.statSync(outfile).size, 'bytes');
} else {
  console.error('ERROR: Output file not created');
  process.exit(1);
}