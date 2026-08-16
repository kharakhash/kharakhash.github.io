import { StateManager } from './modules/StateManager.js';
import { ErrorHandler } from './modules/ErrorHandling.js';
import { StorageService } from './modules/StorageService.js';
import { UIService } from './modules/UIService.js';
import { StatisticsService } from './modules/StatisticsService.js';
import { GameLogic } from './modules/GameLogic.js';
import { GridService } from './modules/GridService.js';
import { AnimationService } from './modules/AnimationService.js';
import { EventHandler } from './EventHandler.js';
import { DEFAULT_SIZE, INITIAL_TILES, ANIMATION_DURATION } from './modules/constants.js';

export class Game {
  constructor() {
    this.elements = {};
    this.eventHandler = null;
  }

  init() {
    try {
      this.cacheElements();
      this.eventHandler = new EventHandler(this.elements, this);
      this.setupState();
      
      UIService.setElements(this.elements);
      StatisticsService.setElements(this.elements);

      this.eventHandler.setupEventListeners();
      this.createGrid();

      // Refresh UI after initialization
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
      'gameOverPopup', 'questFailPopup', 'tryAgainBtn', 'tryAnotherBtn', 'tryAnotherInfinityBtn', 'gameModeToggleBtn',
      'questWinPopup', 'winMoves', 'winScore', 'nextQuestLevelBtn',
      'infinityScoreDisplay', 'questScoreDisplay', 'levelMoves', 'totalMovesDisplay',
      'levelScore', 'totalScoreDisplay', 'game', 'scoreContainer',
      'settingsBtn', 'cancelSettingsBtn'
    ];
    
    for (const id of elementIds) {
      this.elements[id] = document.getElementById(id);
    }
  }

  /**
   * Initializes the application state.
   */
  setupState() {
    const loadedState = StorageService.loadState();
    StateManager.initializeState({
      game: {
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
        lastMoveTime: 0,
        touchStartX: null,
        touchStartY: null,
        initialGrid: [],
      },
      ui: {
        theme: loadedState.theme || 'dark',
        showValues: loadedState.showValues ?? true,
        gameMode: loadedState.gameMode || 'infinity',
        isOverlayActive: false,
      }
    });
  }

  /**
   * Creates and initializes game grid.
   */
  createGrid() {
    const { size } = StateManager.getGameState();
    const { gameMode } = StateManager.getUIState();
    const gameField = this.elements.game;
    if (!gameField) return;
    
    gameField.innerHTML = '';
    gameField.style.display = 'grid';
    gameField.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    gameField.style.gridTemplateRows = `repeat(${size}, 1fr)`;

    // Create grid cells
    const cellMatrix = Array.from({ length: size }, () => Array(size).fill(null));
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.id = `cell-${r}-${c}`;
        gameField.appendChild(cell);
        cellMatrix[r][c] = cell;
      }
    }
    this.elements.cells = cellMatrix;

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
    const { size } = StateManager.getGameState();
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
    
    StateManager.setState(() => {
      const newGrid = GridService.createEmptyGrid(size);
      for (let index = 0; index < initialTiles.length; index++) {
        if (index < positions.length) {
          const [r, c] = positions[index];
          newGrid[r][c] = initialTiles[index];
        }
      }
      return { grid: newGrid };
    });
  }

  // --- Animation coordination (moved from GameLogic) ---

  /**
   * Plays split animations for the given actions.
   * @param {Array} splitActions - Split metadata from GameCore.
   */
  _animateSplitActions(splitActions) {
    if (!splitActions || splitActions.length === 0) return;
    for (const action of splitActions) {
      const targetRow = action.to ? action.to.row : action.from.row;
      const targetCol = action.to ? action.to.col : action.from.col;
      AnimationService.animateSplitAppear(
        action.from.row, action.from.col,
        targetRow, targetCol,
        action.value, action.deltaRow, action.deltaCol,
        this.elements
      );
      AnimationService.animateCellSplit(
        action.from.row, action.from.col,
        action.deltaRow, action.deltaCol,
        this.elements
      );
    }
  }

  /**
   * Schedules disappearing cell animations and delegates state update to GameLogic.
   * @param {Array} disappearingCells - Cells that should disappear.
   */
  _handleDisappearingCells(disappearingCells) {
    if (!disappearingCells || disappearingCells.length === 0) {
      GameLogic.processDisappearingCells(disappearingCells);
      return;
    }

    setTimeout(() => {
      // Animate removal
      for (const { row, col } of disappearingCells) {
        AnimationService.animateAndRemoveCell(row, col, this.elements);
      }
      // Delegate state update to GameLogic
      GameLogic.processDisappearingCells(disappearingCells);
    }, ANIMATION_DURATION * 2); // Slightly longer than animation duration to ensure completion
  }

    /**
   * Plays appearing animation for a newly spawned random cell.
   * @param {Object|undefined} spawnedCell - Spawned cell info.
   */
  _animateRandomCell(spawnedCell) {
    if (!spawnedCell) return;
    const { row, col } = spawnedCell.position;
    const cellElement = this.elements.cells?.[row]?.[col]
      || document.getElementById(`cell-${row}-${col}`);
    if (cellElement) {
      AnimationService.animateCellAppearing(cellElement);
    }
  }

  /**
   * Interprets an intent returned by GameLogic.
   * @param {{ action: string } | null} intent
   */
  _handleIntent(intent) {
    if (intent && intent.action === 'PLACE_INITIAL_TILES') {
      this.placeInitialTiles();
    }
  }

  // --- Event handlers (called by EventHandler) ---

  handleMove(direction) {
    const result = GameLogic.move(direction, this.elements);
    if (!result) return;
    // Coordinate animations
    this._animateSplitActions(result.effects.splitActions);
    this._animateRandomCell(result.effects.spawnedCell);
    this._handleDisappearingCells(result.effects.disappearingCells);
  }

  handleRestart() {
    this._handleIntent(GameLogic.restart());
  }

  handleUndo() {
    GameLogic.undo();
  }

  handleSaveSettings() {
    const { game, ui } = StateManager.getState();
    const { size, selectedSize } = game;
    const { gameMode } = ui;
    const newGameModeSetting = this.elements.gameModeToggleBtn.checked ? 'quest' : 'infinity';

    if (size !== selectedSize || gameMode !== newGameModeSetting) {
      GameLogic.saveCurrentGameStats(StateManager.getState());
      StateManager.setState({ 
        size: selectedSize, 
        gameMode: newGameModeSetting,
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
      this.createGrid();
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
    this._handleIntent(GameLogic.tryAgainQuestMode());
  }

  handleTryAnotherQuestMode() {
    this._handleIntent(GameLogic.tryAnotherQuestMode());
  }

  handleNextQuestLevel() {
    this._handleIntent(GameLogic.startNextQuestLevel());
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
}
