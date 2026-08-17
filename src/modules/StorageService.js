import { ErrorHandler } from './ErrorHandling.js';
import { StateManager } from './StateManager.js';

const LOCAL_STORAGE_KEYS = {
  SIZE: 'SIZE',
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
 * Writes a string value to localStorage if the API is available.
 */
const safeSetItem = (key, value) => {
  if (!isStorageAvailable() || typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    ErrorHandler.handle(error, 'StorageService.safeSetItem');
  }
};

/**
 * Reads a value from localStorage safely (returns null when unavailable).
 */
const safeGetItem = (key) => {
  if (!isStorageAvailable() || typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    ErrorHandler.handle(error, 'StorageService.safeGetItem');
    return null;
  }
};

/**
 * Removes a key from localStorage when the API is accessible.
 */
const safeRemoveItem = (key) => {
  if (!isStorageAvailable() || typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    ErrorHandler.handle(error, 'StorageService.safeRemoveItem');
  }
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
      const { size } = StateManager.getGameState();
      const { theme, showValues, gameMode } = StateManager.getUIState();

      safeSetItem(LOCAL_STORAGE_KEYS.SIZE, String(size));
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
    const savedTheme = safeGetItem(LOCAL_STORAGE_KEYS.THEME);
    const showValues = safeGetItem(LOCAL_STORAGE_KEYS.SHOW_VALUES);
    const savedGameMode = safeGetItem(LOCAL_STORAGE_KEYS.GAME_MODE);

    const loadedState = {};
    if (savedSize && !Number.isNaN(Number(savedSize))) {
      loadedState.size = parseInt(savedSize, 10);
      loadedState.selectedSize = loadedState.size;
    }

    loadedState.theme = savedTheme === 'light' ? 'light' : 'dark';
    loadedState.showValues = showValues !== 'false';
    loadedState.gameMode = ['quest', 'akure', 'infinity'].includes(savedGameMode) ? savedGameMode : 'infinity';

    return loadedState;
  };

  const CUSTOM_LEVELS_KEY = 'customLevelsStore';

  /**
   * Loads all custom user-designed levels.
   * @returns {Array<Object>}
   */
  const loadCustomLevels = () => {
    const raw = safeGetItem(CUSTOM_LEVELS_KEY);
    return parseJSON(raw, []);
  };

  /**
   * Saves or updates a custom level.
   * @param {Object} level - Level object with id, name, size, mode, layout, initialTiles, winCondition.
   */
  const saveCustomLevel = (level) => {
    const levels = loadCustomLevels();
    const existingIndex = levels.findIndex(l => l.id === level.id);
    const enriched = {
      ...level,
      id: level.id || `lvl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      updatedAt: new Date().toISOString()
    };
    if (existingIndex >= 0) {
      levels[existingIndex] = enriched;
    } else {
      levels.unshift(enriched);
    }
    safeSetItem(CUSTOM_LEVELS_KEY, JSON.stringify(levels));
    return enriched;
  };

  /**
   * Deletes a custom level by ID.
   * @param {string} id
   */
  const deleteCustomLevel = (id) => {
    const levels = loadCustomLevels().filter(l => l.id !== id);
    safeSetItem(CUSTOM_LEVELS_KEY, JSON.stringify(levels));
    return levels;
  };

  /**
   * Saves a completed game's statistics to localStorage.
   * @param {Object} gameStats - Object containing game statistics (date, size, moves, score, mode, etc.).
   */
  const saveGameStats = (gameStats) => {
    const currentStore = loadStatsStore();
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

  const AKURE_QUEST_LEVEL_KEY = 'akureQuestLevel';

  const getAkureQuestLevel = () => {
    const raw = safeGetItem(AKURE_QUEST_LEVEL_KEY);
    return raw ? parseInt(raw, 10) : 1;
  };

  const setAkureQuestLevel = (level) => {
    safeSetItem(AKURE_QUEST_LEVEL_KEY, String(level));
  };

  return {
    saveState,
    loadState,
    saveGameStats,
    loadAllGamesStats,
    clearAllGamesStats,
    getStatsStore,
    migrateIfNeeded,
    loadCustomLevels,
    saveCustomLevel,
    deleteCustomLevel,
    getAkureQuestLevel,
    setAkureQuestLevel,
  };
})();

