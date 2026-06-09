#!/usr/bin/env node
/**
 * Chrome Launcher for CDP
 * Launches Chrome with remote debugging enabled
 *
 * Usage:
 *   node chrome-launcher.js              # Launch Chrome
 *   node chrome-launcher.js --check      # Check if CDP is running
 *   node chrome-launcher.js --kill       # Kill Chrome CDP instances
 */

const { execSync, spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CDP_PORT = 9222;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(process.env.USERPROFILE || process.env.HOME, '.chrome-devtools');

function checkCDP() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${CDP_PORT}/json/version`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          resolve({ running: true, ...info });
        } catch {
          resolve({ running: false });
        }
      });
    });
    req.on('error', () => resolve({ running: false }));
    req.setTimeout(2000, () => { req.destroy(); resolve({ running: false }); });
  });
}

function killChrome() {
  try {
    // Kill Chrome processes using CDP port
    execSync(`taskkill /F /IM chrome.exe 2>nul`, { stdio: 'ignore' });
    return { killed: true };
  } catch {
    return { killed: false, note: 'No Chrome processes found' };
  }
}

function launchChrome(url) {
  if (!fs.existsSync(CHROME_PATH)) {
    return { error: 'Chrome not found', path: CHROME_PATH };
  }

  const args = [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-translate',
    '--metrics-recording-only',
    '--safebrowsing-disable-auto-update',
  ];

  if (url) args.push(url);

  const child = spawn(CHROME_PATH, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  return { launched: true, pid: child.pid, port: CDP_PORT, userDataDir: USER_DATA_DIR };
}

async function waitForChrome(maxWait = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const status = await checkCDP();
    if (status.running) return status;
    await new Promise(r => setTimeout(r, 500));
  }
  return { running: false, timeout: true };
}

// ── CLI ──

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--check')) {
    const status = await checkCDP();
    console.log(JSON.stringify(status, null, 2));
    process.exit(status.running ? 0 : 1);
  }

  if (args.includes('--kill')) {
    const result = killChrome();
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  // Check if already running
  const status = await checkCDP();
  if (status.running) {
    console.log(JSON.stringify({ alreadyRunning: true, ...status }, null, 2));
    process.exit(0);
  }

  // Launch Chrome
  const url = args.find(a => a.startsWith('http')) || 'about:blank';
  const result = launchChrome(url);
  console.log('Launching Chrome...', JSON.stringify(result, null, 2));

  // Wait for CDP to be ready
  const ready = await waitForChrome();
  console.log('CDP Status:', JSON.stringify(ready, null, 2));
  process.exit(ready.running ? 0 : 1);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
