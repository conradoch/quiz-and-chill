import {
  footballQuestionCount,
  footballQuestionStats,
  validateFootballQuestionBank,
} from "../game/football-questions.js";

const errors = validateFootballQuestionBank();

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
