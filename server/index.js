try { process.loadEnvFile(); } catch { /* no .env file, use defaults */ }
import { createDb, seed } from './db.js';
import { createApp } from './app.js';
const db = createDb(); seed(db);
const port = process.env.PORT || 3001;
createApp(db).listen(port, () => console.log(`API listening on http://localhost:${port}`));
