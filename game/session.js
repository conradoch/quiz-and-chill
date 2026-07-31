export function resetPlayersForReplay(players) {
  for (const player of players.values()) {
    player.score = 0;
    player.answered = false;
  }
}

export function shouldFinishAfterLeave(phase, playerCount) {
  return !["lobby", "finished"].includes(phase) && playerCount === 1;
}
