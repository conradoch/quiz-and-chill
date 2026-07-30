import test from "node:test";
import assert from "node:assert/strict";
import { resetPlayersForReplay } from "../game/session.js";

test("play again resets scores and answer state while preserving players", () => {
  const players = new Map([
    ["host", { id: "host", name: "Host", score: 4200, answered: true, connected: true }],
    ["guest", { id: "guest", name: "Guest", score: 2100, answered: true, connected: false }],
  ]);
  resetPlayersForReplay(players);
  assert.equal(players.size, 2);
  assert.deepEqual(
    [...players.values()].map(player => ({ name: player.name, score: player.score, answered: player.answered, connected: player.connected })),
    [
      { name: "Host", score: 0, answered: false, connected: true },
      { name: "Guest", score: 0, answered: false, connected: false },
    ],
  );
});
