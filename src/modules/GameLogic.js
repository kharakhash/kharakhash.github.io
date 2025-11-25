import { StateManager } from './StateManager.js';
import { GameValidator } from './GameValidator.js';
import { GridService } from './GridService.js';
import { ErrorHandler } from './ErrorHandling.js';
import { AnimationService } from './AnimationService.js';
import { UIService } from './UIService.js';
import { 
  DIRECTION_DELTAS, INITIAL_TILES, MAX_HISTORY_SIZE, 
  RANDOM_CELL_PROBABILITY, RANDOM_TILE_VALUES, ANIMATION_DURATION 
} from './constants.js';

/**
 * GameLogic - Core game rules and mechanics.
 */
export const GameLogic = (() => {
  let _gameInstance = null; // Private variable to store the Game instance

  /**
   * Sets the Game instance for GameLogic to interact with.
   * This should be called once during game initialization.
   * @param {Object} gameInstance - The Game instance.
   */
  const setGameContext = (gameInstance) => {
    _gameInstance = gameInstance;
  };

  /**
   * Validates and executes game move in specified direction.
   * @param {string} direction - Direction key (ArrowUp, ArrowDown, etc.).
   */
  const move = (direction) => {
    if (!_gameInstance || !GameValidator.canExecuteMove(_gameInstance.elements)) return;
    
    StateManager.setState({ lastMoveTime: Date.now(), isProcessing: true });

    try {
      const state = StateManager.getState();
      const [deltaRow, deltaCol] = DIRECTION_DELTAS[direction];
      const initialGridClone = GridService.cloneGrid(state.grid); // Clone grid before move
      
      // Add random cell at the start of the move for infinity mode, if not the very first move
      if (state.gameMode === 'infinity' && state.moves > 0) {
        addRandomCell();
      }

      const result = _executeMove(state, deltaRow, deltaCol);
      
      if (result.changed) {
        _finalizeMoveAndUpdate(state, result);
      } else if (!GridService.areGridsIdentical(initialGridClone, StateManager.getState().grid)) {
          // If grid changed but not due to splitting (e.g., cell moved into empty space)
          // Still consider it a move
      }
    } catch (error) {
      ErrorHandler.handle(error, 'GameLogic.move');
    } finally {
      StateManager.setState({ isProcessing: false });
    }
  };

  /**
   * Executes the core move logic.
   * @private
   * @param {Object} state - Current game state.
   * @param {number} deltaRow - Row movement delta.
   * @param {number} deltaCol - Column movement delta.
   * @returns {Object} Move execution result.
   */
  const _executeMove = (state, deltaRow, deltaCol) => {
    const newGrid = GridService.createEmptyGrid(state.size);
    const processOrder = _getProcessingOrder(state, deltaRow, deltaCol);
    
    let changed = false;
    const disappearingCells = [];

    // Process each cell in calculated order
    for (const [row, col] of processOrder) {
      const cellValue = state.grid[row][col];
      if (!GameValidator.canSplit(cellValue)) continue;

      const moveResult = _processCellMove(
        state, row, col, cellValue, deltaRow, deltaCol, newGrid, disappearingCells
      );
      changed = changed || moveResult;
    }

    return { newGrid, changed, disappearingCells };
  };

  /**
   * Processes individual cell movement.
   * @private
   * @param {Object} state - Current game state.
   * @param {number} row - Cell row.
   * @param {number} col - Cell column.
   * @param {number} value - Cell value.
   * @param {number} deltaRow - Row delta.
   * @param {number} deltaCol - Column delta.
   * @param {Array} newGrid - Target grid.
   * @param {Array} disappearingCells - Cells to disappear.
   * @returns {boolean} Whether cell was moved/changed.
   */
  const _processCellMove = (state, row, col, value, deltaRow, deltaCol, newGrid, disappearingCells) => {
    const [nextRow, nextCol] = [row + deltaRow, col + deltaCol];
    
    if (GameValidator.isValidPosition(nextRow, nextCol) && 
        state.grid[nextRow][nextCol] === null) {
      return _applySplit(state, row, col, value, deltaRow, deltaCol, newGrid, disappearingCells);
    } else {
      const [targetRow, targetCol] = GridService.findNewPosition(row, col, deltaRow, deltaCol);
      newGrid[targetRow][targetCol] = value;
      return targetRow !== row || targetCol !== col;
    }
  };

  /**
   * Applies cell splitting logic.
   * @private
   */
  const _applySplit = (state, row, col, value, deltaRow, deltaCol, newGrid, disappearingCells) => {
    const splitValue = value / 2;
    const [targetRow, targetCol] = GridService.findNewPosition(
      row + deltaRow, col + deltaCol, deltaRow, deltaCol
    );
    
    newGrid[row][col] = splitValue;

    if (GameValidator.isValidPosition(targetRow, targetCol)) {
      newGrid[targetRow][targetCol] = splitValue;
      AnimationService.animateSplitAppear(row, col, targetRow, targetCol, splitValue, deltaRow, deltaCol, _gameInstance.elements);
      
      if (splitValue === 2) {
        disappearingCells.push([row, col], [targetRow, targetCol]);
      }
    } else if (splitValue === 2) {
      disappearingCells.push([row, col]);
    }

    AnimationService.animateCellSplit(row, col, deltaRow, deltaCol);
    return true;
  };

  /**
   * Gets processing order based on movement direction.
   * @private
   * @param {Object} state - Current game state.
   * @param {number} deltaRow - Row delta.
   * @param {number} deltaCol - Column delta.
   * @returns {Array<[number, number]>} Processing order array.
   */
  const _getProcessingOrder = (state, deltaRow, deltaCol) => {
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
  };

  /**
   * Finalizes move and updates game state.
   * @private
   * @param {Object} oldState - State before move.
   * @param {Object} result - Move execution result.
   */
  const _finalizeMoveAndUpdate = (oldState, result) => {
    const { newGrid, disappearingCells } = result;
    
    // Save history for undo functionality
    const newHistory = [{ 
      grid: GridService.cloneGrid(oldState.grid), 
      score: oldState.score,
      levelMoves: oldState.levelMoves,
      totalMoves: oldState.totalMoves,
      levelScore: oldState.levelScore,
      totalScore: oldState.totalScore,
    }, ...oldState.history];
    
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.pop();
    }

    StateManager.setState((prevState) => ({
      grid: newGrid,
      moves: prevState.moves + (oldState.gameMode === 'infinity' ? 1 : 0),
      levelMoves: prevState.levelMoves + (oldState.gameMode === 'quest' ? 1 : 0),
      totalMoves: prevState.totalMoves + (oldState.gameMode === 'quest' ? 1 : 0),
      history: newHistory,
    }));
    
    _handleDisappearingCells(newGrid, disappearingCells);
  };

  /**
   * Handles cells that should disappear after move.
   * @private
   * @param {Array<Array<number|null>>} currentGrid - The current grid state after move.
   * @param {Array<[number, number]>} disappearingCells - Cells to remove.
   */
  const _handleDisappearingCells = (currentGrid, disappearingCells) => {
    if (disappearingCells.length === 0) {
      _checkGameStatus(StateManager.getState());
      return;
    }
    
    setTimeout(() => {
      let scoreGain = 0;
      const updatedGrid = GridService.cloneGrid(currentGrid);
      
      disappearingCells.forEach(([row, col]) => {
        if (updatedGrid[row][col] === 2) { // Only remove if value is 2
          AnimationService.animateAndRemoveCell(row, col);
          updatedGrid[row][col] = null;
          scoreGain += 1;
        }
      });
      
      if (scoreGain > 0) {
        StateManager.setState((prevState) => ({
          grid: updatedGrid,
          score: prevState.score + (prevState.gameMode === 'infinity' ? scoreGain : 0),
          levelScore: prevState.levelScore + (prevState.gameMode === 'quest' ? scoreGain : 0),
          totalScore: prevState.totalScore + (prevState.gameMode === 'quest' ? scoreGain : 0),
        }));
        UIService.showScorePopup(scoreGain);
      } else {
        StateManager.setState({ grid: updatedGrid });
      }
      _checkGameStatus(StateManager.getState());
    }, ANIMATION_DURATION * 2);
  };

  /**
   * Adds random cell based on current grid state.
   */
  const addRandomCell = () => {
    const state = StateManager.getState();
    if (state.gameMode !== 'infinity') return;

    try {
      const gridSum = GridService.calculateGridSum();
      const threshold = state.size * 25; // This threshold might need tuning
      const emptyCells = GridService.getAllEmptyCells();

      if (gridSum <= threshold && emptyCells.length > state.size / 2) { // Adjust condition for better balance
        const randomCellPos = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const getRandomValue = RANDOM_TILE_VALUES[state.size];
        const newValue = getRandomValue ? getRandomValue() : 16;

        StateManager.setState((prevState) => {
          const newGrid = GridService.cloneGrid(prevState.grid);
          newGrid[randomCellPos[0]][randomCellPos[1]] = newValue;
          return { grid: newGrid };
        });
        
        const cellElement = document.getElementById(`cell-${randomCellPos[0]}-${randomCellPos[1]}`);
        AnimationService.animateCellAppearing(cellElement);
      }
    } catch (error) {
      ErrorHandler.handle(error, 'GameLogic.addRandomCell');
    }
  };

  /**
   * Undoes last move if available.
   */
  const undo = () => {
    const state = StateManager.getState();
    if (state.history.length === 0) return;
    
    try {
      const lastState = state.history[0]; // Get the first item, not pop
      StateManager.setState((prevState) => ({
        grid: GridService.cloneGrid(lastState.grid),
        score: lastState.score,
        moves: lastState.moves,
        levelMoves: lastState.levelMoves,
        totalMoves: lastState.totalMoves,
        levelScore: lastState.levelScore,
        totalScore: lastState.totalScore,
        history: prevState.history.slice(1), // Remove the first item
      }));
      UIService.hideGameOverPopup(); // In case undoing from a lose state
    } catch (error) {
      ErrorHandler.handle(error, 'GameLogic.undo');
    }
  };

  /**
   * Restarts game with fresh state.
   */
  const restart = () => {
    const state = StateManager.getState();
    _saveCurrentGameStats(state); // Save current game before restarting
    
    StateManager.setState((prevState) => ({
      moves: 0,
      score: 0,
      levelMoves: 0,
      totalMoves: prevState.gameMode === 'quest' ? 0 : prevState.totalMoves, // Reset total only if starting new quest series
      levelScore: 0,
      totalScore: prevState.gameMode === 'quest' ? 0 : prevState.totalScore, // Reset total only if starting new quest series
      history: [],
      disappear: {}, // This property is no longer managed directly in state, it's temporary for animations
      isProcessing: false,
      grid: GridService.createEmptyGrid(prevState.size), // Create empty grid
    }));
    _gameInstance.placeInitialTiles(); // Place initial tiles using Game instance
    UIService.hideGameOverPopup();
    UIService.hideQuestWinPopup();
  };

  /**
   * Restarts game in Quest mode with the same initial grid.
   */
  const tryAgainQuestMode = () => {
    const state = StateManager.getState();
    if (state.gameMode === 'quest' && state.initialGrid.length > 0) {
      _saveCurrentGameStats(state);
      StateManager.setState((prevState) => ({
        levelMoves: 0,
        levelScore: 0,
        history: [],
        isProcessing: false,
        grid: GridService.cloneGrid(prevState.initialGrid), // Restore initial grid
      }));
      UIService.hideGameOverPopup();
    } else {
      restart(); // Fallback to regular restart if not in quest mode or no initial grid
    }
  };

  /**
   * Restarts game in Quest mode with a newly generated grid.
   */
  const tryAnotherQuestMode = () => {
    restart(); // This will create a new grid, resetting all quest counters
  };

  /**
   * Starts the next quest level, generating a new grid but keeping current total moves and score.
   */
  const startNextQuestLevel = () => {
    UIService.hideQuestWinPopup(); // Hide the win popup
    StateManager.setState((prevState) => ({
      levelMoves: 0,
      levelScore: 0,
      history: [], // Clear history for new level
      grid: GridService.createEmptyGrid(prevState.size), // Create empty grid
    }));
    _gameInstance.placeInitialTiles(); // Place new initial tiles using Game instance
  };

  /**
   * Checks game status for Quest mode (win/lose).
   * @private
   * @param {Object} state - Current game state.
   */
  const _checkGameStatus = (state) => {
    if (state.gameMode !== 'quest') return;

    const emptyCells = GridService.getAllEmptyCells();
    const hasMoves = _canMakeMove(state);

    if (emptyCells.length === state.size * state.size) { // All cells are empty - WIN condition
      _handleWin(state);
    } else if (emptyCells.length === 0 && !hasMoves) { // No empty cells and no possible moves - LOSE condition
      _handleLose(state);
    }
  };

  /**
   * Checks if any valid move can be made on the current grid.
   * @private
   * @param {Object} state - Current game state.
   * @returns {boolean} True if a move is possible, false otherwise.
   */
  const _canMakeMove = (state) => {
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        const value = state.grid[r][c];
        if (!GameValidator.canSplit(value)) continue;

        // Check all 4 directions for possible splits
        for (const [dr, dc] of Object.values(DIRECTION_DELTAS)) {
          const nextRow = r + dr;
          const nextCol = c + dc;

          if (GameValidator.isValidPosition(nextRow, nextCol) && state.grid[nextRow][nextCol] === null) {
            return true; // Found an empty cell next to a splittable cell
          }
        }
      }
    }
    return false; // No possible moves found
  };

  /**
   * Handles game win condition in Quest mode.
   * @private
   * @param {Object} state - Current game state.
   */
  const _handleWin = (state) => {
    console.log('Quest Mode: You Win!');
    _saveCurrentGameStats(state);
    UIService.showQuestWinPopup(state.levelMoves, state.levelScore);
  };

  /**
   * Handles game lose condition in Quest mode.
   * @private
   * @param {Object} state - Current game state.
   */
  const _handleLose = (state) => {
    console.log('Quest Mode: You Lose!');
    _saveCurrentGameStats(state);
    UIService.showGameOverPopup('you lose, try again?', state.levelMoves, state.levelScore);
    // При проигрыше сбрасываем totalMoves и totalScore
    StateManager.setState({ totalMoves: 0, totalScore: 0 });
  };

  /**
   * Saves current game stats to localStorage.
   * Should be called when a game ends (e.g., on restart or size change).
   * @param {Object} state - Current game state.
   */
  const _saveCurrentGameStats = (state) => {
    if (state.gameMode === 'infinity' && state.moves > 0) {
      const gameStats = {
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        size: state.size,
        moves: state.moves,
        score: state.score,
        mode: state.gameMode
      };
      StorageService.saveGameStats(gameStats);
    } else if (state.gameMode === 'quest' && state.levelMoves > 0) { // Для quest mode сохраняем level stats
      const gameStats = {
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        size: state.size,
        moves: state.levelMoves,
        score: state.levelScore,
        totalMoves: state.totalMoves,
        totalScore: state.totalScore,
        mode: state.gameMode
      };
      StorageService.saveGameStats(gameStats);
    }
  };

  return {
    move,
    addRandomCell,
    undo,
    restart,
    tryAgainQuestMode,
    tryAnotherQuestMode,
    startNextQuestLevel,
    setGameContext, // Export the setter for the Game instance
    _checkGameStatus, // Export for initial setup
    _saveCurrentGameStats, // Export for game setup
  };
})(); // Removed IIFE parameters
