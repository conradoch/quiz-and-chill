import {
  footballQuestionCount,
  footballQuestionStats,
  validateFootballQuestionBank,
} from "../game/football-questions.js";
import { buildGeneratedFootballModule } from "./generate-football.mjs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const errors = validateFootballQuestionBank();
const generatedPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "game", "football-questions.generated.js");
const expectedGenerated = await buildGeneratedFootballModule();
const currentGenerated = await readFile(generatedPath, "utf8").catch(() => "");
if (currentGenerated !== expectedGenerated) errors.unshift("generated bank is stale; run npm run football:generate");

if (errors.length) {
  console.error(`Football question bank failed validation with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Football question bank valid: ${footballQuestionCount} bilingual questions.`);
  console.log(
    `Easy ${footballQuestionStats.easy} · Medium ${footballQuestionStats.medium} · Hard ${footballQuestionStats.hard} · Niche final ${footballQuestionStats.nicheFinal}`,
  );
}
