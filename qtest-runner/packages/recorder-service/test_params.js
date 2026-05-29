const d = require('better-sqlite3')('test_params.db');
d.exec(`DROP TABLE IF EXISTS t`);
d.exec(`CREATE TABLE t (a INT, b INT, c INT, d INT, e INT, f INT, g INT, h INT, i INT)`);

// Test exactly the failing pattern - 9 placeholders, some with undefined
const sql = 'INSERT INTO t (a,b,c,d,e,f,g,h,i) VALUES (?,?,?,?,?,?,?,?,?)';
const stmt = d.prepare(sql);

// All defined
try { stmt.run(1,2,3,4,5,6,7,8,9); console.log('All defined: OK'); } catch(e) { console.log('All defined:', e.message); }

// Some undefined
try { stmt.run(1,undefined,3,undefined,5,undefined,7,undefined,9); console.log('Some undefined: OK'); } catch(e) { console.log('Some undefined:', e.message); }

// All undefined
try { stmt.run(undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined); console.log('All undefined: OK'); } catch(e) { console.log('All undefined:', e.message); }

d.close();
console.log('Total rows:', d.prepare('SELECT COUNT(*) as c FROM t').get().c);
