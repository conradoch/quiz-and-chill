import { gameConfig, questions } from "./questions.js";

export function publicQuestion(index, questionBank = questions) {
  const q = questionBank[index];
  const isFinal = index === questionBank.length - 1;
  const round = isFinal ? 3 : Math.floor(index / 3);
  return {
    id: q.id, category: q.category, prompt: q.prompt, options: q.options,
    number: index + 1, total: questionBank.length,
    roundLabel: isFinal ? "Final question" : gameConfig.rounds[round].label,
    value: isFinal ? gameConfig.finalValue : gameConfig.rounds[round].value,
    durationMs: gameConfig.questionTimeMs,
  };
}

export function scoreAnswer(questionIndex, answerIndex, elapsedMs, questionBank = questions) {
  const q = questionBank[questionIndex];
  if (!q || answerIndex !== q.correctIndex) return 0;
  const value = publicQuestion(questionIndex, questionBank).value;
  const speed = Math.max(0, 1 - elapsedMs / gameConfig.questionTimeMs);
  return Math.round(value * (0.5 + speed * 0.5));
}

export function answerResult(questionIndex, selectedIndex, pointsEarned = 0, questionBank = questions) {
  const q = questionBank[questionIndex];
  const validSelection = Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < q.options.length;
  return {
    selectedIndex: validSelection ? selectedIndex : null,
    selectedText: validSelection ? q.options[selectedIndex] : null,
    correctIndex: q.correctIndex,
    correctText: q.options[q.correctIndex],
    isCorrect: validSelection && selectedIndex === q.correctIndex,
    pointsEarned,
  };
}
