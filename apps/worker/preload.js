const path = require('path');
const Module = require('module');
const fs = require('fs');

// Load environment variables from .env
const projectRoot = path.resolve(__dirname + '/../..');
const envPath = path.resolve(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^([^#][^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  });
  console.log('✅ ENV loaded from .env');
}

// The compiled code is in dist/, so @shared should resolve to dist/shared
const distRoot = path.resolve(projectRoot, 'apps/worker/dist');
const sharedPath = path.resolve(distRoot, 'shared');
const domainsPath = path.resolve(distRoot, 'apps/api/src/domains');

const originalRequire = Module.prototype.require;
Module.prototype.require = function(request) {
  if (request.startsWith('@shared/')) {
    const aliasPath = request.replace('@shared/', sharedPath + '/');
    try { return originalRequire.call(this, aliasPath + '.js'); } catch {}
    try { return originalRequire.call(this, aliasPath + '/index.js'); } catch {}
  }
  if (request.startsWith('@domains/')) {
    const aliasPath = request.replace('@domains/', domainsPath + '/');
    try { return originalRequire.call(this, aliasPath + '.js'); } catch {}
    try { return originalRequire.call(this, aliasPath + '/index.js'); } catch {}
  }
  return originalRequire.call(this, request);
};

console.log('✅ Preload: installed');