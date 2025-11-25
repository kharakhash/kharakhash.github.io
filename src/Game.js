import { StateManager } from './modules/StateManager.js';
import { ErrorHandler } from './modules/ErrorHandling.js';
import { StorageService } from './modules/StorageService.js';
import { UIService } from './modules/UIService.js';
import { StatisticsService } from './modules/StatisticsService.js';
import { GameLogic } from './modules/GameLogic.js';
import { GridService } from './modules/GridService.js';
import { EventHandler } from './EventHandler.js'; // New EventHandler class
import { DEFAULT_SIZE, INITIAL_TILES, DIRECTION_DELTAS } from './modules/constants.js';

export class Game {
  constructor() {
    this.elements = {};
    this.eventHandler = null; // Будет инициализирован после кэширования элементов
  }

  init() {
    try {
      this.cacheElements();
      this.eventHandler = new EventHandler(this.elements, this); // Передаем elements и экземпляр Game
      this.setupState();
      
      UIService.setElements(this.elements);
      StatisticsService.setElements(this.elements);
      GameLogic.setGameContext(this); // Передаем экземпляр Game в GameLogic

      this.eventHandler.setupEventListeners();
      this.createGrid();

      // Обновить UI после инициализации
      UIService.render(StateManager.getState());
      UIService.highlightCurrentSize(StateManager.getState().size);
    } catch (error) {
      ErrorHandler.handle(error, 'Game.init');
    }
  }

  /**
   * Caches DOM elements for performance.
   */
  cacheElements() {
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
      'tutorialBtn' // Добавляем tutorialBtn, так как он используется
    ];
    
    elementIds.forEach(id => {
      this.elements[id] = document.getElementById(id);
    });
  }

  /**
   * Initializes the application state.
   */
  setupState() {
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
  }

  /**
   * Creates and initializes game grid.
   */
  createGrid() {
    const { size, gameMode } = StateManager.getState();
    const gameField = this.elements.game;
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

    this.placeInitialTiles();
    
    // Save initial grid for Quest mode "Try Again" functionality
    if (gameMode === 'quest') {
      StateManager.setState((prevState) => ({
        initialGrid: GridService.cloneGrid(prevState.grid)
      }));
    }
  }

  /**
   * Places initial tiles on the grid.
   */
  placeInitialTiles() {
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
  }

  // Методы, которые EventBus будет вызывать
  handleMove(direction) {
    GameLogic.move(direction);
  }

  handleRestart() {
    GameLogic.restart();
  }

  handleUndo() {
    GameLogic.undo();
  }

  handleSaveSettings() {
    const { size, selectedSize, gameMode } = StateManager.getState();
    const newGameModeSetting = this.elements.gameModeToggleBtn.checked ? 'quest' : 'infinity';

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
      this.createGrid(); // Re-create grid with new size/mode
    }
    
    StorageService.saveState();
    UIService.hideSettings();
  }

  handleShowStatistics() {
    UIService.showStatistics();
    StatisticsService.renderStatistics();
  }

  handleHideStatistics() {
    UIService.hideStatistics();
  }

  handleClearStatistics() {
    StatisticsService.clearStatistics();
  }

  handleTryAgainQuestMode() {
    GameLogic.tryAgainQuestMode();
  }

  handleTryAnotherQuestMode() {
    GameLogic.tryAnotherQuestMode();
  }

  handleNextQuestLevel() {
    GameLogic.startNextQuestLevel();
  }

  handleShowSettings() {
    UIService.showSettings();
  }

  handleHideSettings() {
    UIService.hideSettings();
  }

  handleThemeToggle(checked) {
    StateManager.setState({ theme: checked ? 'light' : 'dark' });
    StorageService.saveState();
  }

  handleToggleDataValue(checked) {
    StateManager.setState({ showValues: checked });
    StorageService.saveState();
  }

  handleGameModeToggle(checked) {
    // Game mode is applied in handleSaveSettings, this just updates the UI switch state
  }

  handleSizeSelection(newSize) {
    StateManager.setState({ selectedSize: newSize });
    UIService.highlightCurrentSize(newSize);
  }

  handleShowTutorial() {
    UIService.showTutorial();
  }

  handleTutorialSliderChange(value) {
    // TutorialService.setTutorialGridByStep(Number(value)); // Assuming TutorialService exists
  }
}
