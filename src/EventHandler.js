import { ErrorHandler } from './modules/ErrorHandling.js';
import { DIRECTION_DELTAS, SWIPE_THRESHOLD } from './modules/constants.js';

/**
 * EventHandler - Manages all user interaction events (keyboard, mouse, touch).
 * It acts as a bridge between DOM events and the Game logic.
 */
export class EventHandler {
  constructor(elements, game) {
    this.elements = elements;
    this.game = game; // Reference to the Game instance
    this.touchStartX = null;
    this.touchStartY = null;

    // Bind event handlers to maintain 'this' context
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleRestartClick = this.handleRestartClick.bind(this);
    this.handleUndoClick = this.handleUndoClick.bind(this);
    this.handleSaveSettingsClick = this.handleSaveSettingsClick.bind(this);
    this.handleShowStatisticsClick = this.handleShowStatisticsClick.bind(this);
    this.handleHideStatisticsClick = this.handleHideStatisticsClick.bind(this);
    this.handleClearStatisticsClick = this.handleClearStatisticsClick.bind(this);
    this.handleTryAgainClick = this.handleTryAgainClick.bind(this);
    this.handleTryAnotherClick = this.handleTryAnotherClick.bind(this);
    this.handleNextQuestLevelClick = this.handleNextQuestLevelClick.bind(this);
    this.handleShowSettingsClick = this.handleShowSettingsClick.bind(this);
    this.handleHideSettingsClick = this.handleHideSettingsClick.bind(this);
    this.handleThemeToggleChange = this.handleThemeToggleChange.bind(this);
    this.handleToggleDataValueChange = this.handleToggleDataValueChange.bind(this);
    this.handleGameModeToggleChange = this.handleGameModeToggleChange.bind(this);
    this.handleSizeSelectionClick = this.handleSizeSelectionClick.bind(this);
    this.handleShowTutorialClick = this.handleShowTutorialClick.bind(this);
    this.handleTutorialSliderChange = this.handleTutorialSliderChange.bind(this);
  }

  /**
   * Sets up all event listeners.
   */
  setupEventListeners() {
    // Game controls
    window.addEventListener('keydown', ErrorHandler.wrap(this.handleKeyDown, 'keydown'));
    window.addEventListener('touchstart', ErrorHandler.wrap(this.handleTouchStart, 'touchstart'));
    window.addEventListener('touchend', ErrorHandler.wrap(this.handleTouchEnd, 'touchend'));
    
    // Button events
    this.elements.restartBtn?.addEventListener('click', ErrorHandler.wrap(this.handleRestartClick, 'restartBtn.click'));
    this.elements.undoBtn?.addEventListener('click', ErrorHandler.wrap(this.handleUndoClick, 'undoBtn.click'));
    this.elements.saveSettingsBtn?.addEventListener('click', ErrorHandler.wrap(this.handleSaveSettingsClick, 'saveSettingsBtn.click'));
    this.elements.statisticsBtn?.addEventListener('click', ErrorHandler.wrap(this.handleShowStatisticsClick, 'statisticsBtn.click'));
    this.elements.backFromStatisticsBtn?.addEventListener('click', ErrorHandler.wrap(this.handleHideStatisticsClick, 'backFromStatisticsBtn.click'));
    this.elements.clearStatisticsBtn?.addEventListener('click', ErrorHandler.wrap(this.handleClearStatisticsClick, 'clearStatisticsBtn.click'));
    this.elements.tryAgainBtn?.addEventListener('click', ErrorHandler.wrap(this.handleTryAgainClick, 'tryAgainBtn.click'));
    this.elements.tryAnotherBtn?.addEventListener('click', ErrorHandler.wrap(this.handleTryAnotherClick, 'tryAnotherBtn.click'));
    this.elements.nextQuestLevelBtn?.addEventListener('click', ErrorHandler.wrap(this.handleNextQuestLevelClick, 'nextQuestLevelBtn.click'));
    this.elements.settingsBtn?.addEventListener('click', ErrorHandler.wrap(this.handleShowSettingsClick, 'settingsBtn.click'));
    this.elements.cancelSettingsBtn?.addEventListener('click', ErrorHandler.wrap(this.handleHideSettingsClick, 'cancelSettingsBtn.click'));
    
    // Theme and value display toggles
    this.elements.themeToggleBtn?.addEventListener('change', ErrorHandler.wrap(this.handleThemeToggleChange, 'themeToggleBtn.change'));
    this.elements.toggleDataValue?.addEventListener('change', ErrorHandler.wrap(this.handleToggleDataValueChange, 'toggleDataValue.change'));
    this.elements.gameModeToggleBtn?.addEventListener('change', ErrorHandler.wrap(this.handleGameModeToggleChange, 'gameModeToggleBtn.change'));
    
    // Size selection
    this.setupSizeSelection();
    
    // Tutorial events (if tutorialContainer exists in index.html)
    this.elements.tutorialBtn?.addEventListener('click', ErrorHandler.wrap(this.handleShowTutorialClick, 'tutorialBtn.click'));
    this.elements.tutorialSlider?.addEventListener('input', ErrorHandler.wrap(this.handleTutorialSliderChange, 'tutorialSlider.input'));
  }

  /**
   * Sets up size selection event listeners.
   */
  setupSizeSelection = () => {
    const sizeOptions = document.getElementById('sizeOptions'); // Need to get this element
    if (!sizeOptions) return;

    const sizeSquares = sizeOptions.querySelectorAll('.size-square');
    sizeSquares.forEach(square => {
      square.addEventListener('click', ErrorHandler.wrap(this.handleSizeSelectionClick, 'size.selection'));
    });
  };

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

  handleShowTutorialClick() {
    this.game.handleShowTutorial();
  }

  handleTutorialSliderChange() {
    this.game.handleTutorialSliderChange(this.elements.tutorialSlider.value);
  }
}
