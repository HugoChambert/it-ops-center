import { mockProvider } from './mockProvider.js';
import { HttpError } from '../services/incidents.js';

// Pick a provider from environment variables. Add real providers here later (read AI_API_KEY from env; never hard-code keys).
export function getProvider(env = process.env) {
  const name = env.AI_PROVIDER || 'mock';
  if (name === 'mock') return mockProvider;
  const fail = async () => { throw new HttpError(501, `AI provider "${name}" is not implemented yet. Set AI_PROVIDER=mock.`); };
  return { name, troubleshoot: fail, draftReport: fail };
}
