import { questions as localQuestions } from "./questions.js";

const API_URL = "https://the-trivia-api.com/v2/questions";
const SESSION_URL = "https://the-trivia-api.com/v2/session";
// Keep the opening two rounds welcoming and broadly playable:
// rounds 1–2 are easy, round 3 is medium, and only the final is hard.
const REQUIRED = { easy: 6, medium: 3, hard: 1 };
const BROAD_OPENING_CATEGORIES = new Set([
  "General Knowledge",
  "Science",
  "Geography",
  "History",
  "Film & TV",
  "Music",
  "Sports",
]);
const NICHE_OPENING_CATEGORIES = new Set([
  "Science: Mathematics",
  "Science: Computers",
  "Science: Gadgets",
  "Entertainment: Video Games",
  "Entertainment: Japanese Anime & Manga",
  "Entertainment: Comics",
  "Entertainment: Board Games",
]);

export const CATEGORY_OPTIONS = [
  { key: "all", label: "All categories" },
  { key: "science", label: "Science", apiCategories: "science" },
  { key: "history", label: "History", apiCategories: "history" },
  { key: "geography", label: "Geography", apiCategories: "geography" },
  { key: "entertainment", label: "Entertainment", apiCategories: "film_and_tv,arts_and_literature,society_and_culture" },
  { key: "movies", label: "Movies", apiCategories: "film_and_tv" },
  { key: "music", label: "Music", apiCategories: "music" },
  { key: "sports", label: "Sports", apiCategories: "sport_and_leisure" },
  { key: "general-knowledge", label: "General Knowledge", apiCategories: "general_knowledge" },
];

const CATEGORY_LABELS = {
  music: "Music", sport_and_leisure: "Sports", film_and_tv: "Film & TV",
  arts_and_literature: "Arts & Literature", history: "History",
  society_and_culture: "Society & Culture", science: "Science",
  geography: "Geography", food_and_drink: "Food & Drink",
  general_knowledge: "General Knowledge",
};

const namedEntities = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
  pi: "π", times: "×", divide: "÷", minus: "−", plusmn: "±", sup2: "²", sup3: "³",
  eacute: "é", Eacute: "É", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
};

export class RecentQuestionHistory {
  constructor(maxSize = 200) {
    this.maxSize = maxSize;
    this.entries = [];
  }

  has(item) {
    const candidate = historyEntry(item);
    return this.entries.some(entry =>
      (candidate.id && entry.id === candidate.id) ||
      entry.fingerprint === candidate.fingerprint ||
      similarTokens(entry.tokens, candidate.tokens),
    );
  }

  remember(items) {
    for (const item of items) {
      if (!this.has(item)) this.entries.push(historyEntry(item));
    }
    if (this.entries.length > this.maxSize) {
      this.entries.splice(0, this.entries.length - this.maxSize);
    }
  }
}

export const recentQuestionHistory = new RecentQuestionHistory();

export function decodeHtml(value) {
  return String(value).replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] !== "#") return namedEntities[entity] ?? match;
    const radix = entity[1]?.toLowerCase() === "x" ? 16 : 10;
    const digits = radix === 16 ? entity.slice(2) : entity.slice(1);
    const point = Number.parseInt(digits, radix);
    return Number.isFinite(point) ? String.fromCodePoint(point) : match;
  });
}

export function shuffle(items, rng = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function normalizeQuestion(item, index, rng) {
  const correct = decodeHtml(item.correctAnswer);
  const options = shuffle(
    [...item.incorrectAnswers.map(decodeHtml), correct],
    rng,
  );
  return {
    id: `trivia-api-${item.id || `${item.difficulty}-${index}-${Math.abs(hash(item.question?.text))}`}`,
    category: CATEGORY_LABELS[item.category] ?? decodeHtml(item.category),
    prompt: decodeHtml(item.question.text),
    options,
    correctIndex: options.indexOf(correct),
  };
}

export async function loadQuestions({
  fetchImpl = fetch,
  rng = Math.random,
  timeoutMs = 6000,
  category = "all",
  history = null,
  apiKey = "",
  sessionId = null,
  allowLocalFallback = true,
} = {}) {
  try {
    let activeSessionId = cleanSessionId(sessionId);
    if (apiKey && !activeSessionId) {
      activeSessionId = await createSession({ fetchImpl, apiKey, timeoutMs });
    }
    const selectedCategory = CATEGORY_OPTIONS.find(option => option.key === category) ?? CATEGORY_OPTIONS[0];
    const query = new URLSearchParams({ limit: "50", contentFilter: "family" });
    if (selectedCategory.apiCategories) query.set("categories", selectedCategory.apiCategories);
    if (selectedCategory.apiTags) query.set("tags", selectedCategory.apiTags);
    const buckets = { easy: [], medium: [], hard: [] };
    const candidateIds = new Set();
    let replacedExpiredSession = false;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const openingPool = selectedCategory.key === "all"
        ? preferBroadOpeningQuestions(buckets.easy, REQUIRED.easy)
        : buckets.easy;
      const missingDifficulties = Object.entries(REQUIRED)
        .filter(([difficulty, amount]) =>
          difficulty === "easy"
            ? openingPool.length < amount
            : buckets[difficulty].length < amount,
        )
        .map(([difficulty]) => difficulty);
      if (!missingDifficulties.length) break;

      // The public endpoint can be cached upstream. A unique request URL plus
      // no-cache headers ensures retries actually draw a fresh candidate pool.
      // Targeting only missing difficulties prevents a mixed 50-question batch
      // from repeatedly starving the game of enough easy opening questions.
      const requestQuery = new URLSearchParams(query);
      requestQuery.set("difficulties", missingDifficulties.join(","));
      requestQuery.set("_fresh", `${Date.now()}-${attempt}-${Math.floor(rng() * 1e9)}`);
      const questionUrl = apiKey && activeSessionId
        ? `${SESSION_URL}/${encodeURIComponent(activeSessionId)}/preview-questions`
        : API_URL;
      const response = await fetchImpl(`${questionUrl}?${requestQuery}`, {
        cache: "no-store",
        headers: { ...apiHeaders(apiKey), "cache-control": "no-cache, no-store" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (apiKey && activeSessionId && !replacedExpiredSession && [400, 401, 403, 404].includes(response.status)) {
        activeSessionId = await createSession({ fetchImpl, apiKey, timeoutMs });
        replacedExpiredSession = true;
        attempt -= 1;
        continue;
      }
      if (!response.ok) throw new Error(`The Trivia API returned HTTP ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error("The Trivia API returned an invalid response");
      for (const item of payload) {
        const candidateId = item.id || `${item.difficulty}:${item.question?.text}`;
        if (
          !candidateIds.has(candidateId) &&
          !history?.has(item) &&
          item.type === "text_choice" &&
          item.isNiche !== true &&
          buckets[item.difficulty] &&
          item.question?.text &&
          Array.isArray(item.incorrectAnswers) &&
          item.incorrectAnswers.length === 3
        ) {
          candidateIds.add(candidateId);
          buckets[item.difficulty].push(item);
        }
      }
    }
    for (const [difficulty, amount] of Object.entries(REQUIRED)) {
      if (buckets[difficulty].length < amount) {
        throw new Error(`Not enough ${difficulty} questions`);
      }
    }
    const categoryUsage = new Map();
    const take = (items, amount) => selectedCategory.key === "all"
      ? takeDiverse(items, amount, categoryUsage, rng)
      : shuffle(items, rng).slice(0, amount);
    const easyPool = selectedCategory.key === "all"
      ? preferBroadOpeningQuestions(buckets.easy, REQUIRED.easy)
      : buckets.easy;
    if (easyPool.length < REQUIRED.easy) {
      throw new Error("Not enough party-friendly easy questions");
    }
    const staged = [
      ...take(easyPool, REQUIRED.easy),
      ...take(buckets.medium, REQUIRED.medium),
      ...take(buckets.hard, REQUIRED.hard),
    ];
    if (apiKey && activeSessionId) {
      await markSessionQuestions({
        fetchImpl,
        apiKey,
        sessionId: activeSessionId,
        questionIds: staged.map(item => item.id).filter(Boolean),
        timeoutMs,
      });
    }
    history?.remember(staged);
    return {
      questions: staged.map((item, index) => normalizeQuestion(item, index, rng)),
      source: apiKey ? "the-trivia-api-session" : "the-trivia-api",
      sessionId: activeSessionId,
    };
  } catch (error) {
    if (!allowLocalFallback) {
      console.error(`Question service unavailable: ${error.message}`);
      return {
        questions: [],
        source: "unavailable",
        sessionId: cleanSessionId(sessionId),
      };
    }
    console.warn(`Using local question fallback: ${error.message}`);
    return { questions: localQuestions, source: "local", sessionId: cleanSessionId(sessionId) };
  }
}

async function createSession({ fetchImpl, apiKey, timeoutMs }) {
  const response = await fetchImpl(SESSION_URL, {
    method: "POST",
    headers: apiHeaders(apiKey),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`The Trivia API session returned HTTP ${response.status}`);
  const payload = await response.json();
  const sessionId = cleanSessionId(payload?.id);
  if (!sessionId) throw new Error("The Trivia API returned an invalid session");
  return sessionId;
}

async function markSessionQuestions({ fetchImpl, apiKey, sessionId, questionIds, timeoutMs }) {
  const response = await fetchImpl(`${SESSION_URL}/${encodeURIComponent(sessionId)}/questions`, {
    method: "POST",
    headers: { ...apiHeaders(apiKey), "content-type": "application/json" },
    body: JSON.stringify({ questionIds }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`The Trivia API could not save used questions (HTTP ${response.status})`);
}

function apiHeaders(apiKey) {
  return apiKey
    ? { accept: "application/json", "x-api-key": apiKey }
    : { accept: "application/json" };
}

function cleanSessionId(value) {
  const candidate = String(value ?? "").trim();
  return /^[a-zA-Z0-9_-]{6,160}$/.test(candidate) ? candidate : null;
}

function historyEntry(item) {
  const text = decodeHtml(item.question?.text);
  const fingerprint = text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const stopWords = new Set(["a", "an", "and", "did", "does", "for", "in", "is", "of", "on", "the", "to", "was", "what", "which", "who"]);
  const tokens = new Set(fingerprint.split(" ").filter(token => token && !stopWords.has(token)).map(stemToken));
  return { id: item.id ? String(item.id) : null, fingerprint, tokens };
}

function stemToken(token) {
  if (token.length > 5) return token.replace(/(?:ing|ed|er|es|s)$/u, "");
  return token;
}

function similarTokens(left, right) {
  if (left.size < 3 || right.size < 3) return false;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / Math.max(left.size, right.size) >= 0.85;
}

export function preferBroadOpeningQuestions(items, amount) {
  const friendly = items.filter(isPartyFriendlyOpeningQuestion);
  const broad = friendly.filter(item => BROAD_OPENING_CATEGORIES.has(decodeHtml(item.category)));
  return broad.length >= amount ? broad : friendly;
}

export function isPartyFriendlyOpeningQuestion(item) {
  const category = CATEGORY_LABELS[item.category] ?? decodeHtml(item.category);
  const prompt = decodeHtml(item.question?.text);
  const answers = [item.correctAnswer, ...(item.incorrectAnswers ?? [])].map(decodeHtml);
  if (item.isNiche === true) return false;
  if (NICHE_OPENING_CATEGORIES.has(category)) return false;
  if (prompt.length > 105) return false;
  if (/\b(?:equation|formula|theorem|algorithm|co-op|franchise)\b/i.test(prompt)) return false;
  if (answers.some(answer => /(?:\^|\\frac|&[a-z\d#]+;)/i.test(answer))) return false;
  return true;
}

export function takeDiverse(items, amount, usage = new Map(), rng = Math.random) {
  const pool = shuffle(items, rng);
  const selected = [];
  while (selected.length < amount && pool.length) {
    let bestIndex = 0;
    let bestUsage = usage.get(pool[0].category) ?? 0;
    for (let index = 1; index < pool.length; index += 1) {
      const itemUsage = usage.get(pool[index].category) ?? 0;
      if (itemUsage < bestUsage) {
        bestIndex = index;
        bestUsage = itemUsage;
      }
    }
    const [choice] = pool.splice(bestIndex, 1);
    selected.push(choice);
    usage.set(choice.category, (usage.get(choice.category) ?? 0) + 1);
  }
  return selected;
}

function hash(value) {
  let result = 0;
  for (const char of String(value)) result = ((result << 5) - result + char.charCodeAt(0)) | 0;
  return result;
}
