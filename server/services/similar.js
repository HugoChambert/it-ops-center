// Pure text-similarity service. No external dependencies.
//
// Algorithm: weighted shared-keyword scoring.
//   - Tokenise: lowercase, split on non-alphanumeric, drop ≤2-char tokens and stop words.
//   - Score: for each candidate, count query-token hits in the candidate's title (weight 2)
//     and in the candidate's body fields (weight 1). Body = description + resolution
//     for incidents; symptoms + causes + diagnostic_steps + resolution for articles.
//   - Rank: sort descending by score, drop score=0, return top 3.
//   - matchedWords: sorted unique tokens that contributed to the score (max 8).

const STOP = new Set([
  'the','and','for','are','but','not','you','all','can','her','was','one',
  'our','out','day','get','has','him','his','how','its','let','may','new',
  'now','old','see','two','who','did','man','had','him','his','way','use',
  'will','with','that','this','from','have','been','were','they','their',
  'there','when','what','which','would','about','after','also','each',
  'into','like','more','some','than','then','them','time','very','well',
  'just','over','back','only','come','could','make','most','other','over',
  'same','such','take','than','them','then','they','this','through','too',
  // domain stop words — too generic to be meaningful for similarity
  'user','users','cannot','could','error','issue','issues','occurred',
  'please','report','reports','failed','failure','failures',
  'connect','connected','connection',
]);

/**
 * Tokenise a string into a Set of meaningful lowercase keywords.
 * Exported for unit testing.
 * @param {string} text
 * @returns {Set<string>}
 */
export function tokenise(text) {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOP.has(t))
  );
}

/**
 * Score a single candidate against the query's token set.
 * Exported for unit testing.
 *
 * @param {Set<string>} qTokens  - tokens from the query incident
 * @param {string} title         - candidate title
 * @param {string} body          - candidate body text (description + resolution joined)
 * @param {string} extra         - additional body text (articles only: symptoms, causes, steps)
 * @returns {{ score: number, matchedWords: string[] }}
 */
export function scorePair(qTokens, title, body, extra) {
  const titleTokens = tokenise(title);
  const bodyTokens = tokenise((body || '') + ' ' + (extra || ''));
  const matched = new Set();
  let score = 0;
  for (const t of qTokens) {
    if (titleTokens.has(t)) { score += 2; matched.add(t); }
    else if (bodyTokens.has(t)) { score += 1; matched.add(t); }
  }
  const matchedWords = [...matched].sort().slice(0, 8);
  return { score, matchedWords };
}

const DISCLAIMER = 'Suggestions based on past incidents, not a confirmed diagnosis.';

/**
 * Find up to 3 similar resolved/closed incidents and up to 3 similar articles
 * for a given incident.
 *
 * @param {object} db       - DatabaseSync instance
 * @param {object} incident - the query incident row (must have id, title, description)
 * @returns {{ disclaimer: string, incidents: object[], articles: object[] }}
 */
export function getSimilar(db, incident) {
  const qTokens = tokenise(
    (incident.title || '') + ' ' + (incident.description || '') + ' ' + (incident.resolution || '')
  );

  // --- similar incidents ---
  const incRows = db.prepare(
    `SELECT id, title, description, resolution
     FROM incidents
     WHERE status IN ('Resolved','Closed') AND id != ?`
  ).all(incident.id);

  const scoredIncidents = incRows
    .map((r) => {
      const { score, matchedWords } = scorePair(qTokens, r.title, (r.description || '') + ' ' + (r.resolution || ''), '');
      return { id: r.id, title: r.title, resolution: r.resolution || '', matchedWords, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // --- similar articles ---
  const artRows = db.prepare(
    `SELECT id, title, symptoms, causes, diagnostic_steps, resolution FROM articles`
  ).all();

  const scoredArticles = artRows
    .map((r) => {
      const body = (r.resolution || '');
      const extra = [r.symptoms, r.causes, r.diagnostic_steps].filter(Boolean).join(' ');
      const { score, matchedWords } = scorePair(qTokens, r.title, body, extra);
      return { id: r.id, title: r.title, resolution: r.resolution || '', matchedWords, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return { disclaimer: DISCLAIMER, incidents: scoredIncidents, articles: scoredArticles };
}
