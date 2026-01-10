import { StateManager } from './StateManager.js';
import { StorageService } from './StorageService.js';
import { UIService } from './UIService.js';

/**
 * Builds a stats payload depending on current mode and meta counters.
 * @param {Object} state - Flattened state to inspect.
 * @returns {Object|null} Payload for StorageService or null when nothing to save.
 */
const _buildStatsPayload = (state) => {
  if (state.gameMode === 'infinity' && state.moves > 0) {
    return {
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      size: state.size,
      moves: state.moves,
      score: state.score,
      mode: state.gameMode,
    };
  }

  if (state.gameMode === 'quest' && state.levelMoves > 0) {
    return {
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      size: state.size,
      moves: state.levelMoves,
      score: state.levelScore,
      totalMoves: state.totalMoves,
      totalScore: state.totalScore,
      mode: state.gameMode,
    };
  }

  return null;
};

const saveCurrentGameStats = (state) => {
  const payload = _buildStatsPayload(state);
  if (!payload) return null;
  return StorageService.saveGameStats(payload);
};

const _applyInfinityCounters = (prevState/* , oldState */) => ({
  moves: prevState.moves + 1,
});

const _applyQuestCounters = (prevState/* , oldState */) => ({
  levelMoves: prevState.levelMoves + 1,
  totalMoves: prevState.totalMoves + 1,
});

const _applyInfinityScore = (prevState, delta) => {
  if (!delta) return {};
  return { score: prevState.score + delta };
};

const _applyQuestScore = (prevState, delta) => {
  if (!delta) return {};
  return {
    levelScore: prevState.levelScore + delta,
    totalScore: prevState.totalScore + delta,
  };
};

const _handleInfinityLose = (state) => {
  console.log('Infinity Mode: you have no valid moves');
  saveCurrentGameStats(state);
  UIService.showGameOverPopup('you didn\'t reach the infinity');
};

const _handleQuestLose = (state) => {
  console.log('Quest Mode: You Lose!');
  saveCurrentGameStats(state);
  UIService.showQuestFailPopup('you lose, try again?');
  UIService.hideGameOverPopup();
  StateManager.setState({ totalMoves: 0, totalScore: 0 });
};

const _handleQuestWin = (state) => {
  console.log('Quest Mode: You Win!');
  saveCurrentGameStats(state);
  UIService.showQuestWinPopup(state.levelMoves, state.levelScore);
};

export const ModeRules = {
  infinity: {
    applyMoveCounters: (prevState, oldState) => _applyInfinityCounters(prevState, oldState),
    applyScore: (prevState, delta) => _applyInfinityScore(prevState, delta),
    onLose: _handleInfinityLose,
    onWin: () => {},
  },
  quest: {
    applyMoveCounters: (prevState, oldState) => _applyQuestCounters(prevState, oldState),
    applyScore: (prevState, delta) => _applyQuestScore(prevState, delta),
    onLose: _handleQuestLose,
    onWin: _handleQuestWin,
  },
};

export const getModeRules = (mode) => ModeRules[mode] || ModeRules.infinity;

export { saveCurrentGameStats };
