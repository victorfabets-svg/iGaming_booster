const esbuild = require('esbuild');

async function build() {
  try {
    await esbuild.build({
      entryPoints: ['src/server/index.ts'],
      bundle: true,
      platform: 'node',
      target: 'node20',
      outfile: 'dist/server.js',
      external: ['pg', 'pg-hstore'],  // Native modules must remain external
      format: 'cjs',
      sourcemap: true,
    });
    console.log('✅ Bundle created: dist/server.js');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();