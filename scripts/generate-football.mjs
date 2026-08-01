import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const winnerPath = path.join(root, "data", "football", "historical-winners.json");
const countsPath = path.join(root, "data", "football", "title-counts.json");
const outputPath = path.join(root, "game", "football-questions.generated.js");

function stableNumber(value) {
  let hash = 2166136261;
  for (const character of value.normalize("NFKC")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function localizedName(fact) {
  return { en: fact.winner, es: fact.winnerEs || fact.winner };
}

function orderedDistractors(items, answer, key) {
  return items
    .filter(item => item.en !== answer.en)
    .sort((left, right) => stableNumber(`${key}:${left.en}`) - stableNumber(`${key}:${right.en}`))
    .slice(0, 3);
}

function eraDistractors(collection, fact, answer, key) {
  const factIndex = collection.facts.indexOf(fact);
  const sameEra = collection.facts
    .map((candidate, index) => ({ candidate, distance: Math.abs(index - factIndex), index }))
    .filter(({ candidate }) => candidate.winner !== fact.winner)
    .sort((left, right) => left.distance - right.distance || stableNumber(`${key}:${left.index}`) - stableNumber(`${key}:${right.index}`));
  const localized = [];
  const seen = new Set();
  for (const { candidate } of sameEra) {
    if (seen.has(candidate.winner)) continue;
    seen.add(candidate.winner);
    localized.push(localizedName(candidate));
  }
  return orderedDistractors(localized.slice(0, 8), answer, key);
}

function placeAnswer(answer, distractors, key) {
  const correctIndex = stableNumber(key) % 4;
  const options = [...distractors];
  options.splice(correctIndex, 0, answer);
  return { options, correctIndex };
}

function validateSourceDocument(document, filename) {
  assert.equal(document.schemaVersion, 1, `${filename}: unsupported schemaVersion`);
  assert.match(document.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${filename}: invalid verifiedAt`);
  assert.ok(Array.isArray(document.collections) && document.collections.length, `${filename}: collections required`);
  for (const collection of document.collections) {
    assert.ok(collection.id && collection.label?.en && collection.label?.es, `${filename}: collection identity incomplete`);
    assert.match(collection.source?.url || "", /^https:\/\//, `${collection.id}: official source URL required`);
    assert.ok(collection.source?.name, `${collection.id}: source name required`);
    assert.ok(Array.isArray(collection.facts) && collection.facts.length >= 4, `${collection.id}: at least four facts required`);
  }
}

function winnerRows(document) {
  const rows = [];
  for (const collection of document.collections) {
    for (const fact of collection.facts.filter(item => item.generate)) {
      assert.ok(["medium", "hard"].includes(fact.difficulty), `${collection.id}/${fact.year}: generated history must be medium or hard`);
      const key = `${collection.id}:${fact.year}:${fact.winner}`;
      const answer = localizedName(fact);
      // Nearby seasons keep the options plausible: recent Ballon d'Or winners
      // face contemporary stars, and cup winners face clubs from the same era.
      const placed = placeAnswer(answer, eraDistractors(collection, fact, answer, key), key);
      assert.equal(placed.options.length, 4, `${key}: needs four unique possible winners`);

      let promptEn;
      let promptEs;
      if (collection.questionType === "season-winner") {
        const startsBeforeChampionsEra = collection.id === "champions-league" && Number.parseInt(fact.year, 10) < 1992;
        const label = startsBeforeChampionsEra
          ? { en: "European Cup", es: "Copa de Europa" }
          : collection.label;
        promptEn = `Which club won the ${fact.year} ${label.en}?`;
        promptEs = `¿Qué club ganó la ${label.es} ${fact.year}?`;
      } else if (collection.subject === "person") {
        promptEn = `Who won the ${fact.year} ${collection.label.en}?`;
        promptEs = `¿Quién ganó el ${collection.label.es} de ${fact.year}?`;
      } else {
        promptEn = `Which ${collection.subject} won the ${fact.year} ${collection.label.en}?`;
        const subjectEs = collection.subject === "country" ? "país" : "club";
        promptEs = `¿Qué ${subjectEs} ganó la ${collection.label.es} ${fact.year}?`;
      }
      rows.push([
        fact.difficulty,
        collection.label.en,
        collection.label.es,
        promptEn,
        promptEs,
        placed.options.map(option => option.en),
        placed.options.map(option => option.es),
        placed.correctIndex,
      ]);
    }
  }
  return rows;
}

function numericDistractors(count, key) {
  const candidates = [count - 1, count + 1, count + 2, count - 2, count + 3, count - 3, count + 4]
    .filter(value => value >= 0 && value !== count);
  return [...new Set(candidates)]
    .sort((left, right) => stableNumber(`${key}:${left}`) - stableNumber(`${key}:${right}`))
    .slice(0, 3)
    .map(value => ({ en: String(value), es: String(value) }));
}

function titleCountRows(document) {
  const rows = [];
  for (const collection of document.collections) {
    for (const fact of collection.facts.filter(item => item.generate)) {
      assert.ok(["medium", "hard"].includes(fact.difficulty), `${collection.id}/${fact.name}: invalid difficulty`);
      const key = `${collection.id}:${fact.name}:${fact.count}`;
      const answer = { en: String(fact.count), es: String(fact.count) };
      const placed = placeAnswer(answer, numericDistractors(fact.count, key), key);
      assert.equal(placed.options.length, 4, `${key}: needs four count options`);
      rows.push([
        fact.difficulty,
        collection.category.en,
        collection.category.es,
        `As of ${collection.asOf.en}, how many ${collection.label.en} titles had ${fact.name} won?`,
        `Hasta ${collection.asOf.es}, ¿cuántos títulos de ${collection.label.es} había ganado ${fact.name}?`,
        placed.options.map(option => option.en),
        placed.options.map(option => option.es),
        placed.correctIndex,
      ]);
    }
  }
  return rows;
}

export async function buildGeneratedFootballModule() {
  const [winnerDocument, countsDocument] = await Promise.all([
    readFile(winnerPath, "utf8").then(JSON.parse),
    readFile(countsPath, "utf8").then(JSON.parse),
  ]);
  validateSourceDocument(winnerDocument, path.basename(winnerPath));
  validateSourceDocument(countsDocument, path.basename(countsPath));
  const rows = [...winnerRows(winnerDocument), ...titleCountRows(countsDocument)];
  const sources = [...winnerDocument.collections, ...countsDocument.collections].map(collection => ({
    id: collection.id,
    name: collection.source.name,
    url: collection.source.url,
    verifiedAt: collection.verifiedAt || (winnerDocument.collections.includes(collection) ? winnerDocument.verifiedAt : countsDocument.verifiedAt),
  }));
  return `// Generated by npm run football:generate. Do not edit by hand.\n`
    + `// Source facts live in data/football/*.json and are reviewed before generation.\n\n`
    + `export const generatedFootballSources = Object.freeze(${JSON.stringify(sources, null, 2)});\n\n`
    + `export const generatedFootballQuestionRows = Object.freeze(${JSON.stringify(rows, null, 2)});\n`;
}

async function main() {
  const expected = await buildGeneratedFootballModule();
  if (process.argv.includes("--check")) {
    const current = await readFile(outputPath, "utf8").catch(() => "");
    if (current !== expected) {
      console.error("Generated football bank is stale. Run npm run football:generate.");
      process.exitCode = 1;
      return;
    }
    console.log("Generated football bank is current.");
    return;
  }
  await writeFile(outputPath, expected, "utf8");
  console.log(`Generated ${outputPath}.`);
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) await main();
