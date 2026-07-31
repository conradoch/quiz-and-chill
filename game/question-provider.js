import { questions as localQuestions } from "./questions.js";

const API_URL = "https://opentdb.com/api.php";
// Keep the opening two rounds welcoming and broadly playable:
// rounds 1–2 are easy, round 3 is medium, and only the final is hard.
const REQUIRED = { easy: 6, medium: 3, hard: 1 };
const BROAD_OPENING_CATEGORIES = new Set([
  "General Knowledge",
  "Science & Nature",
  "Geography",
  "History",
  "Animals",
]);

export const CATEGORY_OPTIONS = [
  { key: "all", label: "All categories", apiId: null },
  { key: "science", label: "Science", apiId: 17 },
  { key: "history", label: "History", apiId: 23 },
  { key: "geography", label: "Geography", apiId: 22 },
  { key: "entertainment", label: "Entertainment", apiId: 14 },
  { key: "movies", label: "Movies", apiId: 11 },
  { key: "music", label: "Music", apiId: 12 },
  { key: "sports", label: "Sports", apiId: 21 },
  { key: "video-games", label: "Video Games", apiId: 15 },
  { key: "general-knowledge", label: "General Knowledge", apiId: 9 },
];

const namedEntities = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
  eacute: "é", Eacute: "É", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
};

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
  const correct = decodeHtml(item.correct_answer);
  const options = shuffle(
    [...item.incorrect_answers.map(decodeHtml), correct],
    rng,
  );
  return {
    id: `opentdb-${item.difficulty}-${index}-${Math.abs(hash(item.question))}`,
    category: decodeHtml(item.category),
    prompt: decodeHtml(item.question),
    options,
    correctIndex: options.indexOf(correct),
  };
}

export async function loadQuestions({
  fetchImpl = fetch,
  rng = Math.random,
  timeoutMs = 6000,
  category = "all",
} = {}) {
  try {
    const selectedCategory = CATEGORY_OPTIONS.find(option => option.key === category) ?? CATEGORY_OPTIONS[0];
    const query = new URLSearchParams({ amount: "50", type: "multiple" });
    if (selectedCategory.apiId !== null) query.set("category", String(selectedCategory.apiId));
    const response = await fetchImpl(`${API_URL}?${query}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`Open Trivia DB returned HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.response_code !== 0 || !Array.isArray(payload.results)) {
      throw new Error(`Open Trivia DB response code ${payload.response_code}`);
    }
    const buckets = { easy: [], medium: [], hard: [] };
    for (const item of payload.results) {
      if (
        item.type === "multiple" &&
        buckets[item.difficulty] &&
        Array.isArray(item.incorrect_answers) &&
        item.incorrect_answers.length === 3
      ) buckets[item.difficulty].push(item);
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
    const staged = [
      ...take(easyPool, REQUIRED.easy),
      ...take(buckets.medium, REQUIRED.medium),
      ...take(buckets.hard, REQUIRED.hard),
    ];
    return {
      questions: staged.map((item, index) => normalizeQuestion(item, index, rng)),
      source: "opentdb",
    };
  } catch (error) {
    console.warn(`Using local question fallback: ${error.message}`);
    return { questions: localQuestions, source: "local" };
  }
}

export function preferBroadOpeningQuestions(items, amount) {
  const broad = items.filter(item => BROAD_OPENING_CATEGORIES.has(decodeHtml(item.category)));
  return broad.length >= amount ? broad : items;
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
