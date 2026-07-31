export function resetPlayersForReplay(players) {
  for (const player of players.values()) {
    player.score = 0;
    player.answered = false;
  }
}

export function shouldFinishAfterLeave(phase, playerCount) {
  return !["lobby", "finished"].includes(phase) && playerCount === 1;
}

export function rankPlayers(players, scoreSnapshot = null) {
  return [...players.values()]
    .map(player => ({
      id: player.id,
      name: player.name,
      connected: player.connected,
      score: scoreSnapshot?.get(player.id) ?? player.score,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((player, index) => ({ ...player, rank: index + 1 }));
}
