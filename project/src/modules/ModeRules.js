import { StateManager } from './StateManager.js';
import { StorageService } from './StorageService.js';
import { UIService } from './UIService.js';
import { EventBus } from './EventBus.js';

/**
 * Builds a stats payload depending on current mode and meta counters.
 * @param {Object} state - Flattened state to inspect.
 * @returns {Object|null} Payload for StorageService or null when nothing to save.
 */
const buildStatsPayload = (state) => {
  if (state.gameMode === 'infinity' && state.moves > 0) {
    return {
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      size: state.size,
      gridType: state.gridType || 'square',
      moves: state.moves,
      score: state.score,
      mode: state.gameMode,
    };
  }

  if ((state.gameMode === 'quest' || state.gameMode === 'akure') && state.levelMoves > 0) {
    return {
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      size: state.size,
      gridType: state.gridType || 'square',
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
  const payload = buildStatsPayload(state);
  if (!payload) return null;
  return StorageService.saveGameStats(payload);
};

// --- Built-in mode strategies ---

const infinityStrategy = {
  applyMoveCounters: (prevState) => ({
    moves: prevState.moves + 1,
  }),
  applyScore: (prevState, delta) => {
    if (!delta) return {};
    return { score: prevState.score + delta };
  },
  onLose: (state) => {
    saveCurrentGameStats(state);
    EventBus.emit('game:lose', { mode: 'infinity', message: "you didn't reach the infinity" });
    UIService.showGameOverPopup("you didn't reach the infinity");
  },
  onWin: () => {},
};

const questStrategy = {
  applyMoveCounters: (prevState) => ({
    levelMoves: prevState.levelMoves + 1,
    totalMoves: prevState.totalMoves + 1,
  }),
  applyScore: (prevState, delta) => {
    if (!delta) return {};
    return {
      levelScore: prevState.levelScore + delta,
      totalScore: prevState.totalScore + delta,
    };
  },
  onLose: (state) => {
    saveCurrentGameStats(state);
    EventBus.emit('game:lose', { mode: 'quest', message: 'you lose, try again?' });
    UIService.showQuestFailPopup('you lose, try again?');
    UIService.hideGameOverPopup();
    StateManager.setState({ totalMoves: 0, totalScore: 0 });
  },
  onWin: (state) => {
    saveCurrentGameStats(state);
    EventBus.emit('game:win', { mode: 'quest', moves: state.levelMoves, score: state.levelScore });
    UIService.showQuestWinPopup(state.levelMoves, state.levelScore);
  },
};

const akureStrategy = {
  applyMoveCounters: (prevState) => ({
    levelMoves: prevState.levelMoves + 1,
    totalMoves: prevState.totalMoves + 1,
  }),
  applyScore: (prevState, delta) => {
    if (!delta) return {};
    return {
      levelScore: prevState.levelScore + delta,
      totalScore: prevState.totalScore + delta,
    };
  },
  onLose: (state) => {
    saveCurrentGameStats(state);
    EventBus.emit('game:lose', { mode: 'akure', message: 'field not filled, try again?' });
    UIService.showAkureFailPopup('field not filled, try again?');
    UIService.hideGameOverPopup();
    StateManager.setState({ totalMoves: 0, totalScore: 0 });
  },
  onWin: (state) => {
    saveCurrentGameStats(state);
    EventBus.emit('game:win', { mode: 'akure', moves: state.levelMoves, score: state.levelScore });
    UIService.showAkureWinPopup(state.levelMoves, state.levelScore);
  },
};

// --- Mode registry ---

const modeRegistry = new Map([
  ['infinity', infinityStrategy],
  ['quest', questStrategy],
  ['akure', akureStrategy],
]);

/**
 * Registers a new game mode strategy.
 * Enables adding modes without modifying existing code (Open/Closed Principle).
 * @param {string} modeName - Unique mode identifier.
 * @param {Object} strategy - Mode strategy implementing { applyMoveCounters, applyScore, onLose, onWin }.
 */
const registerMode = (modeName, strategy) => {
  const required = ['applyMoveCounters', 'applyScore', 'onLose', 'onWin'];
  for (const method of required) {
    if (typeof strategy[method] !== 'function') {
      throw new Error(`[ModeRules] Strategy "${modeName}" is missing required method "${method}".`);
    }
  }
  modeRegistry.set(modeName, strategy);
};

/**
 * Returns the strategy for the given mode, falling back to infinity.
 * @param {string} mode - Game mode name.
 * @returns {Object} Mode strategy.
 */
const getModeRules = (mode) => modeRegistry.get(mode) || infinityStrategy;

/**
 * Returns all registered mode names.
 * @returns {string[]} Array of registered mode names.
 */
const getRegisteredModes = () => [...modeRegistry.keys()];

export { getModeRules, registerMode, getRegisteredModes, saveCurrentGameStats };
