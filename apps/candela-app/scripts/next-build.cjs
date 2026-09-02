process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = '1';

const { spawnSync } = require('child_process');
const path = require('path');

const nextBin = require.resolve('next/dist/bin/next');
const result = spawnSync(process.execPath, [nextBin, 'build', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
  cwd: path.join(__dirname, '..'),
});

process.exit(result.status ?? 1);
