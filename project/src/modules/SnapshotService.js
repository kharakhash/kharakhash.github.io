import { GridService } from './GridService.js';

/**
 * SnapshotService - Helper for capturing and restoring minimal game snapshots.
 */
export const SnapshotService = (() => {
  /**
   * Builds a snapshot that is safe to store in history.
   * @param {Object} state - Current flattened game state.
   * @returns {Object} Snapshot of relevant fields.
   */
  const makeSnapshot = (state) => ({
    grid: GridService.cloneGrid(state.grid),
    moves: state.moves,
    levelMoves: state.levelMoves,
    totalMoves: state.totalMoves,
    score: state.score,
    levelScore: state.levelScore,
    totalScore: state.totalScore,
  });

  /**
   * Restores a state patch from a snapshot.
   * @param {Object} snapshot - Snapshot previously captured.
   * @returns {Object} Partial state patch ready for StateManager.setState.
   */
  const restoreSnapshot = (snapshot) => ({
    grid: GridService.cloneGrid(snapshot.grid),
    moves: snapshot.moves,
    levelMoves: snapshot.levelMoves,
    totalMoves: snapshot.totalMoves,
    score: snapshot.score,
    levelScore: snapshot.levelScore,
    totalScore: snapshot.totalScore,
  });

  return {
    makeSnapshot,
    restoreSnapshot,
  };
})();
