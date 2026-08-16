'use strict';

const { execSync } = require('child_process');

const port = process.argv[2];
if (!port || !/^\d+$/.test(port)) {
  console.error('Usage: node kill-port.js <port>');
  process.exit(1);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function pidsOnWindows(listenPort) {
  let out = '';
  try {
    out = execSync('netstat -ano', { encoding: 'utf8' });
  } catch {
    return [];
  }

  const pids = new Set();
  const portRe = new RegExp(`:${listenPort}\\s`);
  for (const line of out.split(/\r?\n/)) {
    if (!line.includes('LISTENING')) continue;
    if (!portRe.test(line)) continue;
    const pid = line.trim().split(/\s+/).pop();
    if (pid && pid !== '0') pids.add(pid);
  }
  return [...pids];
}

function killWindows(pids) {
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } catch {
      // process already exited
    }
  }
}

function killUnix(listenPort) {
  let out = '';
  try {
    out = execSync(`lsof -ti tcp:${listenPort}`, { encoding: 'utf8' }).trim();
  } catch {
    return;
  }
  if (!out) return;
  for (const pid of out.split(/\s+/)) {
    try {
      process.kill(Number(pid), 'SIGKILL');
    } catch {
      // process already exited
    }
  }
}

if (process.platform === 'win32') {
  const pids = pidsOnWindows(port);
  if (pids.length) {
    console.log(`Freeing port ${port} (PID ${pids.join(', ')})`);
    killWindows(pids);
    sleep(400);
  }
} else {
  killUnix(port);
}
