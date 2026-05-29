const d = require('better-sqlite3')('recordings.db');
const a = d.prepare("SELECT action_type, idx, method, status_code, resource_type, headers_json FROM recorded_actions WHERE action_type IN ('request','response','navigate','page_load') ORDER BY idx DESC LIMIT 10").all();
a.forEach(x => console.log(x.idx, x.action_type, (x.method||'-'), (x.status_code||'-'), (x.resource_type||'').slice(0,15), (x.headers_json||'{}').slice(0,30)));
d.close();
