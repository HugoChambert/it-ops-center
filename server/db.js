const { DatabaseSync } = process.getBuiltinModule('node:sqlite'); // avoids bundler resolution issues in Vitest
import fs from 'node:fs';
import path from 'node:path';

export function createDb(file = process.env.DATABASE_PATH || './data/itops.db') {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS systems (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL,
      cpu INTEGER, memory INTEGER, disk INTEGER, uptime_days INTEGER, last_checked TEXT);
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
      priority TEXT NOT NULL CHECK (priority IN ('Low','Medium','High','Critical')),
      status TEXT NOT NULL CHECK (status IN ('Open','Investigating','Pending','Resolved','Closed')),
      assignee TEXT, affected_user TEXT, system_id INTEGER REFERENCES systems(id),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, resolved_at TEXT);
  `);
  const cols = db.prepare('PRAGMA table_info(incidents)').all().map((c) => c.name);
  if (!cols.includes('resolution')) db.exec("ALTER TABLE incidents ADD COLUMN resolution TEXT DEFAULT ''");
  db.exec(`CREATE TABLE IF NOT EXISTS incident_events (
    id INTEGER PRIMARY KEY, incident_id INTEGER NOT NULL REFERENCES incidents(id),
    type TEXT NOT NULL CHECK (type IN ('status','note','action')), message TEXT NOT NULL,
    author TEXT, created_at TEXT NOT NULL)`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, symptoms TEXT DEFAULT '', causes TEXT DEFAULT '',
      diagnostic_steps TEXT DEFAULT '', resolution TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS article_incidents (
      article_id INTEGER NOT NULL REFERENCES articles(id), incident_id INTEGER NOT NULL REFERENCES incidents(id),
      PRIMARY KEY (article_id, incident_id));
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS incident_reports (
      incident_id INTEGER PRIMARY KEY REFERENCES incidents(id), problem TEXT NOT NULL, impact TEXT DEFAULT '',
      investigation TEXT DEFAULT '', root_cause TEXT DEFAULT '', resolution TEXT DEFAULT '',
      preventative_action TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);`);
  return db;
}

function seedArticles(db) {
  if (db.prepare('SELECT COUNT(*) c FROM articles').get().c > 0) return;
  const t = new Date().toISOString();
  const r = db.prepare('INSERT INTO articles (title,symptoms,causes,diagnostic_steps,resolution,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run('VPN Certificate Troubleshooting',
      'Users cannot connect to the corporate VPN.\nClient shows an authentication or certificate error.',
      'Expired or missing client certificate.\nVPN gateway unavailable.\nSystem clock out of sync.',
      'Verify network connectivity.\nTest the gateway: Test-NetConnection vpn.company.local -Port 443\nCheck the VPN client logs.\nList certificates: Get-ChildItem Cert:\\CurrentUser\\My\nCheck the certificate expiry date.',
      'Reissue or renew the client certificate, then reconnect. If the gateway is down, escalate to the network team.', t, t);
  if (db.prepare('SELECT id FROM incidents WHERE id = 1').get())
    db.prepare('INSERT INTO article_incidents VALUES (?,?)').run(r.lastInsertRowid, 1);
}

export function seed(db) {
  if (db.prepare('SELECT COUNT(*) c FROM systems').get().c > 0) return seedArticles(db);
  const now = new Date();
  const ago = (h) => new Date(now - h * 3600e3).toISOString();
  const sys = db.prepare('INSERT INTO systems (name,type,status,cpu,memory,disk,uptime_days,last_checked) VALUES (?,?,?,?,?,?,?,?)');
  [['WEB-01','Web server','Healthy',34,52,41,112],['WEB-02','Web server','Healthy',41,58,44,112],
   ['DB-01','Database','Degraded',78,86,72,63],['FILE-01','File server','Healthy',12,33,88,201],
   ['MAIL-01','Mail server','Healthy',27,49,55,90],['VPN-01','VPN gateway','Down',0,0,38,0]]
    .forEach((s) => sys.run(...s, ago(0.1)));
  const inc = db.prepare(`INSERT INTO incidents (title,description,priority,status,assignee,affected_user,system_id,created_at,updated_at,resolved_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  // SLA windows: Critical 1h, High 4h, Medium 8h, Low 24h.
  // INC-1 (Critical):  created 30h ago → overdue by ~29h
  // INC-2 (High):      created 20h ago → overdue by ~16h
  // INC-3 (Medium):    created  6h ago → within 8h window (~2h remaining)
  // INC-4..6 resolved/closed: sla = null
  [['Unable to connect to corporate VPN','Users report authentication failures.','Critical','Investigating','Hugo Chambert','J. Alvarez',6,30,2,null],
   ['Database replication lag','Replica is minutes behind primary.','High','Open','Sam Okafor','Finance team',3,20,5,null],
   ['Shared drive slow to open','File listing takes over 30 seconds.','Medium','Pending','Hugo Chambert','M. Chen',4,6,1,null],
   ['Mailbox quota exceeded','User cannot send mail.','Low','Resolved','Sam Okafor','T. Brooks',5,26,1,1],
   ['Web certificate expiring','Certificate expires in 7 days.','High','Resolved','Dana Wu',null,1,40,3,3],
   ['Password reset loop','Reset link returns to login.','Medium','Closed','Dana Wu','R. Patel',2,90,60,60]]
    .forEach(([t,d,p,s,a,u,sid,c,up,r]) => inc.run(t,d,p,s,a,u,sid,ago(c),ago(up),r == null ? null : ago(r)));
  seedArticles(db);
}
