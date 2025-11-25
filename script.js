/**
 * Bulb It - A puzzle game
 * Refactored version with improved architecture and code quality
 * @version 2.0.0
 * @author Senior Frontend Developer
 */

import { StateManager } from './src/modules/StateManager.js';
import { ErrorHandler } from './src/modules/ErrorHandling.js';
import { PerformanceUtils } from './src/modules/PerformanceUtils.js';
import { StorageService } from './src/modules/StorageService.js';
import { GridService } from './src/modules/GridService.js';
import { AnimationService } from './src/modules/AnimationService.js';
import { UIService } from './src/modules/UIService.js';
import { StatisticsService } from './src/modules/StatisticsService.js';
import {
  DEFAULT_SIZE,
  INITIAL_TILES,
  DIRECTION_DELTAS,
  SWIPE_THRESHOLD,
} from './src/modules/constants.js';
import { GameLogic } from './src/modules/GameLogic.js';


// === Global Cached DOM Elements ===
const elements = {};

// === Game Setup and Initialization ===
const GameSetup = (() => {
  /**
   * Initializes the application by setting up state, caching elements, and event listeners.
   */
  const init = () => {
    try {
      cacheElements();
      
      // Initialize StateManager with loaded or default state
      const loadedState = StorageService.loadState();
      StateManager.initializeState({
        size: loadedState.size || DEFAULT_SIZE,
        selectedSize: loadedState.selectedSize || DEFAULT_SIZE,
        grid: [],
        history: [],
        score: 0,
        moves: 0,
        levelMoves: 0,
        totalMoves: 0,
        levelScore: 0,
        totalScore: 0,
        disappear: {}, // This property is temporary for animations, not persistent state
        isProcessing: false,
        isOverlayActive: false,
        lastMoveTime: 0,
        touchStartX: null,
        touchStartY: null,
        theme: loadedState.theme || 'dark',
        showValues: loadedState.showValues ?? true,
        gameMode: loadedState.gameMode || 'infinity',
        initialGrid: [], // for quest mode 'try again'
      });

      // Pass elements to modules that need them
      UIService.setElements(elements);
      StatisticsService.setElements(elements);
      // GameLogic does not need `elements` directly, GameValidator will check visibility

      setupEventListeners();
      createGrid();
    } catch (error) {
      ErrorHandler.handle(error, 'GameSetup.init');
    }
  };

  /**
   * Caches DOM elements for performance.
   */
  const cacheElements = () => {
    const elementIds = [
      'gameContainer', 'settingsContainer', 'statisticsContainer', 'score', 'moves',
      'restartBtn', 'undoBtn', 'toggleDataValue', 'themeToggleBtn', 'saveSettingsBtn',
      'statisticsBtn', 'backFromStatisticsBtn', 'recordMoves', 'recordScore',
      'totalMoves', 'totalScore', 'gamesList', 'clearStatisticsBtn',
      'gameOverPopup', 'tryAgainBtn', 'tryAnotherBtn', 'gameModeToggleBtn',
      'questWinPopup', 'winMoves', 'winScore', 'nextQuestLevelBtn',
      'infinityScoreDisplay', 'questScoreDisplay', 'levelMoves', 'totalMovesDisplay',
      'levelScore', 'totalScoreDisplay', 'game', 'scoreContainer',
      'settingsBtn', 'cancelSettingsBtn', 'tutorialContainer', 'tutorialSlider',
      // Add other elements that are used by UIService or StatisticsService
    ];
    
    elementIds.forEach(id => {
      elements[id] = document.getElementById(id);
    });
  };

  /**
   * Sets up all event listeners.
   */
  const setupEventListeners = () => {
    // Game controls
    window.addEventListener('keydown', ErrorHandler.wrap(EventHandler.handleKeyDown, 'keydown'));
    window.addEventListener('touchstart', ErrorHandler.wrap(EventHandler.handleTouchStart, 'touchstart'));
    window.addEventListener('touchend', ErrorHandler.wrap(EventHandler.handleTouchEnd, 'touchend'));
    
    // Button events
    elements.restartBtn?.addEventListener('click', ErrorHandler.wrap(EventHandler.handleRestartClick, 'restartBtn.click'));
    elements.undoBtn?.addEventListener('click', ErrorHandler.wrap(EventHandler.handleUndoClick, 'undoBtn.click'));
    elements.saveSettingsBtn?.addEventListener('click', ErrorHandler.wrap(EventHandler.handleSaveSettingsClick, 'saveSettingsBtn.click'));
    elements.statisticsBtn?.addEventListener('click', ErrorHandler.wrap(EventHandler.handleShowStatisticsClick, 'statisticsBtn.click'));
    elements.backFromStatisticsBtn?.addEventListener('click', ErrorHandler.wrap(EventHandler.handleHideStatisticsClick, 'backFromStatisticsBtn.click'));
    elements.clearStatisticsBtn?.addEventListener('click', ErrorHandler.wrap(EventHandler.handleClearStatisticsClick, 'clearStatisticsBtn.click'));
    elements.tryAgainBtn?.addEventListener('click', ErrorHandler.wrap(EventHandler.handleTryAgainClick, 'tryAgainBtn.click'));
    elements.tryAnotherBtn?.addEventListener('click', ErrorHandler.wrap(EventHandler.handleTryAnotherClick, 'tryAnotherBtn.click'));
    elements.nextQuestLevelBtn?.addEventListener('click', ErrorHandler.wrap(EventHandler.handleNextQuestLevelClick, 'nextQuestLevelBtn.click'));
    elements.settingsBtn?.addEventListener('click', ErrorHandler.wrap(EventHandler.handleShowSettingsClick, 'settingsBtn.click'));
    elements.cancelSettingsBtn?.addEventListener('click', ErrorHandler.wrap(EventHandler.handleHideSettingsClick, 'cancelSettingsBtn.click'));
    
    // Theme and value display toggles
    elements.themeToggleBtn?.addEventListener('change', ErrorHandler.wrap(EventHandler.handleThemeToggleChange, 'themeToggleBtn.change'));
    elements.toggleDataValue?.addEventListener('change', ErrorHandler.wrap(EventHandler.handleToggleDataValueChange, 'toggleDataValue.change'));
    elements.gameModeToggleBtn?.addEventListener('change', ErrorHandler.wrap(EventHandler.handleGameModeToggleChange, 'gameModeToggleBtn.change'));
    
    // Size selection
    setupSizeSelection();
    
    // Tutorial events (if tutorialContainer exists in index.html)
    const tutorialBtn = document.getElementById('tutorialBtn'); // Tutorial button might not be in cached elements
    tutorialBtn?.addEventListener('click', ErrorHandler.wrap(EventHandler.handleShowTutorialClick, 'tutorialBtn.click'));
    elements.tutorialSlider?.addEventListener('input', ErrorHandler.wrap(EventHandler.handleTutorialSliderChange, 'tutorialSlider.input'));
  };

  /**
   * Sets up size selection event listeners.
   */
  const setupSizeSelection = () => {
    const sizeSquares = document.querySelectorAll('.size-square');
    sizeSquares.forEach(square => {
      square.addEventListener('click', ErrorHandler.wrap(() => {
        const newSize = parseInt(square.dataset.size, 10);
        StateManager.setState({ selectedSize: newSize });
        UIService.highlightCurrentSize(newSize); // Update UI immediately
      }, 'size.selection'));
    });
  };

  /**
   * Creates and initializes game grid.
   */
  const createGrid = () => {
    const { size, gameMode } = StateManager.getState();
    const gameField = elements.game;
    if (!gameField) return;
    
    gameField.innerHTML = '';
    gameField.style.display = 'grid';
    gameField.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    gameField.style.gridTemplateRows = `repeat(${size}, 1fr)`;

    // Create grid cells
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.id = `cell-${r}-${c}`;
        gameField.appendChild(cell);
      }
    }

    placeInitialTiles();
    
    // Save initial grid for Quest mode "Try Again" functionality
    if (gameMode === 'quest') {
      StateManager.setState((prevState) => ({
        initialGrid: GridService.cloneGrid(prevState.grid)
      }));
    }
  };

  /**
   * Places initial tiles on the grid.
   */
  const placeInitialTiles = () => {
    const { size } = StateManager.getState();
    const positions = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        positions.push([r, c]);
      }
    }
    
    // Shuffle positions for random placement
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    const initialTiles = INITIAL_TILES[size] || [64, 32, 16];
    
    StateManager.setState((prevState) => {
      const newGrid = GridService.createEmptyGrid(size); // Start with empty grid
      initialTiles.forEach((value, index) => {
        if (index < positions.length) {
          const [r, c] = positions[index];
          newGrid[r][c] = value;
        }
      });
      return { grid: newGrid };
    });
  };

  return {
    init,
    createGrid, // Exported for GameLogic to use on restart/next level
    placeInitialTiles, // Exported for GameLogic
  };
})();

// === Event Handler Module ===
const EventHandler = (() => {
  let touchStartX = null;
  let touchStartY = null;

  const handleKeyDown = (e) => {
    if (Object.keys(DIRECTION_DELTAS).includes(e.key)) {
      e.preventDefault();
      GameLogic.move(e.key);
    }
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === null || touchStartY === null) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
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
      GameLogic.move(direction);
    }
    
    touchStartX = touchStartY = null;
  };

  const handleRestartClick = () => GameLogic.restart();
  const handleUndoClick = () => GameLogic.undo();

  const handleSaveSettingsClick = () => {
    const { size, selectedSize, gameMode } = StateManager.getState();
    const newGameModeSetting = elements.gameModeToggleBtn.checked ? 'quest' : 'infinity';

    if (size !== selectedSize || gameMode !== newGameModeSetting) {
      GameLogic._saveCurrentGameStats(StateManager.getState()); // Save current game before changing size or mode
      StateManager.setState({ 
        size: selectedSize, 
        gameMode: newGameModeSetting,
        // Reset game-specific state when size/mode changes
        moves: 0,
        score: 0,
        levelMoves: 0,
        totalMoves: 0,
        levelScore: 0,
        totalScore: 0,
        history: [],
        isProcessing: false,
        initialGrid: [],
      });
      GameSetup.createGrid(); // Re-create grid with new size/mode
    }
    
    StorageService.saveState();
    UIService.hideSettings();
  };

  const handleShowStatisticsClick = () => {
    UIService.showStatistics();
    StatisticsService.renderStatistics(); // Render stats when showing panel
  };
  const handleHideStatisticsClick = () => UIService.hideStatistics();
  const handleClearStatisticsClick = () => StatisticsService.clearStatistics();
  const handleTryAgainClick = () => GameLogic.tryAgainQuestMode();
  const handleTryAnotherClick = () => GameLogic.tryAnotherQuestMode();
  const handleNextQuestLevelClick = () => GameLogic.startNextQuestLevel();
  const handleShowSettingsClick = () => UIService.showSettings();
  const handleHideSettingsClick = () => UIService.hideSettings();
  
  const handleThemeToggleChange = () => {
    StateManager.setState((prevState) => ({
      theme: elements.themeToggleBtn.checked ? 'light' : 'dark'
    }));
    StorageService.saveState();
  };

  const handleToggleDataValueChange = () => {
    StateManager.setState((prevState) => ({
      showValues: elements.toggleDataValue.checked
    }));
    StorageService.saveState();
  };

  const handleGameModeToggleChange = () => {
    // State is updated in handleSaveSettingsClick, UI will reflect on render
    // No need to set state here, just save it for settings persistence
  };

  const handleShowTutorialClick = () => {
    UIService.showTutorial();
    // TutorialService.resetTutorialGrid(); // Assuming TutorialService exists
  };

  const handleTutorialSliderChange = () => {
    // TutorialService.setTutorialGridByStep(Number(elements.tutorialSlider.value)); // Assuming TutorialService exists
  };

  return {
    handleKeyDown,
    handleTouchStart,
    handleTouchEnd,
    handleRestartClick,
    handleUndoClick,
    handleSaveSettingsClick,
    handleShowStatisticsClick,
    handleHideStatisticsClick,
    handleClearStatisticsClick,
    handleTryAgainClick,
    handleTryAnotherClick,
    handleNextQuestLevelClick,
    handleShowSettingsClick,
    handleHideSettingsClick,
    handleThemeToggleChange,
    handleToggleDataValueChange,
    handleGameModeToggleChange,
    handleShowTutorialClick,
    handleTutorialSliderChange,
  };
})();

// === Initial Game Load ===
document.addEventListener('DOMContentLoaded', () => {
  GameSetup.init();
});
