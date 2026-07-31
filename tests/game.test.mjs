import test from "node:test";
import assert from "node:assert/strict";
import { answerResult, scoreAnswer, publicQuestion } from "../game/engine.js";
import { gameConfig } from "../game/questions.js";

test("incorrect answers earn no points", () => assert.equal(scoreAnswer(0, 0, 100), 0));
test("a fast correct answer earns more", () => assert.ok(scoreAnswer(0, 1, 100) > scoreAnswer(0, 1, 14000)));
test("the tenth question is the higher-value final", () => {
  assert.equal(publicQuestion(9).roundLabel, "Final question");
  assert.ok(publicQuestion(9).value > publicQuestion(8).value);
  assert.equal(publicQuestion(9).value, 2500);
  const previousQuestionsMaximum = gameConfig.rounds.reduce((total, round) => total + round.value * 3, 0);
  assert.ok(gameConfig.finalValue / (previousQuestionsMaximum + gameConfig.finalValue) < 0.2);
});
test("a correct selection includes its option text", () => {
  const result = answerResult(0, 1, 900);
  assert.equal(result.selectedText, "Mars");
  assert.equal(result.correctText, "Mars");
  assert.equal(result.isCorrect, true);
});
test("an incorrect selection still includes its option text", () => {
  const result = answerResult(0, 0, 0);
  assert.equal(result.selectedText, "Venus");
  assert.equal(result.correctText, "Mars");
  assert.equal(result.isCorrect, false);
});
test("all four answer indexes preserve their selected option text", () => {
  const expected = ["Venus", "Mars", "Jupiter", "Mercury"];
  for (let selectedIndex = 0; selectedIndex < expected.length; selectedIndex += 1) {
    const result = answerResult(0, selectedIndex, 0);
    assert.equal(result.selectedIndex, selectedIndex);
    assert.equal(result.selectedText, expected[selectedIndex]);
  }
});
test("round transitions and answer reveals use the configured reading time", () => {
  assert.equal(gameConfig.transitionTimeMs, 10000);
  assert.equal(gameConfig.revealTimeMs, 7000);
});
