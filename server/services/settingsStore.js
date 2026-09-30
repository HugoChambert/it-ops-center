export const DEFAULTS = { technician_name: 'Hugo Chambert', default_priority: 'Medium' };

export function getSetting(db, key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : DEFAULTS[key];
}
export function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}
export function getAllSettings(db) {
  return Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, getSetting(db, k)]));
}
