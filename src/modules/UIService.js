import { StateManager } from './StateManager.js';
import { PerformanceUtils } from './PerformanceUtils.js';
import { ErrorHandler } from './ErrorHandling.js';
import { ANIMATION_DURATION } from './constants.js';

/**
 * UIService - Manages all user interface rendering and updates based on game state.
 */
export const UIService = (() => {
  let _elements = {}; // Private variable to store cached DOM elements

  // CSS Custom properties for dynamic cell styling
  const CELL_COLORS = {
    1: '#454545',
    2: '#FF4487',
    4: '#ff7614',
    8: '#0ce0a4',
    16: '#09cdd0',
    32: '#25ACF2',
    64: '#166FFA',
    128: '#7a2bfa',
    256: '#7700b7',
    512: '#a400b3',
    1024: '#7e0246',
    2048: '#410032',
    4096: '#270023',
    null: 'var(--bg-darker)'
  };

  /**
   * Sets the cached DOM elements for the UIService to use.
   * This should be called once during game initialization.
   * @param {Object} elements - The cached DOM elements object.
   */
  const setElements = (elements) => {
    _elements = elements;
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
    updateEfficiency(state);
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

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = document.getElementById(`cell-${r}-${c}`);
        const val = grid[r][c];
        
        if (cell) {
          cell.dataset.value = val ?? '';
          cell.style.backgroundColor = CELL_COLORS[val] || CELL_COLORS.null; // Dynamic background color
          if (showValues) {
            cell.textContent = val ? (Math.log2(val) - 1) : '';
          } else {
            cell.textContent = '';
          }
        }
      }
    }
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
   * Updates efficiency display with animation.
   * @param {Object} state - The current game state.
   */
  const updateEfficiency = (state) => {
    const { moves, score } = state;
    setTimeout(() => {
      const efficiency = moves > 0 ? (score / moves).toFixed(1) : '0.0';
      const effElement = document.getElementById('efficiency'); // Assuming 'efficiency' element exists
      
      if (effElement && effElement.textContent !== efficiency) {
        effElement.textContent = efficiency;
        effElement.classList.remove('flash');
        // Trigger reflow to restart animation
        void effElement.offsetWidth;
        effElement.classList.add('flash');
      }
    }, ANIMATION_DURATION * 2); // Reduced delay
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
    highlightCurrentSize(state.size);
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
  };

  /**
   * Shows tutorial overlay.
   */
  const showTutorial = () => {
    StateManager.setState({ isOverlayActive: true });
    toggleSectionVisibility(_elements.gameContainer, false);
    toggleSectionVisibility(_elements.settingsContainer, false);
    // Assuming elements.tutorialContainer exists in index.html
    toggleSectionVisibility(_elements.tutorialContainer, true);
    // TutorialService.resetTutorialGrid() will be called by EventHandler
  };

  /**
   * Hides tutorial overlay.
   */
  const hideTutorial = () => {
    StateManager.setState({ isOverlayActive: false });
    toggleSectionVisibility(_elements.tutorialContainer, false);
    toggleSectionVisibility(_elements.gameContainer, true);
  };

  /**
   * Hides game over popup.
   */
  const hideGameOverPopup = () => {
    toggleSectionVisibility(_elements.gameOverPopup, false);
  };

  /**
   * Shows game over popup.
   * @param {string} message - Message to display.
   * @param {number} moves - Moves made (for quest mode).
   * @param {number} score - Score obtained (for quest mode).
   */
  const showGameOverPopup = (message, moves = 0, score = 0) => {
    if (_elements.gameOverPopup) {
      const popupMessage = _elements.gameOverPopup.querySelector('p');
      if (popupMessage) {
        popupMessage.textContent = message;
      }
      // Update specific spans for moves/score if needed within the popup
      // This might require additional elements in index.html or more specific selectors
      toggleSectionVisibility(_elements.gameOverPopup, true);
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

  /**
   * Hides quest lose popup.
   */
  const hideQuestLosePopup = () => {
    toggleSectionVisibility(_elements.questLosePopup, false);
  };

  /**
   * Shows quest lose popup.
   * @param {string} message - Message to display.
   */
  const showQuestLosePopup = (message) => {
    if (_elements.questLosePopup) {
      const popupMessage = _elements.questLosePopup.querySelector('p');
      if (popupMessage) {
  return {
    setElements, // Export the setter for elements
    render, // Exportsrender method
    renderGrid, // Exported for initial grid creation
    showScorePopup,
    showSettings,
    hideSettings,ho
    showStatistics,
    hideStatistics,
    showTutorial,
    hideTutorial,
    hideGameOverPopup,
    showGameOverPopup,
    hideQuestWinPopup,
    showQuestWinPopup,
    hideQuestLosePopup, // Export the new function
    showQuestLosePopup, // Export the new function
    highlightCurrentSize, // Exported for settings interaction
    updateSettingsUI, // Exported for settings update
  };l,
    hideGameOverPopup,
    showGameOverPopup,
    hideQuestWinPopup,
    showQuestWinPopup,
    hideQuestLosePopup, // Export the new function
    showQuestLosePopup, // Export the new function
    highightCurrentSize, // Exported for settings interaction
    updateSettingsUI // Exported for settings update
  };
})();
    shotGameOverPopup,
    hideggllSecScotVisibility(_elements.questLoseionVis true);ibility(_elements.questLosePopup, true);
    s}owQuestWnPopup,
    hideQuestLosePopup, // Export the new function
    showQuestLosePopup, // Export the new function
    hi
  };
  Subscribe to state c}anges for automatc re-renderin
  StateManager.subscribe(PerformanceUtils.debounce(render, ANIMATION_DURATION)); // Debounce render calls

  return {
    setElements, // Export te setter for eemens
    render, // Expot der mehod
    renderGrdor initial grid creation
    showScePopup,
   howS,
   hideSettgs,
    showStatisics,
    hidStatistics,
    showTutoil,
    hideTuorial,
    hdeGameOverPopup,
    showGameOverPpup,
    hideQuestWiPopup,
  };showQuestWinPop,
    hieQuestLosePopup, // Export the new funcion
    showQustLosPopup, // Export he new funco
    highlihtCurrentSizeintercionSubscribe to state changes for automatic re-rendering
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
    showTutorial,
    hideTutorial,
    hideGameOverPopup,
    showGameOverPopup,
    hideQuestWinPopup,
    showQuestWinPopup,
    hideQuestLosePopup, // Export the new function
    showQuestLosePopup, // Export the new function
    highlightCurrentSize, // Exported for settings interaction
    updateSettingsUI, // Exported for settings update
  };
})();
