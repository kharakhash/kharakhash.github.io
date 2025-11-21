/**
 * Bulb It - A puzzle game
 * Refactored version with improved architecture and code quality
 * @version 2.0.0
 * @author Senior Frontend Developer
 */

// === Constants ===
const ANIMATION_DURATION = 300;
const DEFAULT_SIZE = 9;
const DEBOUNCE_TIME = 310;
const MAX_HISTORY_SIZE = 30;
const SWIPE_THRESHOLD = 30;
const RANDOM_CELL_PROBABILITY = {
  SMALL_GRID: 0.01,
  LARGE_GRID: 0.05
};

// Performance optimization constants
const BATCH_UPDATE_DELAY = 16; // ~60fps
const DOM_CACHE_REFRESH_INTERVAL = 1000;

// Initial tile values by grid size
const INITIAL_TILES = {
  4: [64, 32, 16, 8],
  5: [256, 128, 64, 32, 8],
  7: [2048, 1024, 512, 128, 64, 32, 32],
  9: [2048, 1024, 1024, 512, 512, 256, 128],
  11: [4096, 2048, 2048, 2048, 1024, 1024, 1024, 512, 256]
};

// Random tile values by grid size
const RANDOM_TILE_VALUES = {
  4: () => Math.random() < 0.8 ? 32 : 64,
  5: () => Math.random() < 0.8 ? 64 : 128,
  7: () => Math.random() < 0.8 ? 1024 : 512,
  9: () => 2048,
  11: () => 2048
};

// Direction deltas for movement
const DIRECTION_DELTAS = {
  'ArrowUp': [-1, 0],
  'ArrowDown': [1, 0],
  'ArrowLeft': [0, -1],
  'ArrowRight': [0, 1]
};

// Animation class mappings
const ANIMATION_CLASSES = {
  SPLIT_DIRECTIONS: {
    1: 'split-appear-down',
    [-1]: 'split-appear-up',
    [0]: { 1: 'split-appear-right', [-1]: 'split-appear-left' }
  }
};

/**
 * @typedef {Object} GameState
 * @property {number} size - Grid size
 * @property {number} selectedSize - Selected size in settings
 * @property {Array<Array<number|null>>} grid - Game grid
 * @property {Array} history - Move history for undo
 * @property {number} score - Current score
 * @property {number} moves - Number of moves made
 * @property {Object} disappear - Cells marked for disappearing
 * @property {boolean} isProcessing - Processing move flag
 * @property {boolean} isOverlayActive - Overlay active flag
 * @property {number} lastMoveTime - Last move timestamp
 */

/**
 * @typedef {Object} Position
 * @property {number} row - Row index
 * @property {number} col - Column index
 */

// Game application using module pattern for better organization
const BulbGame = (() => {
  // === State Management ===
  /** @type {GameState} */
  const state = {
    size: DEFAULT_SIZE,
    selectedSize: DEFAULT_SIZE,
    grid: [],
    history: [],
    score: 0,
    moves: 0,
    disappear: {},
    isProcessing: false,
    isOverlayActive: false,
    lastMoveTime: 0,
    touchStartX: null,
    touchStartY: null,
    theme: 'dark',
    showValues: true
  };

  // === DOM Elements (Cached) ===
  const elements = {};

  // === Error Handler ===
  const ErrorHandler = {
    /**
     * Handles and logs errors
     * @param {Error} error - Error object
     * @param {string} context - Context where error occurred
     */
    handle(error, context) {
      console.error(`[BulbGame:${context}]`, error);
      // Could integrate with error reporting service here
    },

    /**
     * Wraps function with error handling
     * @param {Function} fn - Function to wrap
     * @param {string} context - Context name
     * @returns {Function} Wrapped function
     */
    wrap(fn, context) {
      return (...args) => {
        try {
          return fn.apply(this, args);
        } catch (error) {
          this.handle(error, context);
        }
      };
    }
  };

  // === Game Validator ===
  const GameValidator = {
    /**
     * Validates grid position
     * @param {number} row - Row index
     * @param {number} col - Column index
     * @returns {boolean} Is valid position
     */
    isValidPosition(row, col) {
      return Number.isInteger(row) && Number.isInteger(col) &&
             row >= 0 && row < state.size && 
             col >= 0 && col < state.size;
    },

    /**
     * Validates cell value for splitting
     * @param {number|null} value - Cell value
     * @returns {boolean} Can split
     */
    canSplit(value) {
      return typeof value === 'number' && value >= 2;
    },

    /**
     * Validates game state for move execution
     * @returns {boolean} Can execute move
     */
    canExecuteMove() {
      const now = Date.now();
      return !state.isProcessing &&
             !state.isOverlayActive &&
             (now - state.lastMoveTime) >= DEBOUNCE_TIME &&
             !this.isOverlayVisible();
    },

    /**
     * Checks if any overlay is currently visible
     * @returns {boolean} Overlay visible
     */
    isOverlayVisible() {
      return elements.settingsContainer?.style.display === 'flex' ||
             elements.statisticsContainer?.style.display === 'flex';
    }
  };

  // === Performance Utilities ===
  const PerformanceUtils = {
    /**
     * Debounced function executor
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    /**
     * Batches DOM updates using RAF
     * @param {Function} callback - Update callback
     */
    batchUpdate(callback) {
      requestAnimationFrame(() => {
        callback();
      });
    }
  };

  // === Storage Service ===
  const StorageService = {
    /**
     * Saves current game state to localStorage
     */
    saveState() {
      try {
        const stateToSave = {
          size: state.size,
          theme: state.theme,
          showValues: state.showValues
        };

        Object.entries(stateToSave).forEach(([key, value]) => {
          localStorage.setItem(key === 'size' ? 'SIZE' : key, 
                             typeof value === 'boolean' ? String(value) : value);
        });
      } catch (error) {
        ErrorHandler.handle(error, 'StorageService.saveState');
      }
    },

    /**
     * Loads game state from localStorage
     */
    loadState() {
      try {
        // Load grid size
        const savedSize = localStorage.getItem('SIZE');
        if (savedSize && !isNaN(savedSize)) {
          state.size = parseInt(savedSize, 10);
          state.selectedSize = state.size;
        }

        // Load theme
        const savedTheme = localStorage.getItem('theme');
        state.theme = savedTheme === 'light' ? 'light' : 'dark';
        document.body.classList.toggle('light-theme', state.theme === 'light');
        if (elements.themeToggleBtn) {
          elements.themeToggleBtn.checked = state.theme === 'light';
        }

        // Load value display setting
        const showValues = localStorage.getItem('showValues');
        state.showValues = showValues !== 'false';
        if (elements.toggleDataValue) {
          elements.toggleDataValue.checked = state.showValues;
        }
      } catch (error) {
        ErrorHandler.handle(error, 'StorageService.loadState');
      }
    }
  };

  // === Grid Service ===
  const GridService = {
    /**
     * Creates empty grid of specified size
     * @param {number} size - Grid size
     * @returns {Array<Array<null>>} Empty grid
     */
    createEmptyGrid(size) {
      return Array.from({ length: size }, () => Array(size).fill(null));
    },

    /**
     * Deep clones grid
     * @param {Array<Array<number|null>>} grid - Grid to clone
     * @returns {Array<Array<number|null>>} Cloned grid
     */
    cloneGrid(grid) {
      return grid.map(row => [...row]);
    },

    /**
     * Finds new position after movement in direction
     * @param {number} row - Starting row
     * @param {number} col - Starting column
     * @param {number} deltaRow - Row movement delta
     * @param {number} deltaCol - Column movement delta
     * @returns {[number, number]} New position
     */
    findNewPosition(row, col, deltaRow, deltaCol) {
      let newRow = row + deltaRow;
      let newCol = col + deltaCol;
      
      while (GameValidator.isValidPosition(newRow, newCol) && 
             state.grid[newRow][newCol] === null) {
        row = newRow;
        col = newCol;
        newRow += deltaRow;
        newCol += deltaCol;
      }
      
      return [row, col];
    },

    /**
     * Gets random empty cell position
     * @returns {[number, number]|null} Random empty position or null
     */
    getRandomEmptyCell() {
      const emptyCells = [];
      
      for (let r = 0; r < state.size; r++) {
        for (let c = 0; c < state.size; c++) {
          if (state.grid[r][c] === null) {
            emptyCells.push([r, c]);
          }
        }
      }
      
      return emptyCells.length > 0 ? 
        emptyCells[Math.floor(Math.random() * emptyCells.length)] : null;
    },

    /**
     * Gets all empty cell positions
     * @returns {Array<[number, number]>} Array of empty positions
     */
    getAllEmptyCells() {
      const emptyCells = [];
      for (let r = 0; r < state.size; r++) {
        for (let c = 0; c < state.size; c++) {
          if (state.grid[r][c] === null) {
            emptyCells.push([r, c]);
          }
        }
      }
      return emptyCells;
    },

    /**
     * Calculates total grid value sum
     * @returns {number} Sum of all cell values
     */
    calculateGridSum() {
      return state.grid.flat()
        .filter(val => val !== null)
        .reduce((sum, val) => sum + val, 0);
    }
  };

  // === Game Logic ===
  const GameLogic = {
    /**
     * Validates and executes game move in specified direction
     * @param {string} direction - Direction key (ArrowUp, ArrowDown, etc.)
     */
    move(direction) {
      if (!GameValidator.canExecuteMove()) return;
      
      state.lastMoveTime = Date.now();
      state.isProcessing = true;

      try {
        const [deltaRow, deltaCol] = DIRECTION_DELTAS[direction];
        const result = this._executeMove(deltaRow, deltaCol);
        
        if (result.changed) {
          this._finalizeMoveAndUpdate(result);
        }
      } catch (error) {
        ErrorHandler.handle(error, 'GameLogic.move');
      } finally {
        state.isProcessing = false;
      }
    },

    /**
     * Executes the core move logic
     * @private
     * @param {number} deltaRow - Row movement delta
     * @param {number} deltaCol - Column movement delta
     * @returns {Object} Move execution result
     */
    _executeMove(deltaRow, deltaCol) {
      const newGrid = GridService.createEmptyGrid(state.size);
      const processOrder = this._getProcessingOrder(deltaRow, deltaCol);
      
      let changed = false;
      const disappearingCells = [];

      // Process each cell in calculated order
      for (const [row, col] of processOrder) {
        const cellValue = state.grid[row][col];
        if (!GameValidator.canSplit(cellValue)) continue;

        const moveResult = this._processCellMove(
          row, col, cellValue, deltaRow, deltaCol, newGrid, disappearingCells
        );
        changed = changed || moveResult;
      }

      return { newGrid, changed, disappearingCells };
    },

    /**
     * Processes individual cell movement
     * @private
     * @param {number} row - Cell row
     * @param {number} col - Cell column
     * @param {number} value - Cell value
     * @param {number} deltaRow - Row delta
     * @param {number} deltaCol - Column delta
     * @param {Array} newGrid - Target grid
     * @param {Array} disappearingCells - Cells to disappear
     * @returns {boolean} Whether cell was moved/changed
     */
    _processCellMove(row, col, value, deltaRow, deltaCol, newGrid, disappearingCells) {
      const [nextRow, nextCol] = [row + deltaRow, col + deltaCol];
      
      if (GameValidator.isValidPosition(nextRow, nextCol) && 
          state.grid[nextRow][nextCol] === null) {
        return this._applySplit(row, col, value, deltaRow, deltaCol, newGrid, disappearingCells);
      } else {
        const [targetRow, targetCol] = GridService.findNewPosition(row, col, deltaRow, deltaCol);
        newGrid[targetRow][targetCol] = value;
        return targetRow !== row || targetCol !== col;
      }
    },

    /**
     * Applies cell splitting logic
     * @private
     */
    _applySplit(row, col, value, deltaRow, deltaCol, newGrid, disappearingCells) {
      const splitValue = value / 2;
      const [targetRow, targetCol] = GridService.findNewPosition(
        row + deltaRow, col + deltaCol, deltaRow, deltaCol
      );
      
      newGrid[row][col] = splitValue;

      if (GameValidator.isValidPosition(targetRow, targetCol)) {
        newGrid[targetRow][targetCol] = splitValue;
        AnimationService.animateSplitAppear(row, col, targetRow, targetCol, splitValue, deltaRow, deltaCol);
        
        if (splitValue === 2) {
          disappearingCells.push([row, col], [targetRow, targetCol]);
        }
      } else if (splitValue === 2) {
        disappearingCells.push([row, col]);
      }

      AnimationService.animateCellSplit(row, col, deltaRow, deltaCol);
      return true;
    },

    /**
     * Gets processing order based on movement direction
     * @private
     * @param {number} deltaRow - Row delta
     * @param {number} deltaCol - Column delta
     * @returns {Array<[number, number]>} Processing order array
     */
    _getProcessingOrder(deltaRow, deltaCol) {
      const order = [];
      for (let r = 0; r < state.size; r++) {
        for (let c = 0; c < state.size; c++) {
          order.push([r, c]);
        }
      }
      
      // Reverse order if moving in positive direction
      const newOrder = [];
      const rows = Array.from({ length: state.size }, (_, i) => deltaRow > 0 ? state.size - 1 - i : i);
      const cols = Array.from({ length: state.size }, (_, i) => deltaCol > 0 ? state.size - 1 - i : i);

      for (const r of rows) {
        for (const c of cols) {
          newOrder.push([r, c]);
        }
      }
      return newOrder;
    },

    /**
     * Finalizes move and updates game state
     * @private
     * @param {Object} result - Move execution result
     */
    _finalizeMoveAndUpdate(result) {
      const { newGrid, disappearingCells } = result;
      
      // Save history for undo functionality
      state.history.unshift({ 
        grid: GridService.cloneGrid(state.grid), 
        score: state.score 
      });
      
      if (state.history.length > MAX_HISTORY_SIZE) {
        state.history.pop();
      }

      state.grid = newGrid;
      state.moves++;
      
      // Handle disappearing cells with delay
      this._handleDisappearingCells(disappearingCells);
      this._spawnRandomTile();
      
      PerformanceUtils.batchUpdate(() => UIService.render());
    },

    /**
     * Handles cells that should disappear after move
     * @private
     * @param {Array<[number, number]>} disappearingCells - Cells to remove
     */
    _handleDisappearingCells(disappearingCells) {
      if (disappearingCells.length === 0) return;
      
      setTimeout(() => {
        let scoreGain = 0;
        
        disappearingCells.forEach(([row, col]) => {
          if (state.grid[row][col] === 2) {
            AnimationService.animateAndRemoveCell(row, col);
            state.grid[row][col] = null;
            scoreGain += 1;
          }
        });
        
        if (scoreGain > 0) {
          state.score += scoreGain;
          UIService.showScorePopup(scoreGain);
        }
        
        PerformanceUtils.batchUpdate(() => UIService.render());
      }, ANIMATION_DURATION * 2);
    },

    /**
     * Spawns random tile based on probability
     * @private
     */
    _spawnRandomTile() {
      const emptyCells = GridService.getAllEmptyCells();
      if (emptyCells.length < state.size) return;

      const position = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      if (!position) return;
      
      const [row, col] = position;
      const getRandomValue = RANDOM_TILE_VALUES[state.size];
      const probability = state.size <= 7 ? 
        RANDOM_CELL_PROBABILITY.SMALL_GRID : 
        RANDOM_CELL_PROBABILITY.LARGE_GRID;
      
      if (Math.random() < probability && getRandomValue) {
        state.grid[row][col] = getRandomValue();
      }
    },

    /**
     * Adds random cell based on current grid state
     */
    addRandomCell() {
      try {
        const gridSum = GridService.calculateGridSum();
        console.log('Grid Sum:', gridSum);
        const threshold = state.size * 25;
        const emptyCells = GridService.getAllEmptyCells();

        if (gridSum <= threshold && emptyCells.length > state.size) {
          const randomCellPos = emptyCells[Math.floor(Math.random() * emptyCells.length)];
          const getRandomValue = RANDOM_TILE_VALUES[state.size];
          const newValue = getRandomValue ? getRandomValue() : 16;

          state.grid[randomCellPos[0]][randomCellPos[1]] = newValue;
          
          const cellElement = document.getElementById(`cell-${randomCellPos[0]}-${randomCellPos[1]}`);
          AnimationService.animateCellAppearing(cellElement);
            setTimeout(() => {
              PerformanceUtils.batchUpdate(() => UIService.render());
            }, ANIMATION_DURATION * 2);
        }
      } catch (error) {
        ErrorHandler.handle(error, 'GameLogic.addRandomCell');
      }
    },

    /**
     * Undoes last move if available
     */
    undo() {
      if (state.history.length === 0) return;
      
      try {
        const lastState = state.history.shift();
        state.grid = GridService.cloneGrid(lastState.grid);
        state.score = lastState.score;
        
        if (state.moves > 0) {
          state.moves--;
        }
        
        PerformanceUtils.batchUpdate(() => UIService.render());
      } catch (error) {
        ErrorHandler.handle(error, 'GameLogic.undo');
      }
    },

    /**
     * Restarts game with fresh state
     */
    restart() {
      try {
        Object.assign(state, {
          moves: 0,
          score: 0,
          history: [],
          disappear: {},
          isProcessing: false
        });
        
        GameSetup.createGrid();
      } catch (error) {
        ErrorHandler.handle(error, 'GameLogic.restart');
      }
    }
  };

  // === Animation Service ===
  const AnimationService = {
    /**
     * Gets animation class for split direction
     * @private
     * @param {number} deltaRow - Row delta
     * @param {number} deltaCol - Column delta
     * @returns {string} CSS animation class
     */
    _getSplitAnimationClass(deltaRow, deltaCol) {
      if (deltaRow !== 0) return ANIMATION_CLASSES.SPLIT_DIRECTIONS[deltaRow];
      return ANIMATION_CLASSES.SPLIT_DIRECTIONS[0][deltaCol];
    },

    /**
     * Animates cell splitting effect
     * @param {number} row - Cell row
     * @param {number} col - Cell column
     * @param {number} deltaRow - Row delta
     * @param {number} deltaCol - Column delta
     */
    animateCellSplit(row, col, deltaRow, deltaCol) {
      const cell = document.getElementById(`cell-${row}-${col}`);
      if (!cell) return;
      
      const animationClass = this._getSplitAnimationClass(deltaRow, deltaCol);
      if (!animationClass) return;
      
      cell.classList.add(animationClass);
      setTimeout(() => cell.classList.remove(animationClass), ANIMATION_DURATION);
    },

    /**
     * Animates split appearance with smooth transition
     * @param {number} parentRow - Parent cell row
     * @param {number} parentCol - Parent cell column  
     * @param {number} targetRow - Target cell row
     * @param {number} targetCol - Target cell column
     * @param {number} value - Cell value
     * @param {number} deltaRow - Row delta
     * @param {number} deltaCol - Column delta
     */
    animateSplitAppear(parentRow, parentCol, targetRow, targetCol, value, deltaRow, deltaCol) {
      const gameField = document.getElementById('game');
      if (!gameField) return;
      
      const cellSize = gameField.offsetWidth / state.size;
      
      // Create and setup temporary animation element
      const tempCell = this._createTempAnimationCell(parentRow, parentCol, value, cellSize);
      const targetCell = document.getElementById(`cell-${targetRow}-${targetCol}`);
      
      if (targetCell) {
        this._hideTargetCell(targetCell);
      }
      
      gameField.appendChild(tempCell);
      
      // Animate to target position
      this._animateToTarget(tempCell, targetRow, targetCol, cellSize);
      
      // Clean up after animation
      setTimeout(() => {
        this._cleanupSplitAnimation(tempCell, targetCell, targetRow, targetCol, value, deltaRow, deltaCol);
      }, ANIMATION_DURATION);
    },

    /**
     * Creates temporary cell for split animation
     * @private
     */
    _createTempAnimationCell(parentRow, parentCol, value, cellSize) {
      const tempCell = document.createElement('div');
      Object.assign(tempCell, {
        className: 'cell split-appear-anim',
      });
      
      Object.assign(tempCell.style, {
        position: 'absolute',
        zIndex: '2',
        width: `${cellSize}px`,
        height: `${cellSize}px`,
        left: `${parentCol * cellSize}px`,
        top: `${parentRow * cellSize}px`
      });
      
      tempCell.dataset.value = value;
      
      if (elements.toggleDataValue?.checked) {
        tempCell.textContent = value ? Math.log2(value) - 1 : '';
      }
      
      return tempCell;
    },

    /**
     * Hides target cell during animation
     * @private
     */
    _hideTargetCell(targetCell) {
      targetCell.classList.add('cell-null');
      targetCell.textContent = '';
      targetCell.dataset.value = '';
    },

    /**
     * Animates temporary cell to target position
     * @private
     */
    _animateToTarget(tempCell, targetRow, targetCol, cellSize) {
      requestAnimationFrame(() => {
        tempCell.style.transition = `left ${ANIMATION_DURATION}ms, top ${ANIMATION_DURATION}ms`;
        tempCell.style.left = `${targetCol * cellSize}px`;
        tempCell.style.top = `${targetRow * cellSize}px`;
      });
    },

    /**
     * Cleans up split animation elements
     * @private
     */
    _cleanupSplitAnimation(tempCell, targetCell, targetRow, targetCol, value, deltaRow, deltaCol) {
      if (targetCell) {
        targetCell.classList.remove('cell-null');
        targetCell.textContent = elements.toggleDataValue?.checked ? 
          (value ? Math.log2(value) - 1 : '') : '';
        targetCell.dataset.value = value;

        const appearClass = this._getSplitAnimationClass(deltaRow, deltaCol);
        if (appearClass) {
          targetCell.classList.add(appearClass);
          setTimeout(() => targetCell.classList.remove(appearClass), ANIMATION_DURATION);
        }
      }

      if (tempCell.parentNode) {
        tempCell.parentNode.removeChild(tempCell);
      }
      
      PerformanceUtils.batchUpdate(() => UIService.render());
    },

    /**
     * Animates cell removal with disappearing effect
     * @param {number} row - Cell row
     * @param {number} col - Cell column
     */
    animateAndRemoveCell(row, col) {
      const cell = document.getElementById(`cell-${row}-${col}`);
      if (!cell) return;
      
      cell.classList.add('disappearing');
      cell.addEventListener('animationend', function handler() {
        cell.classList.remove('disappearing');
        cell.textContent = '';
        cell.dataset.value = '';
        cell.removeEventListener('animationend', handler);
      });
    },

    /**
     * Animates cell appearing effect
     * @param {HTMLElement} cell - Cell element to animate
     */
    animateCellAppearing(cell) {
      if (!cell) return;
      
      cell.classList.add('appearing');
      setTimeout(() => cell.classList.remove('appearing'), ANIMATION_DURATION);
    }
  };

  // === UI Service ===
  const UIService = {
    /**
     * Renders complete game state
     */
    render() {
      this.renderGrid();
      this.updateScoreAndMoves();
      this.updateEfficiency();
    },

    /**
     * Renders grid state to DOM
     */
    renderGrid() {
      for (let r = 0; r < state.size; r++) {
        for (let c = 0; c < state.size; c++) {
          const cell = document.getElementById(`cell-${r}-${c}`);
          const val = state.grid[r][c];
          
          if (cell) {
            cell.dataset.value = val ?? '';
            if (elements.toggleDataValue?.checked) {
              cell.textContent = val ? Math.log2(val) - 1 : '';
            } else {
              cell.textContent = '';
            }
          }
        }
      }
    },

    /**
     * Updates score and moves display
     */
    updateScoreAndMoves() {
      if (elements.scoreDisplay) {
        elements.scoreDisplay.textContent = state.score;
      }
      
      const movesElement = document.getElementById('moves');
      if (movesElement) {
        movesElement.textContent = state.moves;
      }
    },

    /**
     * Updates efficiency display with animation
     */
    updateEfficiency() {
      setTimeout(() => {
        const efficiency = state.moves > 0 ? (state.score / state.moves).toFixed(1) : '0.0';
        const effElement = document.getElementById('efficiency');
        
        if (effElement && effElement.textContent !== efficiency) {
          effElement.textContent = efficiency;
          effElement.classList.remove('flash');
          // Trigger reflow to restart animation
          void effElement.offsetWidth;
          effElement.classList.add('flash');
        }
      }, ANIMATION_DURATION * 6);
    },

    /**
     * Shows animated score popup
     * @param {number} delta - Score increase amount
     */
    showScorePopup(delta) {
      if (!delta || delta <= 0) return;
      
      const scoreContainer = document.getElementById('scoreContainer');
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
    },

    /**
     * Toggles game theme
     */
    toggleTheme() {
      state.theme = elements.themeToggleBtn?.checked ? 'light' : 'dark';
      document.body.classList.toggle('light-theme', state.theme === 'light');
    },

    /**
     * Updates cell value display based on settings
     */
    updateCellValues() {
      state.showValues = elements.toggleDataValue?.checked ?? true;
      const cells = document.querySelectorAll('.cell');
      
      cells.forEach(cell => {
        const val = cell.dataset.value;
        if (state.showValues && val) {
          const numVal = parseInt(val, 10);
          cell.textContent = !isNaN(numVal) ? (Math.log2(numVal) - 1) : '';
        } else {
          cell.textContent = '';
        }
      });
    },

    /**
     * Shows settings overlay
     */
    showSettings() {
      if (elements.gameContainer && elements.settingsContainer) {
        elements.gameContainer.classList.add('hidden');
        elements.settingsContainer.classList.remove('hidden');
        this.highlightCurrentSize();
      }
    },

    /**
     * Hides settings overlay
     */
    hideSettings() {
      if (elements.settingsContainer && elements.gameContainer) {
        elements.settingsContainer.classList.add('hidden');
        elements.gameContainer.classList.remove('hidden');
      }
    },

    /**
     * Shows tutorial overlay
     */
    showTutorial() {
      state.isOverlayActive = true;
      
      if (elements.gameContainer) elements.gameContainer.classList.add('hidden');
      if (elements.settingsContainer) elements.settingsContainer.classList.add('hidden');
      if (elements.tutorialContainer) elements.tutorialContainer.classList.remove('hidden');
      
      TutorialService.resetTutorialGrid();
    },

    /**
     * Hides tutorial overlay
     */
    hideTutorial() {
      state.isOverlayActive = false;
      
      if (elements.tutorialContainer) elements.tutorialContainer.classList.add('hidden');
      if (elements.gameContainer) elements.gameContainer.classList.remove('hidden');
    },

    /**
     * Highlights currently selected grid size
     */
    highlightCurrentSize() {
      const sizeSquares = document.querySelectorAll('.size-square');
      sizeSquares.forEach(square => {
        const squareSize = parseInt(square.dataset.size, 10);
        if (squareSize === state.size) {
          square.classList.add('selected');
          state.selectedSize = state.size;
        } else {
          square.classList.remove('selected');
        }
      });
    }
  };

  // === Game Setup ===
  const GameSetup = {
    /**
     * Initializes the game
     */
    init() {
      this.cacheElements();
      this.setupEventListeners();
      StorageService.loadState();
      this.createGrid();
    },

    /**
     * Caches DOM elements for performance
     */
    cacheElements() {
      const elementIds = [
        'gameContainer', 'settingsContainer', 'statisticsContainer', 'score',
        'restartBtn', 'undoBtn', 'toggleDataValue', 'themeToggleBtn', 'saveSettingsBtn'
      ];
      
      elementIds.forEach(id => {
        elements[id === 'score' ? 'scoreDisplay' : id] = document.getElementById(id);
      });
    },

    /**
     * Sets up all event listeners
     */
    setupEventListeners() {
      // Game controls
      window.addEventListener('keydown', ErrorHandler.wrap(this.handleKeyDown.bind(this), 'keydown'));
      window.addEventListener('touchstart', ErrorHandler.wrap(this.handleTouchStart.bind(this), 'touchstart'));
      window.addEventListener('touchend', ErrorHandler.wrap(this.handleTouchEnd.bind(this), 'touchend'));
      
      // Button events with error handling
      const buttonEvents = [
        ['restartBtn', () => GameLogic.restart()],
        ['undoBtn', this.handleUndoClick.bind(this)],
        ['statisticsOkBtn', () => UIService.Statistics()],
        ['saveSettingsBtn', this.handleSaveSettings.bind(this)]
      ];
      
      buttonEvents.forEach(([id, handler]) => {
        if (elements[id]) {
          elements[id].addEventListener('click', ErrorHandler.wrap(handler, `${id}.click`));
        }
      });
            
      // Settings events
      const settingsBtn = document.getElementById('settingsBtn');
      if (settingsBtn) {
        settingsBtn.addEventListener('click', ErrorHandler.wrap(() => UIService.showSettings(), 'settings.show'));
      }
      
      const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
      if (cancelSettingsBtn) {
        cancelSettingsBtn.addEventListener('click', ErrorHandler.wrap(() => UIService.hideSettings(), 'settings.hide'));
      }
      
      // Theme and value display toggles
      if (elements.themeToggleBtn) {
        elements.themeToggleBtn.addEventListener('change', ErrorHandler.wrap(() => {
          UIService.toggleTheme();
          StorageService.saveState();
        }, 'theme.toggle'));
      }
      
      if (elements.toggleDataValue) {
        elements.toggleDataValue.addEventListener('change', ErrorHandler.wrap(() => {
          UIService.updateCellValues();
          StorageService.saveState();
        }, 'values.toggle'));
      }
      
      // Size selection
      this.setupSizeSelection();
      
      // Tutorial events
      const tutorialBtn = document.getElementById('tutorialBtn');
      if (tutorialBtn) {
        tutorialBtn.addEventListener('click', ErrorHandler.wrap(() => UIService.showTutorial(), 'tutorial.show'));
      }
      
      if (elements.tutorialSlider) {
        elements.tutorialSlider.addEventListener('input', ErrorHandler.wrap(() => {
          TutorialService.setTutorialGridByStep(Number(elements.tutorialSlider.value));
        }, 'tutorial.slider'));
      }
    },

    /**
     * Sets up size selection event listeners
     */
    setupSizeSelection() {
      const sizeSquares = document.querySelectorAll('.size-square');
      sizeSquares.forEach(square => {
        square.addEventListener('click', ErrorHandler.wrap(() => {
          sizeSquares.forEach(sq => sq.classList.remove('selected'));
          square.classList.add('selected');
          state.selectedSize = parseInt(square.dataset.size, 10);
        }, 'size.selection'));
      });
    },

    /**
     * Creates and initializes game grid
     */
    createGrid() {
      // Reset game state
      Object.assign(state, {
        grid: GridService.createEmptyGrid(state.size),
        history: [],
        score: 0,
        disappear: {},
        isProcessing: false
      });

      const gameField = document.getElementById('game');
      if (!gameField) return;
      
      gameField.innerHTML = '';
      gameField.style.display = 'grid';
      gameField.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
      gameField.style.gridTemplateRows = `repeat(${state.size}, 1fr)`;

      // Create grid cells
      for (let r = 0; r < state.size; r++) {
        for (let c = 0; c < state.size; c++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.id = `cell-${r}-${c}`;
          gameField.appendChild(cell);
        }
      }

      this.placeInitialTiles();
      PerformanceUtils.batchUpdate(() => UIService.render());
    },

    /**
     * Places initial tiles on the grid
     */
    placeInitialTiles() {
      const positions = [];
      for (let r = 0; r < state.size; r++) {
        for (let c = 0; c < state.size; c++) {
          positions.push([r, c]);
        }
      }
      
      // Shuffle positions for random placement
      for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
      }

      const initialTiles = INITIAL_TILES[state.size] || [64, 32, 16];
      
      initialTiles.forEach((value, index) => {
        if (index < positions.length) {
          const [r, c] = positions[index];
          state.grid[r][c] = value;
        }
      });
    },

    // === Event Handlers ===

    /**
     * Handles keyboard input for game movement
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyDown(e) {
      if (Object.keys(DIRECTION_DELTAS).includes(e.key)) {
        e.preventDefault();
        GameLogic.move(e.key);
        
        // Add random cell after move with small delay
        setTimeout(() => {
          GameLogic.addRandomCell();
          PerformanceUtils.batchUpdate(() => UIService.render());
        }, ANIMATION_DURATION * 3
);
      }
    },

    /**
     * Handles touch start for swipe detection
     * @param {TouchEvent} e - Touch event
     */
    handleTouchStart(e) {
      if (e.touches.length === 1) {
        state.touchStartX = e.touches[0].clientX;
        state.touchStartY = e.touches[0].clientY;
      }
    },

    /**
     * Handles touch end for swipe direction detection
     * @param {TouchEvent} e - Touch event
     */
    handleTouchEnd(e) {
      if (state.touchStartX === null || state.touchStartY === null) return;
      
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - state.touchStartX;
      const deltaY = touch.clientY - state.touchStartY;
      
      // Determine swipe direction based on larger delta
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > SWIPE_THRESHOLD) {
          GameLogic.move('ArrowRight');
        } else if (deltaX < -SWIPE_THRESHOLD) {
          GameLogic.move('ArrowLeft');
        }
      } else {
        if (deltaY > SWIPE_THRESHOLD) {
          GameLogic.move('ArrowDown');
        } else if (deltaY < -SWIPE_THRESHOLD) {
          GameLogic.move('ArrowUp');
        }
      }
      
      // Reset touch tracking
      state.touchStartX = state.touchStartY = null;
    },

    /**
     * Handles click on undo button
     */
    handleUndoClick() {
      GameLogic.undo();
    },

    /**
     * Handles save settings button click
     */
    handleSaveSettings() {
      if (state.size !== state.selectedSize) {
        state.size = state.selectedSize;
        this.createGrid();
      }
      
      StorageService.saveState();
      UIService.hideSettings();
    },
  };

  // === Public API ===
  return {
    init: GameSetup.init.bind(GameSetup)
  };
})();

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    BulbGame.init();
  } catch (error) {
    console.error('[BulbGame] Failed to initialize:', error);
  }
});
