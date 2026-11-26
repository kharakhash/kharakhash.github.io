import { ErrorHandler } from './ErrorHandling.js';
import { StateManager } from './StateManager.js';

const LOCAL_STORAGE_KEYS = {
  SIZE: 'SIZE',
  GRID_TYPE: 'gridType',
  THEME: 'theme',
  SHOW_VALUES: 'showValues',
  GAME_MODE: 'gameMode',
  STATS_STORE: 'gameStatsStore'
};
const STATS_SCHEMA_VERSION = 1;

const DEFAULT_STATS_STORE = {
  version: STATS_SCHEMA_VERSION,
  games: [],
  metadata: {
    updatedAt: null,
    gameCount: 0
  }
};

const _memoryStorage = new Map();

/**
 * Determines whether localStorage is usable in the current environment.
 */
const isStorageAvailable = (() => {
  let cached;
  return () => {
    if (cached !== undefined) return cached;
    if (typeof window === 'undefined' || !window.localStorage) {
      cached = false;
      return cached;
    }
    try {
      const testKey = '__storage_availability_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      cached = true;
    } catch (error) {
      cached = false;
      ErrorHandler.handle(error, 'StorageService.storageUnavailable');
    }
    return cached;
  };
})();

/**
 * Writes a string value to localStorage or in-memory fallback.
 */
const safeSetItem = (key, value) => {
  if (isStorageAvailable() && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch (error) {
      ErrorHandler.handle(error, 'StorageService.safeSetItem');
    }
  }
  _memoryStorage.set(key, String(value));
};

/**
 * Reads a value from localStorage or in-memory fallback safely.
 */
const safeGetItem = (key) => {
  if (isStorageAvailable() && typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      ErrorHandler.handle(error, 'StorageService.safeGetItem');
      return null;
    }
  }
  return _memoryStorage.has(key) ? _memoryStorage.get(key) : null;
};

/**
 * Removes a key from localStorage or in-memory fallback.
 */
const safeRemoveItem = (key) => {
  if (isStorageAvailable() && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
      return;
    } catch (error) {
      ErrorHandler.handle(error, 'StorageService.safeRemoveItem');
    }
  }
  _memoryStorage.delete(key);
};

/**
 * Parses JSON strings while falling back on parse errors.
 */
const parseJSON = (payload, fallback) => {
  if (!payload) return fallback;
  try {
    return JSON.parse(payload);
  } catch (error) {
    ErrorHandler.handle(error, 'StorageService.parseJSON');
    return fallback;
  }
};

/**
 * Loads the structured statistics store, falling back to defaults if corrupted.
 */
const loadStatsStore = () => {
  const raw = safeGetItem(LOCAL_STORAGE_KEYS.STATS_STORE);
  const parsed = parseJSON(raw, null);
  if (!parsed || !Array.isArray(parsed.games)) {
    return { ...DEFAULT_STATS_STORE };
  }
  return {
    ...DEFAULT_STATS_STORE,
    ...parsed,
    games: parsed.games
  };
};

/**
 * Persists the normalized statistics store back to localStorage.
 */
const persistStatsStore = (store) => {
  safeSetItem(LOCAL_STORAGE_KEYS.STATS_STORE, JSON.stringify(store));
};

export const StorageService = (() => {
  /**
   * Saves current game state (settings) to localStorage.
   */
  const saveState = () => {
    try {
      const { size, gridType } = StateManager.getGameState();
      const { theme, showValues, gameMode } = StateManager.getUIState();

      safeSetItem(LOCAL_STORAGE_KEYS.SIZE, String(size));
      safeSetItem(LOCAL_STORAGE_KEYS.GRID_TYPE, gridType || 'square');
      safeSetItem(LOCAL_STORAGE_KEYS.THEME, theme);
      safeSetItem(LOCAL_STORAGE_KEYS.SHOW_VALUES, String(showValues));
      safeSetItem(LOCAL_STORAGE_KEYS.GAME_MODE, gameMode);
    } catch (error) {
      ErrorHandler.handle(error, 'StorageService.saveState');
    }
  };

  /**
   * Loads game state (settings) from localStorage.
   * @returns {Object} Loaded state fragment.
   */
  const loadState = () => {
    if (!isStorageAvailable()) return {};
    const savedSize = safeGetItem(LOCAL_STORAGE_KEYS.SIZE);
    const savedGridType = safeGetItem(LOCAL_STORAGE_KEYS.GRID_TYPE);
    const savedTheme = safeGetItem(LOCAL_STORAGE_KEYS.THEME);
    const showValues = safeGetItem(LOCAL_STORAGE_KEYS.SHOW_VALUES);
    const savedGameMode = safeGetItem(LOCAL_STORAGE_KEYS.GAME_MODE);

    const loadedState = {};
    if (savedSize && !Number.isNaN(Number(savedSize))) {
      loadedState.size = parseInt(savedSize, 10);
      loadedState.selectedSize = loadedState.size;
    }

    if (savedGridType === 'hex') {
      loadedState.gridType = 'hex';
      loadedState.selectedGridType = 'hex';
    } else {
      loadedState.gridType = 'square';
      loadedState.selectedGridType = 'square';
    }

    loadedState.theme = savedTheme === 'light' ? 'light' : 'dark';
    loadedState.showValues = showValues !== 'false';
    loadedState.gameMode = ['quest', 'infinity'].includes(savedGameMode) ? savedGameMode : 'infinity';

    return loadedState;
  };

  /**
   * Saves a completed game's statistics to localStorage.
   * Prevents storing duplicate entries for the same finished game.
   * @param {Object} gameStats - Object containing game statistics (date, size, moves, score, mode, etc.).
   */
  const saveGameStats = (gameStats) => {
    const currentStore = loadStatsStore();

    // Deduplication guard: ignore if the last saved game has identical stats within a recent window (15s)
    const latestGame = currentStore.games[0];
    if (latestGame &&
        latestGame.mode === gameStats.mode &&
        latestGame.size === gameStats.size &&
        latestGame.moves === gameStats.moves &&
        latestGame.score === gameStats.score) {
      const now = Date.now();
      const lastRecordedTime = latestGame.recordedAt ? new Date(latestGame.recordedAt).getTime() : 0;
      if (now - lastRecordedTime < 15000) {
        return currentStore;
      }
    }

    const nextGame = {
      ...gameStats,
      recordedAt: new Date().toISOString()
    };
    const nextStore = {
      version: STATS_SCHEMA_VERSION,
      metadata: {
        updatedAt: new Date().toISOString(),
        gameCount: currentStore.games.length + 1
      },
      games: [nextGame, ...currentStore.games]
    };
    persistStatsStore(nextStore);
    return nextStore;
  };

  /**
   * Loads all saved game statistics from localStorage.
   * @returns {Array<Object>} An array of game statistics.
   */
  const loadAllGamesStats = () => {
    const store = loadStatsStore();
    return store.games;
  };

  /**
   * Returns the full stats store (including metadata).
   */
  const getStatsStore = () => loadStatsStore();

  /**
   * Clears all saved game statistics from localStorage.
   */
  const clearAllGamesStats = () => {
    safeRemoveItem(LOCAL_STORAGE_KEYS.STATS_STORE);
  };

  /**
   * Migrates localStorage data if the schema version has changed.
   * Preserves backward compatibility with older data formats.
   */
  const migrateIfNeeded = () => {
    const store = loadStatsStore();
    if (!store.version || store.version < STATS_SCHEMA_VERSION) {
      const migrated = {
        ...store,
        version: STATS_SCHEMA_VERSION,
        metadata: {
          ...store.metadata,
          updatedAt: new Date().toISOString(),
        },
      };
      persistStatsStore(migrated);
    }
  };

  return {
    saveState,
    loadState,
    saveGameStats,
    loadAllGamesStats,
    clearAllGamesStats,
    getStatsStore,
    migrateIfNeeded,
  };
})();

