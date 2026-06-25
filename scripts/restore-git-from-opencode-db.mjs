// ══════════════════════════════════════════════════════════════
// restore-git-from-opencode-db.mjs — v2 (batch mode)
// Восстанавливает git-историю из копий opencode SQLite баз.
// ══════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const DB_DIR = 'Q:/User_Data/Desktop/TestQA/scripts/db-copies';
const REPO_DIR = 'Q:/User_Data/Desktop/TestQA/restored-repo';
const DBS = readdirSync(DB_DIR).filter(f => f.endsWith('.db'));

console.log('Found databases:', DBS);

function extractAllDiffs() {
  const allDiffs = [];

  for (const dbFile of DBS) {
    const dbPath = path.join(DB_DIR, dbFile);
    let db;
    try {
      db = new Database(dbPath, { readonly: true });
    } catch { continue; }

    if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session'").get()) {
      db.close(); continue;
    }

    const rows = db.prepare(`
      SELECT m.id, m.session_id, m.time_created, m.data as msg_data,
             s.title as session_title, s.time_created as session_time
      FROM message m JOIN session s ON m.session_id = s.id
      WHERE s.directory LIKE '%TestQA%'
        AND m.data LIKE '%"diffs"%'
      ORDER BY m.time_created ASC
    `).all();

    console.log(`  ${dbFile.padEnd(30)} ${rows.length} messages with diffs`);

    for (const row of rows) {
      try {
        const msgData = JSON.parse(row.msg_data);
        if (!msgData.summary?.diffs) continue;
        for (const d of msgData.summary.diffs) {
          if (!d.patch) continue;
          allDiffs.push({
            session_id: row.session_id,
            session_title: row.session_title || '',
            session_time: row.session_time,
            message_time: row.time_created,
            file: d.file, patch: d.patch,
            status: d.status || 'modified',
          });
        }
      } catch {}
    }
    db.close();
  }

  allDiffs.sort((a, b) => a.message_time - b.message_time);
  return allDiffs;
}

function rebuildGit() {
  console.log('\n=== Step 1: Extract diffs ===');
  const allDiffs = extractAllDiffs();

  // Group by session
  const sessions = new Map();
  for (const d of allDiffs) {
    if (!sessions.has(d.session_id)) {
      sessions.set(d.session_id, { id: d.session_id, title: d.session_title, time: d.session_time, diffs: [] });
    }
    sessions.get(d.session_id).diffs.push(d);
  }

  console.log(`\nTotal diffs: ${allDiffs.length}`);
  console.log(`Sessions: ${sessions.size}`);
  console.log(`Unique files: ${new Set(allDiffs.map(d => d.file)).size}`);

  console.log('\n=== Step 2: Create repo ===');
  if (existsSync(REPO_DIR)) execSync(`rmdir /s /q "${REPO_DIR}"`, { stdio: 'pipe' });
  mkdirSync(REPO_DIR, { recursive: true });
  execSync('git init', { cwd: REPO_DIR, stdio: 'pipe' });
  execSync('git config user.email "restore@local"', { cwd: REPO_DIR, stdio: 'pipe' });
  execSync('git config user.name "Restore"', { cwd: REPO_DIR, stdio: 'pipe' });

  console.log('\n=== Step 3: Apply diffs by session ===');

  const sortedSessions = [...sessions.values()].sort((a, b) => a.time - b.time);
  let commitCount = 0;

  for (const session of sortedSessions) {
    const diffs = session.diffs.sort((a, b) => a.message_time - b.message_time);

    // Write ALL diffs for this session to a single patch file
    let allPatches = '';
    for (const d of diffs) {
      allPatches += d.patch;
      if (!d.patch.endsWith('\n')) allPatches += '\n';
    }

    // Apply all patches at once
    const patchFile = path.join(REPO_DIR, '.batch.patch');
    writeFileSync(patchFile, allPatches, 'utf-8');

    let applied = true;
    try {
      execSync(`git apply --whitespace=nowarn "${patchFile}" 2>&1`, {
        cwd: REPO_DIR, stdio: 'pipe', encoding: 'utf-8', timeout: 30000,
      });
    } catch {
      // Some patches might fail, try each one individually
      applied = false;
      try { execSync(`del "${patchFile}" 2>nul`, { stdio: 'pipe' }); } catch {}
    }

    if (!applied) {
      // Apply individually, only log errors
      let ok = 0, fail = 0;
      for (const d of diffs) {
        const pf = path.join(REPO_DIR, '.s.patch');
        writeFileSync(pf, d.patch, 'utf-8');
        try {
          execSync(`git apply --whitespace=nowarn "${pf}" 2>&1`, { cwd: REPO_DIR, stdio: 'pipe' });
          ok++;
        } catch {
          // Try to create file directly from patch content
          try {
            const lines = d.patch.split('\n');
            const fullPath = path.join(REPO_DIR, d.file);
            const newLines = lines.filter(l => l.startsWith('+') && !l.startsWith('+++') && !l.startsWith('@@'))
              .map(l => l.slice(1));
            if (newLines.length > 3) { // Only if patch has meaningful content
              mkdirSync(path.dirname(fullPath), { recursive: true });
              writeFileSync(fullPath, newLines.join('\n'), 'utf-8');
              ok++;
            } else {
              fail++;
            }
          } catch { fail++; }
        }
        try { execSync(`del "${pf}" 2>nul`, { stdio: 'pipe' }); } catch {}
      }
      if (fail > 0) {
        console.log(`  ⚠️  ${session.title?.slice(0, 50)}: ${ok}/${diffs.length} ok, ${fail} failed`);
      }
    }

    // Commit
    try {
      execSync('git add -A 2>&1', { cwd: REPO_DIR, stdio: 'pipe' });
      const status = execSync('git status --porcelain 2>&1', { cwd: REPO_DIR, encoding: 'utf-8', stdio: 'pipe' });
      if (status.trim().length > 0) {
        const safeMsg = (session.title || `session-${session.id.slice(0, 8)}`)
          .replace(/[<>"|]/g, '').slice(0, 100);
        execSync(`git commit -m "${safeMsg}" 2>&1`, { cwd: REPO_DIR, stdio: 'pipe' });
        commitCount++;
      }
    } catch {}

    try { execSync(`del "${patchFile}" 2>nul`, { stdio: 'pipe' }); } catch {}
  }

  // Show result
  console.log(`\n=== Done ===`);
  console.log(`Commits: ${commitCount}`);
  try {
    const log = execSync('git log --oneline --reverse 2>&1', { cwd: REPO_DIR, encoding: 'utf-8' });
    const lines = log.trim().split('\n');
    console.log(`Git history (${lines.length} commits):`);
    lines.forEach(l => console.log(`  ${l}`));
  } catch {}
}

rebuildGit();
