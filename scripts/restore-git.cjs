// ══════════════════════════════════════════════════════════════
// restore-git.cjs — Восстановление git-истории из opencode DB
//
// Извлекает все диффы из копий БД, применяет их
// хронологически, создаёт git-коммиты по сессиям.
// ══════════════════════════════════════════════════════════════

const { execSync } = require('child_process');
const { existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync } = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_DIR = path.join(__dirname, 'db-copies');
const REPO_DIR = 'Q:/User_Data/Desktop/TestQA/restored-repo';
const DBS = readdirSync(DB_DIR).filter(f => f.endsWith('.db'));

console.log('Databases:', DBS);

// ── Extract all diffs ──
function extract() {
  const all = [];
  for (const f of DBS) {
    const dbPath = path.join(DB_DIR, f);
    let db;
    try { db = new Database(dbPath, { readonly: true }); } catch { continue; }

    const rows = db.prepare(`
      SELECT m.session_id, m.time_created, m.data as d,
             s.title as stitle, s.time_created as stime
      FROM message m JOIN session s ON m.session_id = s.id
      WHERE s.directory LIKE '%TestQA%' AND m.data LIKE '%"diffs"%'
      ORDER BY m.time_created
    `).all();
    console.log(`  ${f}: ${rows.length} msgs`);

    for (const r of rows) {
      try {
        const msg = JSON.parse(r.d);
        if (!msg.summary?.diffs) continue;
        for (const diff of msg.summary.diffs) {
          if (diff.patch) all.push({
            sid: r.session_id, stitle: r.stitle, stime: r.stime,
            mtime: r.time_created, file: diff.file, patch: diff.patch,
            status: diff.status,
          });
        }
      } catch {}
    }
    db.close();
  }
  all.sort((a, b) => a.mtime - b.mtime);
  return all;
}

// ── Extract new file content from unified diff ──
function extractText(patch) {
  const lines = patch.split('\n');
  const isNew = patch.includes('new file mode') || /^@@ -0,0 /m.test(patch);
  const isDel = patch.includes('deleted file mode');
  if (isDel) return null; // file was deleted

  // Collect content from + lines and context lines
  let result = [];
  let inHunk = false;
  for (const l of lines) {
    if (l.startsWith('--- ') || l.startsWith('+++ ') || l.startsWith('diff ') ||
        l.startsWith('index ') || l.startsWith('new file') || l.startsWith('deleted file') ||
        l.startsWith('GIT binary') || l.startsWith('binary'))
      continue;
    if (l.startsWith('@@')) {
      inHunk = true;
      continue;
    }
    if (l.startsWith('+')) { result.push(l.slice(1)); }
    else if (!l.startsWith('-')) { result.push(l); }
  }
  return result.join('\n');
}

// ── Main ──
function main() {
  console.log('\n=== Extracting diffs ===');
  const all = extract();
  console.log(`\nTotal diffs: ${all.length}`);

  const files = new Set(all.map(d => d.file));
  const sessions = new Map();
  for (const d of all) {
    if (!sessions.has(d.sid)) sessions.set(d.sid, {
      title: d.stitle || d.sid.slice(0,12), time: d.stime, diffs: [],
    });
    sessions.get(d.sid).diffs.push(d);
  }
  console.log(`Sessions: ${sessions.size}, Files: ${files.size}`);

  console.log('\n=== Creating repo ===');
  if (existsSync(REPO_DIR)) execSync(`rmdir /s /q "${REPO_DIR}"`);
  mkdirSync(REPO_DIR, { recursive: true });
  execSync('git init', { cwd: REPO_DIR, stdio: 'pipe' });
  execSync('git config user.email "r@local"', { cwd: REPO_DIR, stdio: 'pipe' });
  execSync('git config user.name "R"', { cwd: REPO_DIR, stdio: 'pipe' });

  console.log('\n=== Applying diffs ===');
  let commits = 0;
  const sorted = [...sessions.values()].sort((a, b) => a.time - b.time);

  for (const s of sorted) {
    const diffs = s.diffs.sort((a, b) => a.mtime - b.mtime);
    let ok = 0, fail = 0;

    for (const d of diffs) {
      try {
        const fp = path.join(REPO_DIR, d.file);
        const content = extractText(d.patch);
        if (content === null) {
          // File deletion
          if (existsSync(fp)) execSync(`git rm "${d.file}" 2>nul`, { cwd: REPO_DIR, stdio: 'pipe' });
          ok++;
        } else {
          mkdirSync(path.dirname(fp), { recursive: true });
          // Read existing content to compare
          let existing = '';
          try { existing = readFileSync(fp, 'utf-8'); } catch {}
          if (content !== existing) {
            writeFileSync(fp, content, 'utf-8');
          }
          ok++;
        }
      } catch (e) {
        fail++;
      }
    }

    if (ok > 0) {
      try {
        execSync('git add -A 2>&1', { cwd: REPO_DIR, stdio: 'pipe' });
        const st = execSync('git status --porcelain 2>&1', { cwd: REPO_DIR, encoding: 'utf-8' });
        if (st.trim()) {
          const msg = s.title.replace(/[<>"|]/g, '').slice(0, 100);
          execSync(`git commit -m "${msg}" 2>&1`, { cwd: REPO_DIR, stdio: 'pipe' });
          commits++;
        }
      } catch {}
    }
    if (fail > 0) console.log(`  ⚠  ${s.title.slice(0,40)}: ${ok} ok, ${fail} fail`);
    process.stdout.write('.');
  }

  console.log(`\n\n=== Done ===`);
  console.log(`Commits: ${commits}`);
  try {
    const log = execSync('git log --oneline --reverse 2>&1', { cwd: REPO_DIR, encoding: 'utf-8' });
    const lines = log.trim().split('\n');
    lines.forEach(l => console.log(`  ${l}`));
  } catch {}
}

main();
