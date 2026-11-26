import { ErrorHandler } from './modules/ErrorHandling.js';
import { LevelEditor } from './levels-builder/LevelEditor.js';
import { StateManager } from './modules/StateManager.js';
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
    if (!target) return;
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
    
    // Main button events
    this._addListener(this.elements.restartBtn, 'click', this.handleRestartClick, 'restartBtn.click');
    this._addListener(this.elements.undoBtn, 'click', this.handleUndoClick, 'undoBtn.click');
    this._addListener(this.elements.saveSettingsBtn, 'click', this.handleSaveSettingsClick, 'saveSettingsBtn.click');
    this._addListener(this.elements.statisticsBtn, 'click', this.handleShowStatisticsClick, 'statisticsBtn.click');
    this._addListener(this.elements.backFromStatisticsBtn, 'click', this.handleHideStatisticsClick, 'backFromStatisticsBtn.click');
    this._addListener(this.elements.clearStatisticsBtn, 'click', this.handleClearStatisticsClick, 'clearStatisticsBtn.click');
    this._addListener(this.elements.settingsBtn, 'click', this.handleShowSettingsClick, 'settingsBtn.click');
    this._addListener(this.elements.cancelSettingsBtn, 'click', this.handleHideSettingsClick, 'cancelSettingsBtn.click');

    // Burger Menu Events
    this._addListener(this.elements.burgerMenuBtn, 'click', () => UIService.toggleBurgerMenu(), 'burgerMenu.toggle');
    this._addListener(this.elements.closeBurgerMenuBtn, 'click', () => UIService.hideBurgerMenu(), 'burgerMenu.close');
    this._addListener(this.elements.burgerMenuBackdrop, 'click', () => UIService.hideBurgerMenu(), 'burgerMenu.backdrop');
    this._addListener(this.elements.menuSettingsBtn, 'click', this.handleShowSettingsClick, 'menuSettings.click');
    this._addListener(this.elements.menuStatsBtn, 'click', this.handleShowStatisticsClick, 'menuStats.click');
    this._addListener(this.elements.menuEditorBtn, 'click', this.handleShowEditorClick, 'menuEditor.click');

    // Level Editor Buttons
    this._addListener(this.elements.editorBtn, 'click', this.handleShowEditorClick, 'editorBtn.click');
    this._addListener(this.elements.backFromEditorBtn, 'click', this.handleHideEditorClick, 'backFromEditorBtn.click');
    
    // Mode Carousel Buttons
    this._addListener(this.elements.modeCarouselPrevBtn, 'click', () => this.game.handleCarouselStep(-1), 'carousel.prev');
    this._addListener(this.elements.modeCarouselNextBtn, 'click', () => this.game.handleCarouselStep(1), 'carousel.next');

    // Quest mode Popups
    this._addListener(this.elements.tryAgainBtn, 'click', this.handleTryAgainClick, 'tryAgainBtn.click');
    this._addListener(this.elements.tryAnotherBtn, 'click', this.handleTryAnotherClick, 'tryAnotherBtn.click');
    this._addListener(this.elements.tryAnotherInfinityBtn, 'click', this.handleTryAnotherClick, 'tryAnotherInfinityBtn.click');
    this._addListener(this.elements.nextQuestLevelBtn, 'click', this.handleNextQuestLevelClick, 'nextQuestLevelBtn.click');

    // Akure mode Popups
    this._addListener(this.elements.nextAkureLevelBtn, 'click', this.handleNextAkureLevelClick, 'nextAkureLevelBtn.click');
    this._addListener(this.elements.tryAgainAkureBtn, 'click', this.handleTryAgainAkureClick, 'tryAgainAkureBtn.click');
    this._addListener(this.elements.tryAnotherAkureBtn, 'click', this.handleTryAnotherAkureClick, 'tryAnotherAkureBtn.click');
    
    // Theme and value display toggles
    this._addListener(this.elements.themeToggleBtn, 'change', this.handleThemeToggleChange, 'themeToggleBtn.change');
    this._addListener(this.elements.toggleDataValue, 'change', this.handleToggleDataValueChange, 'toggleDataValue.change');
    
    // Size selection (square and hex)
    this.setupSizeSelection();

    // Hex on-screen pad controls
    this.setupHexPadControls();

    // Setup Level Editor controls
    this.setupEditorControls();
  }

  /**
   * Sets up size selection event listeners for square and hex options.
   */
  setupSizeSelection() {
    const sizeContainers = [
      document.getElementById('sizeOptions'),
      document.getElementById('hexSizeOptions')
    ];
    for (const container of sizeContainers) {
      if (!container) continue;
      const sizeSquares = container.querySelectorAll('.size-square');
      for (const square of sizeSquares) {
        this._addListener(square, 'click', this.handleSizeSelectionClick, 'size.selection');
      }
    }
  }

  /**
   * Sets up hexagonal directional pad click listeners.
   */
  setupHexPadControls() {
    const hexPad = document.getElementById('hexControlsPad');
    if (!hexPad) return;
    const buttons = hexPad.querySelectorAll('.hex-pad-btn');
    for (const btn of buttons) {
      this._addListener(btn, 'click', (e) => {
        const dir = e.currentTarget.dataset.dir;
        if (dir) {
          this.game.handleMove(dir);
        }
      }, 'hexPad.click');
    }
  }

  /**
   * Sets up Level Editor interactive tool listeners.
   */
  setupEditorControls() {
    // Mode toggle
    if (this.elements.editorModeToggleBtn) {
      this._addListener(this.elements.editorModeToggleBtn, 'click', () => {
        LevelEditor.toggleMode();
      }, 'editor.modeToggle');
    }

    // Move limit input
    if (this.elements.editorMoveLimit) {
      this._addListener(this.elements.editorMoveLimit, 'input', (e) => {
        const val = parseInt(e.target.value, 10);
        LevelEditor.setMoveLimit(!isNaN(val) && val > 0 ? val : null);
      }, 'editor.moveLimit');
    }

    // Tabs: Initial vs Win Condition
    this._addListener(this.elements.editorTabInitial, 'click', () => LevelEditor.switchTab('initial'), 'editor.tabInitial');
    this._addListener(this.elements.editorTabWin, 'click', () => LevelEditor.switchTab('winCondition'), 'editor.tabWin');

    // Quest Win Condition Type Buttons
    if (this.elements.editorWinConditionAllCleared) {
      this._addListener(this.elements.editorWinConditionAllCleared, 'click', () => {
        LevelEditor.setWinConditionType('all_cleared');
      }, 'editor.winAllCleared');
    }

    if (this.elements.editorWinConditionCustomGrid) {
      this._addListener(this.elements.editorWinConditionCustomGrid, 'click', () => {
        LevelEditor.setWinConditionType('custom_grid');
      }, 'editor.winCustomGrid');
    }

    // Tool palette buttons
    document.querySelectorAll('.editor-tool-btn').forEach(btn => {
      this._addListener(btn, 'click', (e) => {
        const cat = e.currentTarget.dataset.category;
        const val = e.currentTarget.dataset.val;
        LevelEditor.selectTool(cat, val);
      }, 'editor.toolBtn');
    });

    // Editor grid size buttons
    document.querySelectorAll('.editor-size-btn').forEach(btn => {
      this._addListener(btn, 'click', (e) => {
        const sz = parseInt(e.currentTarget.dataset.size, 10);
        document.querySelectorAll('.editor-size-btn').forEach(b => b.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
        LevelEditor.resetEditorState(sz);
      }, 'editor.sizeBtn');
    });

    // Editor Actions
    this._addListener(this.elements.editorSaveBtn, 'click', () => {
      const saved = LevelEditor.saveLevel();
      if (saved) {
        alert('Level saved successfully!');
      }
    }, 'editor.save');

    this._addListener(this.elements.editorPlayBtn, 'click', () => {
      LevelEditor.playLevel();
    }, 'editor.play');

    this._addListener(this.elements.editorClearBtn, 'click', () => {
      if (confirm('Clear current editor grid?')) {
        LevelEditor.resetEditorState(LevelEditor.getState().size);
      }
    }, 'editor.clear');

    this._addListener(this.elements.editorCopyDslBtn, 'click', () => {
      const dsl = LevelEditor.generateDSL();
      navigator.clipboard?.writeText(dsl).then(() => alert('Level DSL copied to clipboard!')).catch(() => alert('DSL: \n' + dsl));
    }, 'editor.copyDsl');

    this._addListener(this.elements.editorImportDslBtn, 'click', () => {
      const text = this.elements.editorDslOutput?.value;
      if (text) {
        const res = LevelEditor.parseDSL(text);
        if (res.success) alert('Level loaded from DSL!');
        else alert('Error parsing DSL: ' + res.error);
      }
    }, 'editor.importDsl');

    // File Download & Upload
    if (this.elements.editorDownloadDslBtn) {
      this._addListener(this.elements.editorDownloadDslBtn, 'click', () => {
        LevelEditor.downloadDSLFile();
      }, 'editor.downloadDsl');
    }

    if (this.elements.editorUploadDslBtn && this.elements.editorFileInput) {
      this._addListener(this.elements.editorUploadDslBtn, 'click', () => {
        this.elements.editorFileInput.click();
      }, 'editor.uploadDslClick');

      this._addListener(this.elements.editorFileInput, 'change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          LevelEditor.importDSLFile(file);
          e.target.value = '';
        }
      }, 'editor.fileInputChange');
    }

    this._addListener(this.elements.editorLevelName, 'input', (e) => {
      LevelEditor.setName(e.target.value);
    }, 'editor.levelName');

    // Quick Test Modal Controls
    if (this.elements.editorTestCloseBtn) {
      this._addListener(this.elements.editorTestCloseBtn, 'click', () => {
        LevelEditor.closeTest();
      }, 'editor.testClose');
    }

    if (this.elements.editorTestExitBtn) {
      this._addListener(this.elements.editorTestExitBtn, 'click', () => {
        LevelEditor.closeTest();
      }, 'editor.testExit');
    }

    if (this.elements.editorTestRestartBtn) {
      this._addListener(this.elements.editorTestRestartBtn, 'click', () => {
        LevelEditor.restartTest();
      }, 'editor.testRestart');
    }
  }

  handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (LevelEditor.isTesting()) {
        LevelEditor.closeTest();
        return;
      }
      UIService.hideBurgerMenu();
      return;
    }

    const { gridType = 'square' } = StateManager.getGameState();
    if (gridType === 'hex') {
      const hexKeyMap = {
        'KeyQ': 'HexUpLeft', 'q': 'HexUpLeft', 'Q': 'HexUpLeft', 'й': 'HexUpLeft', 'Й': 'HexUpLeft',
        'KeyE': 'HexUpRight', 'e': 'HexUpRight', 'E': 'HexUpRight', 'у': 'HexUpRight', 'У': 'HexUpRight',
        'KeyW': 'HexUpRight', 'w': 'HexUpRight', 'W': 'HexUpRight', 'ц': 'HexUpRight', 'Ц': 'HexUpRight',
        'KeyA': 'HexLeft', 'a': 'HexLeft', 'A': 'HexLeft', 'ф': 'HexLeft', 'Ф': 'HexLeft',
        'ArrowLeft': 'HexLeft',
        'KeyD': 'HexRight', 'd': 'HexRight', 'D': 'HexRight', 'в': 'HexRight', 'В': 'HexRight',
        'ArrowRight': 'HexRight',
        'KeyZ': 'HexDownLeft', 'z': 'HexDownLeft', 'Z': 'HexDownLeft', 'я': 'HexDownLeft', 'Я': 'HexDownLeft',
        'KeyC': 'HexDownRight', 'c': 'HexDownRight', 'C': 'HexDownRight', 'с': 'HexDownRight', 'С': 'HexDownRight',
        'KeyX': 'HexDownRight', 'x': 'HexDownRight', 'X': 'HexDownRight', 'ч': 'HexDownRight', 'Ч': 'HexDownRight',
        'ArrowUp': 'HexUpRight',
        'ArrowDown': 'HexDownRight'
      };
      const hexDir = hexKeyMap[e.code] || hexKeyMap[e.key];
      if (hexDir) {
        e.preventDefault();
        this.game.handleMove(hexDir);
        return;
      }
    }

    if (Object.keys(DIRECTION_DELTAS).includes(e.key)) {
      e.preventDefault();
      if (LevelEditor.isTesting()) {
        LevelEditor.handleTestMove(e.key);
        return;
      }
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
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < SWIPE_THRESHOLD) {
      this.touchStartX = this.touchStartY = null;
      return;
    }

    const { gridType = 'square' } = StateManager.getGameState();
    if (gridType === 'hex') {
      const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI); // -180 to 180
      let direction = null;
      if (angle >= -30 && angle < 30) {
        direction = 'HexRight';
      } else if (angle >= 30 && angle < 90) {
        direction = 'HexDownRight';
      } else if (angle >= 90 && angle < 150) {
        direction = 'HexDownLeft';
      } else if (angle >= 150 || angle < -150) {
        direction = 'HexLeft';
      } else if (angle >= -150 && angle < -90) {
        direction = 'HexUpLeft';
      } else if (angle >= -90 && angle < -30) {
        direction = 'HexUpRight';
      }
      if (direction) {
        this.game.handleMove(direction);
      }
      this.touchStartX = this.touchStartY = null;
      return;
    }

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
      if (LevelEditor.isTesting()) {
        LevelEditor.handleTestMove(direction);
      } else {
        this.game.handleMove(direction);
      }
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

  handleShowEditorClick() {
    this.game.handleShowEditor();
  }

  handleHideEditorClick() {
    this.game.handleHideEditor();
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

  handleTryAgainAkureClick() {
    this.game.handleTryAgainAkureMode();
  }

  handleTryAnotherAkureClick() {
    this.game.handleTryAnotherAkureMode();
  }

  handleNextAkureLevelClick() {
    this.game.handleNextAkureLevel();
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
    const newGridType = square.dataset.gridType || 'square';
    this.game.handleSizeSelection(newSize, newGridType);
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
