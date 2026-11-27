import { EventBus } from './EventBus.js';

/**
 * StateManager - Centralized state management with a Pub/Sub pattern.
 * Separates game state and UI state while keeping subscribers aware of a flattened state.
 */
export const StateManager = (() => {
  const GAME_KEYS = new Set([
    'grid', 'size', 'selectedSize', 'gridType', 'selectedGridType', 'history', 'score', 'moves',
    'levelMoves', 'totalMoves', 'levelScore', 'totalScore',
    'isProcessing', 'lastMoveTime', 'touchStartX', 'touchStartY',
    'initialGrid', 'cellTypes', 'lockedCells', 'winConditionGrid',
    'customLevelName', 'akureMaxMoves', 'akureQuestLevel', 'akureModeType'
  ]);
  const UI_KEYS = new Set(['theme', 'showValues', 'gameMode', 'isOverlayActive', 'language']);

  const DEFAULT_GAME_STATE = {
    grid: [],
    size: 5,
    selectedSize: 5,
    gridType: 'square', // 'square' | 'hex'
    selectedGridType: 'square',
    history: [],
    score: 0,
    moves: 0,
    levelMoves: 0,
    totalMoves: 0,
    levelScore: 0,
    totalScore: 0,
    isProcessing: false,
    lastMoveTime: 0,
    touchStartX: null,
    touchStartY: null,
    initialGrid: [],
    cellTypes: [],
    lockedCells: [],
    winConditionGrid: null,
    customLevelName: null,
    akureMaxMoves: null,
    akureQuestLevel: 1,
    akureModeType: 'random' // 'random' | 'quest'
  };

  const DEFAULT_UI_STATE = {
    theme: 'dark',
    showValues: true,
    gameMode: 'quest',
    isOverlayActive: false,
    language: 'uk'
  };

  let state = {
    game: { ...DEFAULT_GAME_STATE },
    ui: { ...DEFAULT_UI_STATE }
  };
  const subscribers = new Set();
  let publishScheduled = false;

  const _schedulePublish = () => {
    if (publishScheduled) return;
    publishScheduled = true;
    const schedule = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (callback) => setTimeout(callback, 16);
    schedule(() => {
      publishScheduled = false;
      publish();
    });
  };

  const _getGameState = () => Object.freeze({ ...state.game });
  const _getUIState = () => Object.freeze({ ...state.ui });
  const _getFlattenedState = () => {
    const gameState = _getGameState();
    const uiState = _getUIState();
    return Object.freeze({
      ...gameState,
      ...uiState,
      game: gameState,
      ui: uiState
    });
  };

  const _classifyPatch = (patch) => {
    const { game = {}, ui = {}, ...rest } = patch || {};
    const gamePatch = { ...game };
    const uiPatch = { ...ui };

    Object.entries(rest).forEach(([key, value]) => {
      if (UI_KEYS.has(key)) {
        uiPatch[key] = value;
      } else if (GAME_KEYS.has(key)) {
        gamePatch[key] = value;
      } else {
        console.warn(`[StateManager] Unclassified key "${key}" — defaulting to game state.`);
        gamePatch[key] = value;
      }
    });

    return { gamePatch, uiPatch };
  };

  const initializeState = ({ game = {}, ui = {} } = {}) => {
    state = {
      game: { ...DEFAULT_GAME_STATE, ...game },
      ui: { ...DEFAULT_UI_STATE, ...ui }
    };
    publish();
  };

  const getState = () => _getFlattenedState();
  const getGameState = () => _getGameState();
  const getUIState = () => _getUIState();

  const setState = (patchOrUpdater) => {
    const currentState = getState();
    const patch = typeof patchOrUpdater === 'function' ? patchOrUpdater(currentState) : patchOrUpdater;
    if (!patch || typeof patch !== 'object') return;

    const { gamePatch, uiPatch } = _classifyPatch(patch);
    state = {
      game: { ...state.game, ...gamePatch },
      ui: { ...state.ui, ...uiPatch }
    };
    _schedulePublish();
  };

  const subscribe = (callback) => {
    subscribers.add(callback);
    callback(getState());
    return () => subscribers.delete(callback);
  };

  const publish = () => {
    const currentState = getState();
    subscribers.forEach(callback => callback(currentState));
    EventBus.emit('state:change', currentState);
  };

  return {
    initializeState,
    getState,
    getGameState,
    getUIState,
    setState,
    subscribe
  };
})();
