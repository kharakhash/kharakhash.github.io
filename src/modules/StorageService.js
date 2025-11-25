import { ErrorHandler } from './ErrorHandling.js';
import { StateManager } from './StateManager.js';

/**
 * StorageService - Manages interaction with localStorage.
 */
export const StorageService = (() => {
  const LOCAL_STORAGE_KEYS = {
    SIZE: 'SIZE',
    THEME: 'theme',
    SHOW_VALUES: 'showValues',
    GAME_MODE: 'gameMode',
    ALL_GAMES: 'allGames',
  };

  /**
   * Saves current game state (settings) to localStorage.
   */
  const saveState = () => {
    try {
      const { size, theme, showValues, gameMode } = StateManager.getState();
      
      localStorage.setItem(LOCAL_STORAGE_KEYS.SIZE, String(size));
      localStorage.setItem(LOCAL_STORAGE_KEYS.THEME, theme);
      localStorage.setItem(LOCAL_STORAGE_KEYS.SHOW_VALUES, String(showValues));
      localStorage.setItem(LOCAL_STORAGE_KEYS.GAME_MODE, gameMode);
    } catch (error) {
      ErrorHandler.handle(error, 'StorageService.saveState');
    }
  };

  /**
   * Loads game state (settings) from localStorage.
   * @returns {Object} Loaded state fragment.
   */
  const loadState = () => {
    try {
      const savedSize = localStorage.getItem(LOCAL_STORAGE_KEYS.SIZE);
      const savedTheme = localStorage.getItem(LOCAL_STORAGE_KEYS.THEME);
      const showValues = localStorage.getItem(LOCAL_STORAGE_KEYS.SHOW_VALUES);
      const savedGameMode = localStorage.getItem(LOCAL_STORAGE_KEYS.GAME_MODE);

      const loadedState = {};
      if (savedSize && !isNaN(savedSize)) {
        loadedState.size = parseInt(savedSize, 10);
        loadedState.selectedSize = loadedState.size; // Initial selected size
      }

      loadedState.theme = savedTheme === 'light' ? 'light' : 'dark';
      loadedState.showValues = showValues !== 'false';
      loadedState.gameMode = savedGameMode === 'quest' ? 'quest' : 'infinity';

      return loadedState;
    } catch (error) {
      ErrorHandler.handle(error, 'StorageService.loadState');
      return {};
    }
  };

  /**
   * Saves a completed game's statistics to localStorage.
   * @param {Object} gameStats - Object containing game statistics (date, size, moves, score, mode, etc.).
   */
  const saveGameStats = (gameStats) => {
    try {
      const allGames = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ALL_GAMES)) || [];
      allGames.push(gameStats);
      localStorage.setItem(LOCAL_STORAGE_KEYS.ALL_GAMES, JSON.stringify(allGames));
    } catch (error) {
      ErrorHandler.handle(error, 'StorageService.saveGameStats');
    }
  };

  /**
   * Loads all saved game statistics from localStorage.
   * @returns {Array<Object>} An array of game statistics.
   */
  const loadAllGamesStats = () => {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ALL_GAMES)) || [];
    } catch (error) {
      ErrorHandler.handle(error, 'StorageService.loadAllGamesStats');
      return [];
    }
  };

  /**
   * Clears all saved game statistics from localStorage.
   */
  const clearAllGamesStats = () => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.ALL_GAMES);
    } catch (error) {
      ErrorHandler.handle(error, 'StorageService.clearAllGamesStats');
    }
  };

  return {
    saveState,
    loadState,
    saveGameStats,
    loadAllGamesStats,
    clearAllGamesStats,
  };
})();
