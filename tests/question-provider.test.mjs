import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_OPTIONS, decodeHtml, loadQuestions } from "../game/question-provider.js";
import { questions as localQuestions } from "../game/questions.js";

function apiQuestion(difficulty, index, category = "science") {
  return {
    id: `question-${difficulty}-${index}`,
    type: "text_choice",
    difficulty,
    category,
    isNiche: false,
    regions: [],
    tags: [],
    question: { text: `Question ${difficulty} ${index}: 2 &lt; 3?` },
    correctAnswer: `Correct &amp; ${index}`,
    incorrectAnswers: [`Wrong A ${index}`, `Wrong B ${index}`, `Wrong C ${index}`],
  };
}

test("decodes named and numeric HTML entities", () => {
  assert.equal(decodeHtml("Tom &amp; Jerry &#39;night&#39; &#x2605;"), "Tom & Jerry 'night' ★");
});

test("decodes common mathematical entities instead of rendering raw HTML", () => {
  assert.equal(decodeHtml("4&pi;r^2"), "4πr^2");
});

test("builds two easy rounds, one medium round, and one hard final from a mocked API", async () => {
  const results = [
    ...Array.from({ length: 6 }, (_, i) => apiQuestion("easy", i)),
    ...Array.from({ length: 3 }, (_, i) => apiQuestion("medium", i)),
    apiQuestion("hard", 0),
  ];
  const fetchImpl = async () => ({ ok: true, json: async () => results });
  const loaded = await loadQuestions({ fetchImpl, rng: () => 0.5 });
  assert.equal(loaded.source, "the-trivia-api");
  assert.equal(loaded.questions.length, 10);
  assert.match(loaded.questions[0].id, /^trivia-api-/);
  assert.match(loaded.questions[5].id, /^trivia-api-/);
  assert.match(loaded.questions[6].id, /^trivia-api-/);
  assert.match(loaded.questions[8].id, /^trivia-api-/);
  assert.match(loaded.questions[9].id, /^trivia-api-/);
  assert.equal(loaded.questions[0].category, "Science");
  assert.equal(loaded.questions[0].options[loaded.questions[0].correctIndex].startsWith("Correct &"), true);
});

test("all-categories requests omit the category filter", async () => {
  let requestedUrl;
  const results = [
    ...Array.from({ length: 6 }, (_, i) => apiQuestion("easy", i)),
    ...Array.from({ length: 3 }, (_, i) => apiQuestion("medium", i)),
    apiQuestion("hard", 0),
  ];
  await loadQuestions({ fetchImpl: async url => {
    requestedUrl = url;
    return { ok: true, json: async () => results };
  }, category: "all" });
  assert.equal(new URL(requestedUrl).searchParams.has("categories"), false);
  assert.equal(new URL(requestedUrl).searchParams.get("contentFilter"), "family");
});

test("all-categories deliberately spreads questions across available topics", async () => {
  const categories = ["science", "history", "geography", "music"];
  const results = [
    ...Array.from({ length: 8 }, (_, i) => apiQuestion("easy", i, categories[i % 4])),
    ...Array.from({ length: 8 }, (_, i) => apiQuestion("medium", i, categories[i % 4])),
    ...Array.from({ length: 8 }, (_, i) => apiQuestion("hard", i, categories[i % 4])),
  ];
  const loaded = await loadQuestions({
    fetchImpl: async () => ({ ok: true, json: async () => results }),
    category: "all",
    rng: () => 0.5,
  });
  assert.equal(new Set(loaded.questions.map(question => question.category)).size, 4);
});

test("all-categories prefers broad topics for the first two easy rounds", async () => {
  const broadCategories = ["general_knowledge", "science", "geography", "history"];
  const results = [
    ...Array.from({ length: 8 }, (_, i) => apiQuestion("easy", i, broadCategories[i % broadCategories.length])),
    ...Array.from({ length: 8 }, (_, i) => ({ ...apiQuestion("easy", i + 20, "general_knowledge"), isNiche: true })),
    ...Array.from({ length: 3 }, (_, i) => apiQuestion("medium", i, "film_and_tv")),
    apiQuestion("hard", 0, "film_and_tv"),
  ];
  const loaded = await loadQuestions({
    fetchImpl: async () => ({ ok: true, json: async () => results }),
    category: "all",
    rng: () => 0.5,
  });
  assert.equal(loaded.questions.slice(0, 6).some(question => question.category === "Film & TV"), false);
  assert.equal(loaded.questions.slice(6).some(question => question.category === "Film & TV"), true);
});

test("all-categories rejects niche or formula-based questions from early rounds", async () => {
  const niche = {
    ...apiQuestion("easy", 20, "science"),
    question: { text: "What is the equation for the area of a sphere?" },
    correctAnswer: "4&pi;r^2",
  };
  const results = [
    niche,
    ...Array.from({ length: 6 }, (_, i) => apiQuestion("easy", i, "general_knowledge")),
    ...Array.from({ length: 3 }, (_, i) => apiQuestion("medium", i)),
    apiQuestion("hard", 0),
  ];
  const loaded = await loadQuestions({
    fetchImpl: async () => ({ ok: true, json: async () => results }),
    category: "all",
    rng: () => 0.5,
  });
  assert.equal(loaded.source, "the-trivia-api");
  assert.equal(loaded.questions.slice(0, 6).some(question => question.prompt.includes("area of a sphere")), false);
});

test("a single selected category is sent to The Trivia API", async () => {
  let requestedUrl;
  const results = [
    ...Array.from({ length: 6 }, (_, i) => apiQuestion("easy", i)),
    ...Array.from({ length: 3 }, (_, i) => apiQuestion("medium", i)),
    apiQuestion("hard", 0),
  ];
  await loadQuestions({ fetchImpl: async url => {
    requestedUrl = url;
    return { ok: true, json: async () => results };
  }, category: "science" });
  assert.equal(new URL(requestedUrl).searchParams.get("categories"), "science");
});

test("every lobby category maps to the intended The Trivia API filter", async () => {
  const mappings = [
    ["all", null, null],
    ["science", "science", null],
    ["history", "history", null],
    ["geography", "geography", null],
    ["entertainment", "film_and_tv,arts_and_literature,society_and_culture", null],
    ["movies", "film_and_tv", null],
    ["music", "music", null],
    ["sports", "sport_and_leisure", null],
    ["general-knowledge", "general_knowledge", null],
  ];
  const results = [
    ...Array.from({ length: 6 }, (_, i) => apiQuestion("easy", i)),
    ...Array.from({ length: 3 }, (_, i) => apiQuestion("medium", i)),
    apiQuestion("hard", 0),
  ];
  assert.deepEqual(CATEGORY_OPTIONS.map(option => option.key), mappings.map(([key]) => key));
  for (const [category, expectedCategories, expectedTags] of mappings) {
    let requestedUrl;
    await loadQuestions({
      category,
      fetchImpl: async url => {
        requestedUrl = url;
        return { ok: true, json: async () => results };
      },
    });
    const params = new URL(requestedUrl).searchParams;
    assert.equal(params.get("categories"), expectedCategories, `${category} categories`);
    assert.equal(params.get("tags"), expectedTags, `${category} tags`);
    assert.equal(params.get("contentFilter"), "family", `${category} family filter`);
  }
});

test("uses the complete local bank when the API fails", async () => {
  const fetchImpl = async () => { throw new Error("offline"); };
  const loaded = await loadQuestions({ fetchImpl });
  assert.equal(loaded.source, "local");
  assert.equal(loaded.questions, localQuestions);
  assert.equal(loaded.questions.length, 10);
});

test("uses the local bank when a difficulty bucket is insufficient", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => [apiQuestion("easy", 0)],
  });
  const loaded = await loadQuestions({ fetchImpl });
  assert.equal(loaded.source, "local");
});
