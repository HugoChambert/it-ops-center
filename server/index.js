try { process.loadEnvFile(); } catch { /* no .env file, use defaults */ }
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb, seed } from './db.js';
import { createApp } from './app.js';

const db = createDb(); seed(db);
const port = process.env.PORT || 3001;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const staticDir = process.env.NODE_ENV === 'production' ? distDir : null;

createApp(db, { staticDir }).listen(port, () =>
  console.log(`API listening on http://localhost:${port}`)
);

const resetHours = Number(process.env.DEMO_RESET_HOURS);
if (resetHours > 0) {
  const resetInterval = resetHours * 3600e3;
  setInterval(() => {
    console.log('[demo] resetting data…');
    db.exec(`DELETE FROM incident_reports; DELETE FROM incident_events; DELETE FROM article_incidents; DELETE FROM articles; DELETE FROM incidents; DELETE FROM systems; DELETE FROM settings;`);
    seed(db);
    console.log('[demo] data reset complete');
  }, resetInterval);
  console.log(`[demo] data will reset every ${resetHours}h`);
}
