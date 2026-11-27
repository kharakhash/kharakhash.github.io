import { StateManager } from './StateManager.js';
import { GridService } from './GridService.js';
import { PerformanceUtils } from './PerformanceUtils.js';
import { ErrorHandler } from './ErrorHandling.js';
import { EventBus } from './EventBus.js';
import { I18nService } from './I18nService.js';
import { ANIMATION_DURATION, MODES, MODE_INFO } from './constants.js';

/**
 * UIService - Manages all user interface rendering and updates based on game state.
 */
export const UIService = (() => {
  let _elements = {}; // Private variable to store cached DOM elements
  let _lastGrid = null;
  let _lastShowValues = null;
  let _currentCarouselIndex = 0;

  /**
   * Sets the cached DOM elements for the UIService to use.
   * This should be called once during game initialization.
   * @param {Object} elements - The cached DOM elements object.
   */
  const setElements = (elements) => {
    _elements = elements;
    _lastGrid = null;
    _lastShowValues = null;
    I18nService.applyTranslations();
  };

  /**
   * Applies the theme to the document body.
   * @param {string} theme - 'light' or 'dark'.
   */
  const applyTheme = (theme) => {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('light-theme', theme === 'light');
    }
  };

  /**
   * Renders the complete game state to the DOM.
   * This function is subscribed to StateManager changes.
   * @param {Object} state - The current game state.
   */
  const render = (state) => {
    if (typeof document === 'undefined') return;
    if (state.language && state.language !== I18nService.getLanguage()) {
      I18nService.setLanguage(state.language);
    }
    applyTheme(state.theme);
    renderGrid(state);
    updateScoreAndMoves(state);
    updateSettingsUI(state);
    // Any other UI updates that depend on state
  };

  /**
   * Renders the grid state to DOM.
   * Directly synchronizes state to DOM elements to prevent stale cache desync.
   * @param {Object} state - The current game state.
   */
  const renderGrid = (state) => {
    const { grid, size, showValues, cellTypes, lockedCells, gridType = 'square' } = state;
    if (!_elements.game) return;

    const cells = _elements.cells;
    const lockedSet = new Set(
      Array.isArray(lockedCells) 
        ? lockedCells.map(c => `${c.row},${c.col}`)
        : (lockedCells instanceof Set ? Array.from(lockedCells) : [])
    );

    const isHex = gridType === 'hex';
    const numRows = isHex ? 2 * size - 1 : size;

    for (let r = 0; r < numRows; r++) {
      const numCols = isHex ? GridService.hexRowLength(size, r) : size;
      for (let c = 0; c < numCols; c++) {
        const val = grid?.[r]?.[c];
        const cell = cells?.[r]?.[c] || document.getElementById(`cell-${r}-${c}`);
        if (!cell) continue;

        const type = cellTypes?.[r]?.[c] || 'active';
        cell.classList.toggle('cell-inactive', type === 'inactive');
        cell.classList.toggle('cell-medium', type === 'medium');
        
        const isLocked = lockedSet.has(`${r},${c}`);
        cell.classList.toggle('cell-locked', isLocked);

        if (cell.classList.contains('disappearing')) continue;

        if (type === 'inactive') {
          cell.dataset.value = '';
          cell.textContent = '';
          continue;
        }

        const expectedDataValue = val !== null && val !== undefined ? String(val) : '';
        if (cell.dataset.value !== expectedDataValue) {
          cell.dataset.value = expectedDataValue;
        }

        const nextText = showValues ? (val ? String(Math.log2(val) - 1) : '') : '';
        if (cell.textContent !== nextText) {
          cell.textContent = nextText;
        }
      }
    }
  };

  /**
   * Updates score and moves display across all 3 game modes.
   * @param {Object} state - The current game state.
   */
  const updateScoreAndMoves = (state) => {
    const { gameMode, moves, score, levelMoves, totalMoves, levelScore, totalScore, grid, size, cellTypes } = state;

    _elements.infinityScoreDisplay?.classList.add('hidden');
    _elements.questScoreDisplay?.classList.add('hidden');
    _elements.akureScoreDisplay?.classList.add('hidden');

    if (gameMode === 'infinity') {
      _elements.infinityScoreDisplay?.classList.remove('hidden');
      if (_elements.moves) _elements.moves.textContent = moves;
      if (_elements.score) _elements.score.textContent = score;
    } else if (gameMode === 'quest') {
      _elements.questScoreDisplay?.classList.remove('hidden');
      if (_elements.levelMoves) _elements.levelMoves.textContent = levelMoves;
      if (_elements.totalMovesDisplay) _elements.totalMovesDisplay.textContent = totalMoves;
      if (_elements.levelScore) _elements.levelScore.textContent = levelScore;
      if (_elements.totalScoreDisplay) _elements.totalScoreDisplay.textContent = totalScore;
    } else if (gameMode === 'akure') {
      _elements.akureScoreDisplay?.classList.remove('hidden');
      
      // Calculate filled / total playable slots
      let totalPlayable = 0;
      let filledCount = 0;
      const isHex = state.gridType === 'hex';
      const numRows = isHex ? 2 * size - 1 : size;
      for (let r = 0; r < numRows; r++) {
        const numCols = isHex ? GridService.hexRowLength(size, r) : size;
        for (let c = 0; c < numCols; c++) {
          if (!cellTypes || cellTypes[r]?.[c] !== 'inactive') {
            totalPlayable++;
            if (grid?.[r]?.[c] !== null && grid?.[r]?.[c] !== undefined && grid[r][c] > 0) {
              filledCount++;
            }
          }
        }
      }
      
      if (_elements.akureFilled) _elements.akureFilled.textContent = `${filledCount}/${totalPlayable}`;
      if (_elements.akureLevelMoves) {
        _elements.akureLevelMoves.textContent = state.akureMaxMoves 
          ? `${levelMoves}/${state.akureMaxMoves}` 
          : `${levelMoves}`;
      }
      if (_elements.akureLevelBadge) {
        _elements.akureLevelBadge.textContent = state.akureModeType === 'quest'
          ? `Lvl ${state.akureQuestLevel || 1}`
          : 'Random';
      }
      if (_elements.akureLevelScore) _elements.akureLevelScore.textContent = levelScore;
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
    }, ANIMATION_DURATION * 4);
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

    const currentLang = state.language || I18nService.getLanguage();
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
      });
    }
    
    updateCarouselUI(state.gameMode);

    const preferredSize = typeof state.selectedSize === 'number' ? state.selectedSize : state.size;
    const preferredGridType = state.selectedGridType || state.gridType || 'square';
    highlightCurrentSize(preferredSize, preferredGridType);
  };

  /**
   * Updates the Mode Carousel to display the active mode.
   * @param {string} currentMode - 'infinity' | 'quest' | 'akure'
   */
  const updateCarouselUI = (currentMode) => {
    const track = document.getElementById('modeCarouselTrack');
    const title = document.getElementById('modeCarouselTitle');
    const badge = document.getElementById('modeCarouselBadge');
    const desc = document.getElementById('modeCarouselDesc');
    const indicators = document.getElementById('modeCarouselIndicators');

    const index = MODES.indexOf(currentMode);
    if (index >= 0) {
      _currentCarouselIndex = index;
    }

    const modeData = MODE_INFO[currentMode] || MODE_INFO.infinity;
    if (title) title.textContent = I18nService.t(`modes.${currentMode}.title`, modeData.title);
    if (badge) badge.textContent = I18nService.t(`modes.${currentMode}.badge`, modeData.badge);
    if (desc) desc.textContent = I18nService.t(`modes.${currentMode}.desc`, modeData.desc);

    // Update dot indicators
    if (indicators) {
      indicators.querySelectorAll('.mode-dot').forEach((dot, idx) => {
        dot.classList.toggle('active', idx === _currentCarouselIndex);
      });
    }
  };

  /**
   * Advances the mode carousel in specified direction (-1 or 1).
   * @returns {string} New selected mode ID.
   */
  const stepCarousel = (direction) => {
    _currentCarouselIndex = (_currentCarouselIndex + direction + MODES.length) % MODES.length;
    const newMode = MODES[_currentCarouselIndex];
    updateCarouselUI(newMode);
    return newMode;
  };

  /**
   * Highlights currently selected grid size and grid type.
   * @param {number} currentSize - The current grid size from state.
   * @param {string} [currentGridType='square'] - 'square' or 'hex'.
   */
  const highlightCurrentSize = (currentSize, currentGridType = 'square') => {
    if (typeof document === 'undefined') return;
    const sizeSquares = document.querySelectorAll('.size-square');
    sizeSquares.forEach(square => {
      const squareSize = parseInt(square.dataset.size, 10);
      const squareType = square.dataset.gridType || 'square';
      if (squareSize === currentSize && squareType === currentGridType) {
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
   * Shows burger menu overlay.
   */
  const showBurgerMenu = () => {
    toggleSectionVisibility(_elements.burgerMenuOverlay, true);
  };

  /**
   * Hides burger menu overlay.
   */
  const hideBurgerMenu = () => {
    toggleSectionVisibility(_elements.burgerMenuOverlay, false);
  };

  /**
   * Toggles burger menu overlay.
   */
  const toggleBurgerMenu = () => {
    const isHidden = !_elements.burgerMenuOverlay || _elements.burgerMenuOverlay.classList.contains('hidden');
    toggleSectionVisibility(_elements.burgerMenuOverlay, isHidden);
  };

  /**
   * Shows settings overlay.
   */
  const showSettings = () => {
    hideBurgerMenu();
    toggleSectionVisibility(_elements.gameContainer, false);
    toggleSectionVisibility(_elements.settingsContainer, true);
    toggleSectionVisibility(_elements.editorContainer, false);
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
   * Shows Level Editor container.
   */
  const showEditor = () => {
    hideBurgerMenu();
    toggleSectionVisibility(_elements.gameContainer, false);
    toggleSectionVisibility(_elements.settingsContainer, false);
    toggleSectionVisibility(_elements.statisticsContainer, false);
    toggleSectionVisibility(_elements.editorContainer, true);
  };

  /**
   * Hides Level Editor container.
   */
  const hideEditor = () => {
    toggleSectionVisibility(_elements.editorContainer, false);
    toggleSectionVisibility(_elements.gameContainer, true);
  };

  /**
   * Shows statistics overlay and renders statistics.
   */
  const showStatistics = () => {
    hideBurgerMenu();
    toggleSectionVisibility(_elements.gameContainer, false);
    toggleSectionVisibility(_elements.settingsContainer, false);
    toggleSectionVisibility(_elements.statisticsContainer, true);
    toggleSectionVisibility(_elements.editorContainer, false);
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
    hideAkureFailPopup();
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
        messageNode.textContent = I18nService.t('popup.infinityLose', message || "you didn't reach the infinity");
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
        messageNode.textContent = I18nService.t('popup.questLose', message || 'you lose, try again?');
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

  /**
   * Hides Akure win popup.
   */
  const hideAkureWinPopup = () => {
    toggleSectionVisibility(_elements.akureWinPopup, false);
  };

  /**
   * Shows Akure win popup.
   * @param {number} moves
   * @param {number} score
   */
  const showAkureWinPopup = (moves, score) => {
    if (_elements.akureWinPopup) {
      if (_elements.akureWinMoves) _elements.akureWinMoves.textContent = moves;
      if (_elements.akureWinScore) _elements.akureWinScore.textContent = score;
      toggleSectionVisibility(_elements.akureWinPopup, true);
    }
  };

  /**
   * Hides Akure fail popup.
   */
  const hideAkureFailPopup = () => {
    toggleSectionVisibility(_elements.akureFailPopup, false);
  };

  /**
   * Shows Akure fail popup.
   * @param {string} message
   */
  const showAkureFailPopup = (message) => {
    if (_elements.akureFailPopup) {
      const messageNode = _elements.akureFailPopup.querySelector('p');
      if (messageNode) {
        messageNode.textContent = I18nService.t('popup.akureLose', message || 'field not filled, try again?');
      }
      toggleSectionVisibility(_elements.akureFailPopup, true);
    }
  };

  // Subscribe to state changes for automatic re-rendering
  StateManager.subscribe(render);

  // Subscribe to i18n language change events
  EventBus.on('i18n:change', () => {
    const currentState = StateManager.getState();
    updateCarouselUI(currentState.gameMode);
    updateSettingsUI(currentState);
  });

  return {
    setElements, // Export the setter for elements
    render, // Export render method
    renderGrid, // Exported for initial grid creation
    showScorePopup,
    showBurgerMenu,
    hideBurgerMenu,
    toggleBurgerMenu,
    showSettings,
    hideSettings,
    showEditor,
    hideEditor,
    showStatistics,
    hideStatistics,
    hideGameOverPopup,
    showGameOverPopup,
    hideQuestFailPopup,
    showQuestFailPopup,
    hideQuestWinPopup,
    showQuestWinPopup,
    showAkureWinPopup,
    hideAkureWinPopup,
    showAkureFailPopup,
    hideAkureFailPopup,
    highlightCurrentSize, // Exported for settings interaction
    updateSettingsUI, // Exported for settings update
    updateCarouselUI,
    stepCarousel,
    getCurrentCarouselMode: () => MODES[_currentCarouselIndex],
  };
})();
