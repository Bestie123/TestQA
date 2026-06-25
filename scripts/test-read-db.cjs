const Database = require('better-sqlite3');
const db = new Database('db-copies/opencode-backup-2026-06-04.db', { readonly: true });
const rows = db.prepare(`
  SELECT s.id, s.title, s.time_created, COUNT(m.id) as msgs
  FROM session s LEFT JOIN message m ON m.session_id = s.id
  WHERE s.directory LIKE '%TestQA%'
  GROUP BY s.id ORDER BY s.time_created
`).all();
console.log(`Sessions: ${rows.length}`);
rows.forEach((r, i) => console.log(`${i+1}. ${(r.title||'(no title)').slice(0,50)} [${r.msgs} msgs]`));
db.close();
