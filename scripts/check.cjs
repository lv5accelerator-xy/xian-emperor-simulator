'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function files(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
}
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: {
    ...process.env, EXPECTED_VERSION: process.env.EXPECTED_VERSION || '2.24.0'
  }, windowsHide: true, timeout: 600000 });
  if (result.error || result.status !== 0) {
    console.error(`Check failed: node ${args.join(' ')}`, result.error?.message || `exit ${result.status}`);
    process.exit(1);
  }
}
const scripts = files('src').filter(file => file.endsWith('.js')).sort();
const tests = files('tests').filter(file => file.endsWith('-regression.js')).sort();
if (!tests.length) throw new Error('No regression scripts discovered');
for (const script of scripts) run(['--check', script]);
for (const test of tests) run([test]);
console.log(`PASS: ${scripts.length} syntax checks; ${tests.length} regression scripts. Browser and CI inline checks are separate.`);
