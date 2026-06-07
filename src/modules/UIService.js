import { StateManager } from './StateManager.js';
import { PerformanceUtils } from './PerformanceUtils.js';
import { ErrorHandler } from './ErrorHandling.js';
import { ANIMATION_DURATION } from './constants.js';

/**
 * UIService - Manages all user interface rendering and updates based on game state.
 */
export const UIService = (() => {
  let _elements = {}; // Private variable to store cached DOM elements
  let _lastGrid = null;
  let _lastShowValues = null;

  // CSS Custom properties for dynamic cell styling // '#9600a4ff', '#7e025fff', //
  const CELL_COLORS = {
    1: '#232323ff',
    2: '#FF4487',
    4: '#ff7614',
    8: '#b8c902',
    16: '#32cb21',
    32: '#34abf5',
    64: '#246aff',
    128: '#7a2bfa',
    256: '#7700b7',
    512: '#590063ff',
    1024: '#430043ff',
    2048: '#630026ff',
    4096: '#a60016ff',
    null: 'var(--bg-darker)'
  };

  /**
   * Sets the cached DOM elements for the UIService to use.
   * This should be called once during game initialization.
   * @param {Object} elements - The cached DOM elements object.
   */
  const setElements = (elements) => {
    _elements = elements;
    _lastGrid = null;
    _lastShowValues = null;
  };

  /**
   * Applies the theme to the document body.
   * @param {string} theme - 'light' or 'dark'.
   */
  const applyTheme = (theme) => {
    document.body.classList.toggle('light-theme', theme === 'light');
  };

  /**
   * Renders the complete game state to the DOM.
   * This function is subscribed to StateManager changes.
   * @param {Object} state - The current game state.
   */
  const render = (state) => {
    applyTheme(state.theme);
    renderGrid(state);
    updateScoreAndMoves(state);
    updateSettingsUI(state);
    // Any other UI updates that depend on state
  };

  /**
   * Renders the grid state to DOM.
   * @param {Object} state - The current game state.
   */
  const renderGrid = (state) => {
    const { grid, size, showValues } = state;
    if (!_elements.game) return;

    if (!_lastGrid || _lastGrid.length !== size) {
      _lastGrid = Array.from({ length: size }, () => Array(size).fill(undefined));
    }
    const showValuesChanged = _lastShowValues !== showValues;
    const cells = _elements.cells;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const val = grid[r][c];
        const prevVal = _lastGrid[r][c];

        if (!showValuesChanged && prevVal === val) {
          continue;
        }

        const cell = cells?.[r]?.[c] || document.getElementById(`cell-${r}-${c}`);
        if (!cell) continue;

        if (prevVal !== val) {
          cell.dataset.value = val ?? '';
          cell.style.backgroundColor = CELL_COLORS[val] || CELL_COLORS.null; // Dynamic background color
          _lastGrid[r][c] = val;
        }

        const nextText = showValues ? (val ? (Math.log2(val) - 1) : '') : '';
        if (cell.textContent !== String(nextText)) {
          cell.textContent = nextText;
        }
      }
    }
    _lastShowValues = showValues;
  };

  /**
   * Updates score and moves display.
   * @param {Object} state - The current game state.
   */
  const updateScoreAndMoves = (state) => {
    const { gameMode, moves, score, levelMoves, totalMoves, levelScore, totalScore } = state;

    if (gameMode === 'infinity') {
      _elements.infinityScoreDisplay?.classList.remove('hidden');
      _elements.questScoreDisplay?.classList.add('hidden');
      if (_elements.moves) _elements.moves.textContent = moves;
      if (_elements.score) _elements.score.textContent = score;
    } else { // quest mode
      _elements.infinityScoreDisplay?.classList.add('hidden');
      _elements.questScoreDisplay?.classList.remove('hidden');
      if (_elements.levelMoves) _elements.levelMoves.textContent = levelMoves;
      if (_elements.totalMovesDisplay) _elements.totalMovesDisplay.textContent = totalMoves;
      if (_elements.levelScore) _elements.levelScore.textContent = levelScore;
      if (_elements.totalScoreDisplay) _elements.totalScoreDisplay.textContent = totalScore;
    }
  };

  /**
   * Shows animated score popup.
   * @param {number} delta - Score increase amount.
   */
  const showScorePopup = (delta) => {
    if (!delta || delta <= 0) return;
    
    const scoreContainer = _elements.scoreContainer; // Assuming 'scoreContainer' is cached
    if (!scoreContainer) return;
    
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = `+${delta}`;
    scoreContainer.appendChild(popup);
    
    setTimeout(() => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
    }, ANIMATION_DURATION * 3);
  };

  /**
   * Updates UI elements in the settings screen based on state.
   * @param {Object} state - The current game state.
   */
  const updateSettingsUI = (state) => {
    if (_elements.themeToggleBtn) {
      _elements.themeToggleBtn.checked = state.theme === 'light';
    }
    if (_elements.toggleDataValue) {
      _elements.toggleDataValue.checked = state.showValues;
    }
    if (_elements.gameModeToggleBtn) {
      _elements.gameModeToggleBtn.checked = state.gameMode === 'quest';
    }
    const preferredSize = typeof state.selectedSize === 'number' ? state.selectedSize : state.size;
    highlightCurrentSize(preferredSize);
  };

  /**
   * Highlights currently selected grid size.
   * @param {number} currentSize - The current grid size from state.
   */
  const highlightCurrentSize = (currentSize) => {
    const sizeSquares = document.querySelectorAll('.size-square');
    sizeSquares.forEach(square => {
      const squareSize = parseInt(square.dataset.size, 10);
      if (squareSize === currentSize) {
        square.classList.add('selected');
      } else {
        square.classList.remove('selected');
      }
    });
  };

  /**
   * Toggles visibility of a UI section.
   * @param {HTMLElement} element - The section element to toggle.
   * @param {boolean} show - True to show, false to hide.
   */
  const toggleSectionVisibility = (element, show) => {
    if (element) {
      if (show) {
        element.classList.remove('hidden');
        element.classList.add('visible-flex');
      } else {
        element.classList.add('hidden');
        element.classList.remove('visible-flex');
      }
    }
  };

  /**
   * Shows settings overlay.
   */
  const showSettings = () => {
    toggleSectionVisibility(_elements.gameContainer, false);
    toggleSectionVisibility(_elements.settingsContainer, true);
  };

  /**
   * Hides settings overlay.
   */
  const hideSettings = () => {
    toggleSectionVisibility(_elements.settingsContainer, false);
    toggleSectionVisibility(_elements.gameContainer, true);
    hideGameOverPopup(); // Ensure popup is hidden
  };

  /**
   * Shows statistics overlay and renders statistics.
   */
  const showStatistics = () => {
    toggleSectionVisibility(_elements.gameContainer, false);
    toggleSectionVisibility(_elements.settingsContainer, false);
    toggleSectionVisibility(_elements.statisticsContainer, true);
    StateManager.setState({ isOverlayActive: true });
    // StatisticsService.renderStatistics() will be called by EventHandler
  };

  /**
   * Hides statistics overlay.
   */
  const hideStatistics = () => {
    toggleSectionVisibility(_elements.statisticsContainer, false);
    toggleSectionVisibility(_elements.gameContainer, true);
    StateManager.setState({ isOverlayActive: false });
    hideGameOverPopup(); // Ensure popup is hidden
    hideQuestFailPopup();
  };

  /**
   * Hides infinite-mode game over popup.
   */
  const hideGameOverPopup = () => {
    toggleSectionVisibility(_elements.gameOverPopup, false);
  };

  /**
   * Shows infinite-mode game over popup.
   * @param {string} message - Message to display.
   */
  const showGameOverPopup = (message) => {
    if (_elements.gameOverPopup) {
      const messageNode = _elements.gameOverPopup.querySelector('p');
      if (messageNode) {
        messageNode.textContent = message;
      }
      toggleSectionVisibility(_elements.gameOverPopup, true);
    }
  };

  /**
   * Hides quest-mode fail popup.
   */
  const hideQuestFailPopup = () => {
    toggleSectionVisibility(_elements.questFailPopup, false);
  };

  /**
   * Shows quest-mode fail popup.
   * @param {string} message - Message to display within quest fail popup.
   */
  const showQuestFailPopup = (message) => {
    if (_elements.questFailPopup) {
      const messageNode = _elements.questFailPopup.querySelector('p');
      if (messageNode) {
        messageNode.textContent = message;
      }
      toggleSectionVisibility(_elements.questFailPopup, true);
    }
  };

  /**
   * Hides quest win popup.
   */
  const hideQuestWinPopup = () => {
    toggleSectionVisibility(_elements.questWinPopup, false);
  };

  /**
   * Shows quest win popup.
   * @param {number} moves - Moves made in the quest level.
   * @param {number} score - Score obtained in the quest level.
   */
  const showQuestWinPopup = (moves, score) => {
    if (_elements.questWinPopup) {
      if (_elements.winMoves) _elements.winMoves.textContent = moves;
      if (_elements.winScore) _elements.winScore.textContent = score;
      toggleSectionVisibility(_elements.questWinPopup, true);
    }
  };

  // Subscribe to state changes for automatic re-rendering
  StateManager.subscribe(PerformanceUtils.debounce(render, ANIMATION_DURATION)); // Debounce render calls

  return {
    setElements, // Export the setter for elements
    render, // Export render method
    renderGrid, // Exported for initial grid creation
    showScorePopup,
    showSettings,
    hideSettings,
    showStatistics,
    hideStatistics,
    hideGameOverPopup,
    showGameOverPopup,
    hideQuestFailPopup,
    showQuestFailPopup,
    hideQuestWinPopup,
    showQuestWinPopup,
    highlightCurrentSize, // Exported for settings interaction
    updateSettingsUI, // Exported for settings update
  };
})();
