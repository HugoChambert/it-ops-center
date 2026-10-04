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

  // INC-7..16: resolved incidents spread over the last 7 days for analytics demo.
  // Rules: all Resolved/Closed, resolved_at ≥ 25h ago (outside today → "resolvedToday" tests safe),
  //        no "VPN" in title/description, no Open/Critical+Open rows, no new systems.
  // Format: [title, description, priority, status, created_h_ago, resolved_h_ago, resolution]
  // Resolution time = created_h_ago - resolved_h_ago. SLA windows: Critical 1h, High 4h, Medium 8h, Low 24h.
  const incR = db.prepare(`INSERT INTO incidents (title,description,priority,status,assignee,affected_user,system_id,created_at,updated_at,resolved_at,resolution)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  [
    // INC-7:  High,     created 50h ago, resolved 46h ago → 4h exactly → within SLA (High 4h) ✓
    ['Print server queue stuck',       'Jobs queued but not printing.',              'High',     'Resolved', 'Hugo Chambert', null, 1, 50, 46, 'Restarted print spooler service.'],
    // INC-8:  Medium,   created 50h ago, resolved 43h ago → 7h → within SLA (Medium 8h) ✓
    ['File sync errors on workstation', 'User reports files not syncing to share.',   'Medium',   'Resolved', 'Sam Okafor',    null, 4, 50, 43, 'Re-mapped network drive and cleared cache.'],
    // INC-9:  Low,      created 55h ago, resolved 32h ago → 23h → within SLA (Low 24h) ✓
    ['Monitor flickering intermittently','Display flickers under load.',              'Low',      'Resolved', 'Dana Wu',       null, 1, 55, 32, 'Replaced DisplayPort cable.'],
    // INC-10: High,     created 75h ago, resolved 68h ago → 7h → outside SLA (High 4h) ✗
    ['Email attachment blocked',        'Large attachments rejected by mail relay.',  'High',     'Resolved', 'Hugo Chambert', null, 5, 75, 68, 'Raised attachment size limit on mail relay.'],
    // INC-11: Medium,   created 75h ago, resolved 63h ago → 12h → outside SLA (Medium 8h) ✗
    ['Disk quota alert on file server',  'USER quota at 95%, writes failing.',        'Medium',   'Resolved', 'Sam Okafor',    null, 4, 75, 63, 'Archived old project folders and extended quota.'],
    // INC-12: Critical, created 100h ago, resolved 99h ago → 1h exactly → within SLA (Critical 1h) ✓
    ['Database service crashed',        'Primary DB process exited unexpectedly.',    'Critical', 'Resolved', 'Dana Wu',       null, 3, 100, 99, 'Restarted DB service; root cause: OOM.'],
    // INC-13: Critical, created 120h ago, resolved 116h ago → 4h → outside SLA (Critical 1h) ✗
    ['Authentication service down',     'Login requests returning 503.',             'Critical', 'Closed',   'Hugo Chambert', null, 2, 120, 116, 'Redeployed auth service pod; investigated OOM.'],
    // INC-14: Low,      created 120h ago, resolved 99h ago → 21h → within SLA (Low 24h) ✓
    ['Keyboard not recognised on boot', 'USB keyboard undetected after reboot.',      'Low',      'Resolved', 'Sam Okafor',    null, 1, 120, 99, 'Updated USB controller firmware.'],
    // INC-15: High,     created 145h ago, resolved 140h ago → 5h → outside SLA (High 4h) ✗
    ['Software licence expired',        'Application reports licence invalid.',       'High',     'Resolved', 'Dana Wu',       null, 2, 145, 140, 'Renewed annual licence and restarted application.'],
    // INC-16: Medium,   created 145h ago, resolved 138h ago → 7h → within SLA (Medium 8h) ✓
    ['Browser crashes on intranet site','Crash occurs on specific internal page.',    'Medium',   'Closed',   'Hugo Chambert', null, 1, 145, 138, 'Cleared browser profile; updated to latest version.'],
  ].forEach(([t,d,p,s,a,u,sid,c,r,res]) => incR.run(t,d,p,s,a,u,sid,ago(c),ago(r),ago(r),res));

  seedArticles(db);
}
