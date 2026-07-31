import test from "node:test";
import assert from "node:assert/strict";
import { decodeHtml, loadQuestions } from "../game/question-provider.js";
import { questions as localQuestions } from "../game/questions.js";

function apiQuestion(difficulty, index, category = "Science &amp; Nature") {
  return {
    type: "multiple",
    difficulty,
    category,
    question: `Question ${difficulty} ${index}: 2 &lt; 3?`,
    correct_answer: `Correct &amp; ${index}`,
    incorrect_answers: [`Wrong A ${index}`, `Wrong B ${index}`, `Wrong C ${index}`],
  };
}

test("decodes named and numeric HTML entities", () => {
  assert.equal(decodeHtml("Tom &amp; Jerry &#39;night&#39; &#x2605;"), "Tom & Jerry 'night' ★");
});

test("builds two easy rounds, one medium round, and one hard final from a mocked API", async () => {
  const results = [
    ...Array.from({ length: 6 }, (_, i) => apiQuestion("easy", i)),
    ...Array.from({ length: 3 }, (_, i) => apiQuestion("medium", i)),
    apiQuestion("hard", 0),
  ];
  const fetchImpl = async () => ({ ok: true, json: async () => ({ response_code: 0, results }) });
  const loaded = await loadQuestions({ fetchImpl, rng: () => 0.5 });
  assert.equal(loaded.source, "opentdb");
  assert.equal(loaded.questions.length, 10);
  assert.match(loaded.questions[0].id, /^opentdb-easy-/);
  assert.match(loaded.questions[5].id, /^opentdb-easy-/);
  assert.match(loaded.questions[6].id, /^opentdb-medium-/);
  assert.match(loaded.questions[8].id, /^opentdb-medium-/);
  assert.match(loaded.questions[9].id, /^opentdb-hard-/);
  assert.equal(loaded.questions[0].category, "Science & Nature");
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
    return { ok: true, json: async () => ({ response_code: 0, results }) };
  }, category: "all" });
  assert.equal(new URL(requestedUrl).searchParams.has("category"), false);
});

test("all-categories deliberately spreads questions across available topics", async () => {
  const categories = ["Science", "History", "Geography", "Music"];
  const results = [
    ...Array.from({ length: 8 }, (_, i) => apiQuestion("easy", i, categories[i % 4])),
    ...Array.from({ length: 8 }, (_, i) => apiQuestion("medium", i, categories[i % 4])),
    ...Array.from({ length: 8 }, (_, i) => apiQuestion("hard", i, categories[i % 4])),
  ];
  const loaded = await loadQuestions({
    fetchImpl: async () => ({ ok: true, json: async () => ({ response_code: 0, results }) }),
    category: "all",
    rng: () => 0.5,
  });
  assert.equal(new Set(loaded.questions.map(question => question.category)).size, 4);
});

test("all-categories prefers broad topics for the first two easy rounds", async () => {
  const broadCategories = ["General Knowledge", "Science &amp; Nature", "Geography", "History"];
  const results = [
    ...Array.from({ length: 8 }, (_, i) => apiQuestion("easy", i, broadCategories[i % broadCategories.length])),
    ...Array.from({ length: 8 }, (_, i) => apiQuestion("easy", i + 20, "Entertainment: Video Games")),
    ...Array.from({ length: 3 }, (_, i) => apiQuestion("medium", i, "Entertainment: Video Games")),
    apiQuestion("hard", 0, "Entertainment: Video Games"),
  ];
  const loaded = await loadQuestions({
    fetchImpl: async () => ({ ok: true, json: async () => ({ response_code: 0, results }) }),
    category: "all",
    rng: () => 0.5,
  });
  assert.equal(loaded.questions.slice(0, 6).some(question => question.category === "Entertainment: Video Games"), false);
  assert.equal(loaded.questions.slice(6).some(question => question.category === "Entertainment: Video Games"), true);
});

test("a single selected category is sent to Open Trivia DB", async () => {
  let requestedUrl;
  const results = [
    ...Array.from({ length: 6 }, (_, i) => apiQuestion("easy", i)),
    ...Array.from({ length: 3 }, (_, i) => apiQuestion("medium", i)),
    apiQuestion("hard", 0),
  ];
  await loadQuestions({ fetchImpl: async url => {
    requestedUrl = url;
    return { ok: true, json: async () => ({ response_code: 0, results }) };
  }, category: "science" });
  assert.equal(new URL(requestedUrl).searchParams.get("category"), "17");
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
    json: async () => ({ response_code: 0, results: [apiQuestion("easy", 0)] }),
  });
  const loaded = await loadQuestions({ fetchImpl });
  assert.equal(loaded.source, "local");
});
