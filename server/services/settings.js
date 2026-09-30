import { HttpError, PRIORITIES } from './incidents.js';
import { getAllSettings, setSetting } from './settingsStore.js';
export { getAllSettings as getSettings };

export function updateSettings(db, body = {}) {
  const changes = {};
  if (body.technician_name !== undefined) {
    const n = typeof body.technician_name === 'string' ? body.technician_name.trim() : '';
    if (!n) throw new HttpError(400, 'Name is required');
    if (n.length > 60) throw new HttpError(400, 'Name must be 60 characters or fewer');
    changes.technician_name = n;
  }
  if (body.default_priority !== undefined) {
    if (!PRIORITIES.includes(body.default_priority)) throw new HttpError(400, `Default priority must be one of: ${PRIORITIES.join(', ')}`);
    changes.default_priority = body.default_priority;
  }
  for (const [k, v] of Object.entries(changes)) setSetting(db, k, v);
  return getAllSettings(db);
}
