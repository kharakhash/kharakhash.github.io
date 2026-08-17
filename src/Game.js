import { StateManager } from './modules/StateManager.js';
import { ErrorHandler } from './modules/ErrorHandling.js';
import { StorageService } from './modules/StorageService.js';
import { UIService } from './modules/UIService.js';
import { StatisticsService } from './modules/StatisticsService.js';
import { GameLogic } from './modules/GameLogic.js';
import { GridService } from './modules/GridService.js';
import { AnimationService } from './modules/AnimationService.js';
import { LevelEditor } from './levels-builder/LevelEditor.js';
import { EventHandler } from './EventHandler.js';
import { AkureLevelGenerator } from './modules/AkureLevelGenerator.js';
import { DEFAULT_SIZE, INITIAL_TILES, AKURE_INITIAL_TILES, ANIMATION_DURATION } from './modules/constants.js';

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
      LevelEditor.init(this.elements, this);

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
      'gameContainer', 'settingsContainer', 'statisticsContainer', 'editorContainer',
      'score', 'moves', 'restartBtn', 'undoBtn', 'toggleDataValue', 'themeToggleBtn', 'saveSettingsBtn',
      'statisticsBtn', 'backFromStatisticsBtn', 'recordMoves', 'recordScore',
      'totalMoves', 'totalScore', 'gamesList', 'clearStatisticsBtn',
      'editorBtn', 'backFromEditorBtn', 'editorCanvas', 'editorLevelName', 'editorModeBadge',
      'editorDslOutput', 'editorTabInitial', 'editorTabWin', 'editorSaveBtn', 'editorPlayBtn',
      'editorImportDslBtn', 'editorCopyDslBtn', 'editorClearBtn', 'editorSavedLevelsList',
      'modeCarouselPrevBtn', 'modeCarouselNextBtn', 'modeCarouselTitle', 'modeCarouselBadge', 'modeCarouselDesc',
      'burgerMenuBtn', 'burgerMenuOverlay', 'burgerMenuBackdrop', 'closeBurgerMenuBtn',
      'menuSettingsBtn', 'menuStatsBtn', 'menuEditorBtn',
      'gameOverPopup', 'questFailPopup', 'tryAgainBtn', 'tryAnotherBtn', 'tryAnotherInfinityBtn',
      'questWinPopup', 'winMoves', 'winScore', 'nextQuestLevelBtn',
      'akureWinPopup', 'akureWinMoves', 'akureWinScore', 'nextAkureLevelBtn',
      'akureFailPopup', 'tryAgainAkureBtn', 'tryAnotherAkureBtn',
      'infinityScoreDisplay', 'questScoreDisplay', 'akureScoreDisplay',
      'levelMoves', 'totalMovesDisplay', 'levelScore', 'totalScoreDisplay',
      'akureFilled', 'akureLevelMoves', 'akureLevelScore', 'akureLevelBadge',
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
        isOverlayActive: false,
      }
    });
  }

  /**
   * Creates and initializes game grid.
   */
  createGrid() {
    const { size, cellTypes } = StateManager.getGameState();
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
    
    // Save initial grid for Quest / Akure mode "Try Again" functionality
    if (gameMode === 'quest' || gameMode === 'akure') {
      StateManager.setState((prevState) => ({
        initialGrid: GridService.cloneGrid(prevState.grid)
      }));
    }
  }

  /**
   * Places initial tiles on the grid based on mode or custom layout.
   */
  placeInitialTiles() {
    const { size, cellTypes, customLevelName, akureModeType, akureQuestLevel } = StateManager.getGameState();
    const { gameMode } = StateManager.getUIState();
    
    if (gameMode === 'akure') {
      if (customLevelName) return;

      const currentQuestLvl = StorageService.getAkureQuestLevel() || akureQuestLevel || 1;
      const levelData = akureModeType === 'quest'
        ? AkureLevelGenerator.getLevel(currentQuestLvl)
        : AkureLevelGenerator.generateRandomLevel(size, cellTypes);

      const lvlSize = levelData.size || size;
      const lvlCellTypes = levelData.cellTypes || GridService.createEmptyGrid(lvlSize, 'active');
      const newGrid = GridService.createEmptyGrid(lvlSize);

      if (Array.isArray(levelData.initialTiles)) {
        for (const tile of levelData.initialTiles) {
          if (GridService.isValidPosition(tile.row, tile.col, lvlSize, lvlCellTypes)) {
            newGrid[tile.row][tile.col] = tile.value;
          }
        }
      }

      StateManager.setState({
        size: lvlSize,
        cellTypes: lvlCellTypes,
        akureMaxMoves: levelData.maxMoves || null,
        akureQuestLevel: currentQuestLvl,
        grid: newGrid,
        initialGrid: GridService.cloneGrid(newGrid),
        levelMoves: 0,
        levelScore: 0,
        history: [],
      });
      return;
    }

    const playablePositions = GridService.getAllPlayableCells(size, cellTypes);
    
    // Shuffle playable positions for random placement
    const positions = [...playablePositions];
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
      return { 
        grid: newGrid,
        initialGrid: GridService.cloneGrid(newGrid)
      };
    });
  }

  /**
   * Loads and starts playing a custom-designed level from the Level Editor.
   * @param {Object} levelData
   */
  loadAndPlayCustomLevel(levelData) {
    const { size, mode, cellTypes, initialGrid, lockedCells, winConditionGrid, name } = levelData;

    StateManager.setState({
      size,
      selectedSize: size,
      gameMode: mode,
      cellTypes: cellTypes.map(row => [...row]),
      lockedCells: [...lockedCells],
      winConditionGrid: winConditionGrid ? winConditionGrid.map(row => [...row]) : null,
      customLevelName: name,
      moves: 0,
      score: 0,
      levelMoves: 0,
      totalMoves: 0,
      levelScore: 0,
      totalScore: 0,
      history: [],
      isProcessing: false,
      grid: GridService.cloneGrid(initialGrid),
      initialGrid: GridService.cloneGrid(initialGrid),
    });

    this.createGrid();
    // Directly place custom initial grid
    StateManager.setState({ grid: GridService.cloneGrid(initialGrid) });
    UIService.hideEditor();
    UIService.render(StateManager.getState());
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
    const { size, selectedSize } = game;
    const { gameMode } = ui;
    const newGameMode = UIService.getCurrentCarouselMode();

    if (size !== selectedSize || gameMode !== newGameMode) {
      GameLogic.saveCurrentGameStats(StateManager.getState());
      StateManager.setState({ 
        size: selectedSize, 
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

  handleShowEditor() {
    UIService.showEditor();
    LevelEditor.render();
  }

  handleHideEditor() {
    UIService.hideEditor();
  }

  handleCarouselStep(direction) {
    const newMode = UIService.stepCarousel(direction);
    LevelEditor.setMode(newMode === 'akure' ? 'akure' : 'quest');
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

  handleTryAgainAkureMode() {
    this._handleIntent(GameLogic.tryAgainAkureMode());
  }

  handleTryAnotherAkureMode() {
    this._handleIntent(GameLogic.tryAnotherAkureMode());
  }

  handleNextAkureLevel() {
    this._handleIntent(GameLogic.startNextAkureLevel());
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

  handleSizeSelection(newSize) {
    StateManager.setState({ selectedSize: newSize });
    UIService.highlightCurrentSize(newSize);
  }
}

