import { StateManager } from './modules/StateManager.js';
import { ErrorHandler } from './modules/ErrorHandling.js';
import { StorageService } from './modules/StorageService.js';
import { UIService } from './modules/UIService.js';
import { StatisticsService } from './modules/StatisticsService.js';
import { GameLogic } from './modules/GameLogic.js';
import { GridService } from './modules/GridService.js';
import { AnimationService } from './modules/AnimationService.js';
import { EventHandler } from './EventHandler.js';
import { I18nService } from './modules/I18nService.js';
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
      
      const { language = 'uk' } = StateManager.getUIState();
      I18nService.setLanguage(language);

      UIService.setElements(this.elements);
      StatisticsService.setElements(this.elements);

      this.eventHandler.setupEventListeners();
      this.createGrid();

      // Refresh UI after initialization
      const currentState = StateManager.getState();
      UIService.render(currentState);
      UIService.highlightCurrentSize(currentState.size, currentState.gridType);
    } catch (error) {
      ErrorHandler.handle(error, 'Game.init');
    }
  }

  /**
   * Caches DOM elements for performance.
   */
  cacheElements() {
    const elementIds = [
      'gameContainer', 'settingsContainer', 'statisticsContainer',
      'score', 'moves', 'restartBtn', 'undoBtn', 'toggleDataValue', 'themeToggleBtn', 'saveSettingsBtn',
      'statisticsBtn', 'backFromStatisticsBtn', 'recordMoves', 'recordScore',
      'totalMoves', 'totalScore', 'gamesList', 'clearStatisticsBtn',
      'modeCarouselPrevBtn', 'modeCarouselNextBtn', 'modeCarouselTitle', 'modeCarouselBadge', 'modeCarouselDesc',
      'burgerMenuBtn', 'burgerMenuOverlay', 'burgerMenuBackdrop', 'closeBurgerMenuBtn',
      'menuSettingsBtn', 'menuStatsBtn',
      'gameOverPopup', 'questFailPopup', 'tryAgainBtn', 'tryAnotherBtn', 'tryAnotherInfinityBtn',
      'questWinPopup', 'winMoves', 'winScore', 'nextQuestLevelBtn',
      'infinityScoreDisplay', 'questScoreDisplay',
      'levelMoves', 'totalMovesDisplay', 'levelScore', 'totalScoreDisplay',
      'game', 'scoreContainer', 'settingsBtn', 'cancelSettingsBtn'
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
        selectedSize: loadedState.size || DEFAULT_SIZE,
        gridType: loadedState.gridType || 'square',
        selectedGridType: loadedState.selectedGridType || loadedState.gridType || 'square',
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
        cellTypes: [],
        lockedCells: [],
        winConditionGrid: null,
        customLevelName: null,
      },
      ui: {
        theme: loadedState.theme || 'dark',
        showValues: loadedState.showValues ?? true,
        gameMode: loadedState.gameMode || 'infinity',
        language: loadedState.language || 'uk',
        isOverlayActive: false,
      }
    });
  }

  /**
   * Creates and initializes game grid.
   */
  createGrid() {
    const { size, cellTypes, gridType = 'square' } = StateManager.getGameState();
    const { gameMode } = StateManager.getUIState();
    const gameField = this.elements.game;
    if (!gameField) return;
    
    gameField.innerHTML = '';
    gameField.dataset.size = String(size);
    gameField.dataset.gridType = gridType;

    gameField.style.display = 'grid';
    gameField.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    gameField.style.gridTemplateRows = `repeat(${size}, 1fr)`;

    const cellMatrix = Array.from({ length: size }, () => Array(size).fill(null));
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.id = `cell-${r}-${c}`;
        
        if (cellTypes && cellTypes[r]?.[c] === 'inactive') {
          cell.classList.add('cell-inactive');
        } else if (cellTypes && cellTypes[r]?.[c] === 'medium') {
          cell.classList.add('cell-medium');
        }

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
   * Places initial tiles on the grid based on mode.
   */
  placeInitialTiles() {
    const { size, cellTypes, gridType = 'square' } = StateManager.getGameState();

    const playablePositions = GridService.getAllPlayableCells(size, cellTypes, gridType);
    
    // Shuffle playable positions for random placement
    const positions = [...playablePositions];
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    const initialTiles = INITIAL_TILES[size] || [64, 32, 16];
    
    StateManager.setState(() => {
      const newGrid = GridService.createEmptyGrid(size, null, gridType);
      for (let index = 0; index < initialTiles.length; index++) {
        if (index < positions.length) {
          const [r, c] = positions[index];
          newGrid[r][c] = initialTiles[index];
        }
      }
      return { 
        grid: newGrid,
        initialGrid: GridService.cloneGrid(newGrid)
      };
    });
  }

  // --- Animation coordination ---

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
   * Coordinates animations sequentially:
   * 1. Split animations run immediately (duration: ANIMATION_DURATION)
   * 2. Disappearing animations run (duration: ANIMATION_DURATION)
   * 3. Appearing animation runs strictly AFTER disappearing completes
   * @param {Array<{row: number, col: number}>} disappearingCells
   * @param {Object|undefined} spawnedCell
   */
  _handleMoveAnimations(disappearingCells, spawnedCell) {
    const hasDisappearing = disappearingCells && disappearingCells.length > 0;

    if (hasDisappearing) {
      // Step 2: Start disappearing animation after split completes
      setTimeout(() => {
        for (const { row, col } of disappearingCells) {
          AnimationService.animateAndRemoveCell(row, col, this.elements);
        }
        // State update when disappearing cells are cleared
        GameLogic.processDisappearingCells(disappearingCells);

        // Step 3: Appearing starts strictly AFTER disappearing has finished
        setTimeout(() => {
          if (spawnedCell) {
            GameLogic.applySpawnedCell(spawnedCell);
            this._animateRandomCell(spawnedCell);
          }
        }, ANIMATION_DURATION);
      }, ANIMATION_DURATION * 2);
    } else {
      // No disappearing cells: update status immediately
      GameLogic.processDisappearingCells(disappearingCells);

      // Step 3: Appearing starts after split animation completes
      setTimeout(() => {
        if (spawnedCell) {
          GameLogic.applySpawnedCell(spawnedCell);
          this._animateRandomCell(spawnedCell);
        }
      }, ANIMATION_DURATION);
    }
  }

  _animateRandomCell(spawnedCell) {
    if (!spawnedCell) return;
    const { row, col } = spawnedCell.position;
    const { showValues } = StateManager.getUIState();
    const cellElement = this.elements.cells?.[row]?.[col]
      || document.getElementById(`cell-${row}-${col}`);
    if (cellElement) {
      cellElement.classList.remove('cell-null');
      cellElement.dataset.value = String(spawnedCell.value ?? '');
      if (showValues) {
        cellElement.textContent = spawnedCell.value ? String(Math.log2(spawnedCell.value) - 1) : '';
      } else {
        cellElement.textContent = '';
      }
      AnimationService.animateCellAppearing(cellElement);
    }
  }

  _handleIntent(intent) {
    if (intent && intent.action === 'PLACE_INITIAL_TILES') {
      this.placeInitialTiles();
    }
  }

  // --- Event handlers (called by EventHandler) ---

  handleMove(direction) {
    const result = GameLogic.move(direction, this.elements);
    if (!result) return;
    this._animateSplitActions(result.effects.splitActions);
    this._handleMoveAnimations(result.effects.disappearingCells, result.effects.spawnedCell);
  }

  handleRestart() {
    this._handleIntent(GameLogic.restart());
  }

  handleUndo() {
    GameLogic.undo();
  }

  handleSaveSettings() {
    const { game, ui } = StateManager.getState();
    const { size, selectedSize, gridType = 'square', selectedGridType = 'square' } = game;
    const { gameMode } = ui;
    const newGameMode = UIService.getCurrentCarouselMode();

    if (size !== selectedSize || gridType !== selectedGridType || gameMode !== newGameMode) {
      GameLogic.saveCurrentGameStats(StateManager.getState());
      StateManager.setState({ 
        size: selectedSize, 
        gridType: selectedGridType,
        gameMode: newGameMode,
        moves: 0,
        score: 0,
        levelMoves: 0,
        totalMoves: 0,
        levelScore: 0,
        totalScore: 0,
        history: [],
        isProcessing: false,
        initialGrid: [],
        cellTypes: [],
        lockedCells: [],
        winConditionGrid: null,
        customLevelName: null,
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

  handleCarouselStep(direction) {
    UIService.stepCarousel(direction);
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

  handleSizeSelection(newSize, newGridType = 'square') {
    StateManager.setState({ selectedSize: newSize, selectedGridType: newGridType });
    UIService.highlightCurrentSize(newSize, newGridType);
  }

  handleLanguageChange(lang) {
    StateManager.setState({ language: lang });
    I18nService.setLanguage(lang);
    StorageService.saveState();
  }
}

