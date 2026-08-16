import { ErrorHandler } from './modules/ErrorHandling.js';
import { DIRECTION_DELTAS, SWIPE_THRESHOLD } from './modules/constants.js';

/**
 * EventHandler - Manages all user interaction events (keyboard, mouse, touch).
 * It acts as a bridge between DOM events and the Game logic.
 */
export class EventHandler {
  constructor(elements, game) {
    this.elements = elements;
    this.game = game;
    this.touchStartX = null;
    this.touchStartY = null;
    this._boundHandlers = [];
  }

  /**
   * Registers an event listener, wraps it with error handling, and tracks it for cleanup.
   * @param {EventTarget} target - DOM element or window.
   * @param {string} event - Event name.
   * @param {Function} handler - Handler method (will be bound to this).
   * @param {string} context - Error context label.
   * @param {Object} [options] - addEventListener options.
   */
  _addListener(target, event, handler, context, options) {
    const bound = ErrorHandler.wrap(handler.bind(this), context);
    this._boundHandlers.push({ target, event, bound, options });
    target.addEventListener(event, bound, options);
  }

  /**
   * Sets up all event listeners.
   */
  setupEventListeners() {
    // Game controls
    this._addListener(window, 'keydown', this.handleKeyDown, 'keydown');
    this._addListener(window, 'touchstart', this.handleTouchStart, 'touchstart');
    this._addListener(window, 'touchend', this.handleTouchEnd, 'touchend');
    
    // Button events
    if (this.elements.restartBtn) {
      this._addListener(this.elements.restartBtn, 'click', this.handleRestartClick, 'restartBtn.click');
    }
    if (this.elements.undoBtn) {
      this._addListener(this.elements.undoBtn, 'click', this.handleUndoClick, 'undoBtn.click');
    }
    if (this.elements.saveSettingsBtn) {
      this._addListener(this.elements.saveSettingsBtn, 'click', this.handleSaveSettingsClick, 'saveSettingsBtn.click');
    }
    if (this.elements.statisticsBtn) {
      this._addListener(this.elements.statisticsBtn, 'click', this.handleShowStatisticsClick, 'statisticsBtn.click');
    }
    if (this.elements.backFromStatisticsBtn) {
      this._addListener(this.elements.backFromStatisticsBtn, 'click', this.handleHideStatisticsClick, 'backFromStatisticsBtn.click');
    }
    if (this.elements.clearStatisticsBtn) {
      this._addListener(this.elements.clearStatisticsBtn, 'click', this.handleClearStatisticsClick, 'clearStatisticsBtn.click');
    }
    if (this.elements.tryAgainBtn) {
      this._addListener(this.elements.tryAgainBtn, 'click', this.handleTryAgainClick, 'tryAgainBtn.click');
    }
    if (this.elements.tryAnotherBtn) {
      this._addListener(this.elements.tryAnotherBtn, 'click', this.handleTryAnotherClick, 'tryAnotherBtn.click');
    }
    if (this.elements.tryAnotherInfinityBtn) {
      this._addListener(this.elements.tryAnotherInfinityBtn, 'click', this.handleTryAnotherClick, 'tryAnotherInfinityBtn.click');
    }
    if (this.elements.nextQuestLevelBtn) {
      this._addListener(this.elements.nextQuestLevelBtn, 'click', this.handleNextQuestLevelClick, 'nextQuestLevelBtn.click');
    }
    if (this.elements.settingsBtn) {
      this._addListener(this.elements.settingsBtn, 'click', this.handleShowSettingsClick, 'settingsBtn.click');
    }
    if (this.elements.cancelSettingsBtn) {
      this._addListener(this.elements.cancelSettingsBtn, 'click', this.handleHideSettingsClick, 'cancelSettingsBtn.click');
    }
    
    // Theme and value display toggles
    if (this.elements.themeToggleBtn) {
      this._addListener(this.elements.themeToggleBtn, 'change', this.handleThemeToggleChange, 'themeToggleBtn.change');
    }
    if (this.elements.toggleDataValue) {
      this._addListener(this.elements.toggleDataValue, 'change', this.handleToggleDataValueChange, 'toggleDataValue.change');
    }
    if (this.elements.gameModeToggleBtn) {
      this._addListener(this.elements.gameModeToggleBtn, 'change', this.handleGameModeToggleChange, 'gameModeToggleBtn.change');
    }
    
    // Size selection
    this.setupSizeSelection();
  }

  /**
   * Sets up size selection event listeners.
   */
  setupSizeSelection() {
    const sizeOptions = document.getElementById('sizeOptions');
    if (!sizeOptions) return;

    const sizeSquares = sizeOptions.querySelectorAll('.size-square');
    for (const square of sizeSquares) {
      this._addListener(square, 'click', this.handleSizeSelectionClick, 'size.selection');
    }
  }

  handleKeyDown(e) {
    if (Object.keys(DIRECTION_DELTAS).includes(e.key)) {
      e.preventDefault();
      this.game.handleMove(e.key);
    }
  }

  handleTouchStart(e) {
    if (e.touches.length === 1) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    }
  }

  handleTouchEnd(e) {
    if (this.touchStartX === null || this.touchStartY === null) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    
    let direction = null;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > SWIPE_THRESHOLD) {
        direction = 'ArrowRight';
      } else if (deltaX < -SWIPE_THRESHOLD) {
        direction = 'ArrowLeft';
      }
    } else {
      if (deltaY > SWIPE_THRESHOLD) {
        direction = 'ArrowDown';
      } else if (deltaY < -SWIPE_THRESHOLD) {
        direction = 'ArrowUp';
      }
    }
    
    if (direction) {
      this.game.handleMove(direction);
    }
    
    this.touchStartX = this.touchStartY = null;
  }

  handleRestartClick() {
    this.game.handleRestart();
  }

  handleUndoClick() {
    this.game.handleUndo();
  }

  handleSaveSettingsClick() {
    this.game.handleSaveSettings();
  }

  handleShowStatisticsClick() {
    this.game.handleShowStatistics();
  }

  handleHideStatisticsClick() {
    this.game.handleHideStatistics();
  }

  handleClearStatisticsClick() {
    this.game.handleClearStatistics();
  }

  handleTryAgainClick() {
    this.game.handleTryAgainQuestMode();
  }

  handleTryAnotherClick() {
    this.game.handleTryAnotherQuestMode();
  }

  handleNextQuestLevelClick() {
    this.game.handleNextQuestLevel();
  }

  handleShowSettingsClick() {
    this.game.handleShowSettings();
  }

  handleHideSettingsClick() {
    this.game.handleHideSettings();
  }
  
  handleThemeToggleChange() {
    this.game.handleThemeToggle(this.elements.themeToggleBtn.checked);
  }

  handleToggleDataValueChange() {
    this.game.handleToggleDataValue(this.elements.toggleDataValue.checked);
  }

  handleGameModeToggleChange() {
    this.game.handleGameModeToggle(this.elements.gameModeToggleBtn.checked);
  }

  handleSizeSelectionClick(event) {
    const square = event.currentTarget;
    const newSize = parseInt(square.dataset.size, 10);
    this.game.handleSizeSelection(newSize);
  }

  /**
   * Removes all registered event listeners and cleans up resources.
   */
  destroy() {
    for (const { target, event, bound, options } of this._boundHandlers) {
      target.removeEventListener(event, bound, options);
    }
    this._boundHandlers = [];
  }
}
