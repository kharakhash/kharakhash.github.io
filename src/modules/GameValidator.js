import { StateManager } from './StateManager.js';
import { GridService } from './GridService.js';
import { DEBOUNCE_TIME } from './constants.js';

/**
 * GameValidator - Provides validation logic for game rules and state.
 */
export const GameValidator = (() => {
  /**
   * Validates grid position.
   * @param {number} row - Row index.
   * @param {number} col - Column index.
   * @returns {boolean} Is valid position.
   */
  const isValidPosition = (row, col) => {
    const { size } = StateManager.getGameState();
    return GridService.isValidPosition(row, col, size);
  };

  /**
   * Validates cell value for splitting.
   * @param {number|null} value - Cell value.
   * @returns {boolean} Can split.
   */
  const canSplit = (value) => {
    return typeof value === 'number' && value >= 1;
  };

  /**
   * Validates game state for move execution.
   * @param {Object} elements - Cached DOM elements (передается из GameLogic).
   * @returns {boolean} Can execute move.
   */
  const canExecuteMove = (elements) => {
    const { isProcessing, lastMoveTime } = StateManager.getGameState();
    const { isOverlayActive } = StateManager.getUIState();
    const now = Date.now();
    return !isProcessing &&
           !isOverlayActive &&
           (now - lastMoveTime) >= DEBOUNCE_TIME &&
           !isOverlayVisible(elements);
  };

  /**
   * Checks if any overlay is currently visible.
   * @param {Object} elements - Cached DOM elements (передается из GameLogic).
   * @returns {boolean} Overlay visible.
   */
  const isOverlayVisible = (elements) => {
    return elements.settingsContainer?.classList.contains('visible-flex') ||
           elements.statisticsContainer?.classList.contains('visible-flex') ||
           elements.gameOverPopup?.classList.contains('visible-flex') ||
           elements.questFailPopup?.classList.contains('visible-flex') ||
           elements.questWinPopup?.classList.contains('visible-flex');
  };

  return {
    isValidPosition,
    canSplit,
    canExecuteMove,
    isOverlayVisible,
  };
})();
