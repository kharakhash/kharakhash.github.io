/**
 * gameCoreWorker - Dedicated Web Worker for running heavy grid math off the main thread.
 * Computes directional moves and heuristics for 7x7, 9x9, 11x11 grids at 60-120fps.
 */

import { GameCore } from '../core/GameCore.js';

self.onmessage = (event) => {
  const { id, type, payload } = event.data;

  try {
    if (type === 'computeMove') {
      const { state, direction } = payload;
      const result = GameCore.computeMove(state, direction);
      self.postMessage({ id, success: true, result });
    } else if (type === 'canMakeMove') {
      const { state } = payload;
      const canMove = GameCore.canMakeMove(state);
      self.postMessage({ id, success: true, canMove });
    } else if (type === 'checkQuestOutcome') {
      const { state } = payload;
      const outcome = GameCore.checkQuestOutcome(state);
      self.postMessage({ id, success: true, outcome });
    } else {
      self.postMessage({ id, success: false, error: `Unknown task type "${type}"` });
    }
  } catch (error) {
    self.postMessage({ id, success: false, error: error.message });
  }
};
