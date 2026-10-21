const now = () => performance.now();

/** Soft limits: an individual synchronous chunk/tile cannot be interrupted.
 * Rotate the first queue so a costly chunk cannot starve the other queues.
 * No allocations or profiling records in the game's frame loop.
 */
export function runStreamingWork(game, frameStarted, clock = now, bootBudget = 40) {
  if (game.booting) {
    game.generateQueued(bootBudget);
    game.drainRemeshQueue(bootBudget);
    game.updateFarTerrain(Infinity);
    return;
  }
  const start = clock();
  const first = game.streamingWorkPhase ?? 0;
  game.streamingWorkPhase = (first + 1) % 3;
  for (let i = 0; i < 3; i++) {
    const time = clock();
    const left = Math.max(0, Math.min(8 - (time - start), 1000 / 60 - (time - frameStarted)));
    // One stage may do its minimum job even in an overloaded frame, so
    // terrain eventually arrives. Later stages wait rather than compound it.
    if (i && left <= 0) break;
    const stage = (first + i) % 3;
    if (stage === 0) game.generateQueued(Math.min(4, left));
    else if (stage === 1) game.drainRemeshQueue(Math.min(6, left));
    else game.updateFarTerrain(Math.min(2, left));
  }
}
