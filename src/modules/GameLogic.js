import { StateManager } from './StateManager.js';
import { GameValidator } from './GameValidator.js';
import { GridService } from './GridService.js';
import { ErrorHandler } from './ErrorHandling.js';
import { AnimationService } from './AnimationService.js';
import { UIService } from './UIService.js';
import { GameCore } from '../core/GameCore.js';
import { getModeRules, saveCurrentGameStats } from './ModeRules.js';
import { SnapshotService } from './SnapshotService.js';
import { MAX_HISTORY_SIZE, ANIMATION_DURATION } from './constants.js';

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
      const result = GameCore.computeMove(state, direction);
      if (!result.changed) {
        return;
      }

      const historyEntry = SnapshotService.makeSnapshot(state);
      const newHistory = [historyEntry, ...state.history];
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.pop();
      }

      StateManager.setState((prevState) => {
        const modeRules = getModeRules(state.gameMode);
        const moveCounters = modeRules.applyMoveCounters(prevState, state);
        return {
          ...result.patch,
          ...moveCounters,
          history: newHistory,
        };
      });

      _animateSplitActions(result.effects.splitActions);
      _animateRandomCell(result.effects.spawnedCell);
      _handleDisappearingCells(result.effects.disappearingCells);
    } catch (error) {
      ErrorHandler.handle(error, 'GameLogic.move');
    } finally {
      StateManager.setState({ isProcessing: false });
    }
  };
  const _handleDisappearingCells = (disappearingCells) => {
    if (!disappearingCells || disappearingCells.length === 0) {
      _checkGameStatus(StateManager.getState());
      return;
    }
    
    setTimeout(() => {
      const state = StateManager.getState();
      const updatedGrid = GridService.cloneGrid(state.grid);
      let scoreGain = 0;
      
      disappearingCells.forEach(({ row, col }) => {
        if (updatedGrid[row][col] === 2) {
          AnimationService.animateAndRemoveCell(row, col, _gameInstance?.elements);
          updatedGrid[row][col] = null;
          scoreGain += 1;
        }
      });
      
      StateManager.setState((prevState) => {
        const modeRules = getModeRules(prevState.gameMode);
        const scorePatch = modeRules.applyScore(prevState, scoreGain);
        return {
          grid: updatedGrid,
          ...scorePatch,
        };
      });

      if (scoreGain > 0) {
        UIService.showScorePopup(scoreGain);
      }

      _checkGameStatus(StateManager.getState());
    }, ANIMATION_DURATION * 2);
  };

  const _animateSplitActions = (splitActions) => {
    if (!splitActions || splitActions.length === 0 || !_gameInstance) return;
    const elements = _gameInstance.elements;
    splitActions.forEach((action) => {
      const targetRow = action.to ? action.to.row : action.from.row;
      const targetCol = action.to ? action.to.col : action.from.col;
      AnimationService.animateSplitAppear(
        action.from.row,
        action.from.col,
        targetRow,
        targetCol,
        action.value,
        action.deltaRow,
        action.deltaCol,
        elements
      );
      AnimationService.animateCellSplit(action.from.row, action.from.col, action.deltaRow, action.deltaCol, elements);
    });
  };

  const _animateRandomCell = (spawnedCell) => {
    if (!spawnedCell) return;
    const { row, col } = spawnedCell.position;
    const cellElement = _gameInstance?.elements?.cells?.[row]?.[col]
      || document.getElementById(`cell-${row}-${col}`);
    if (cellElement) {
      AnimationService.animateCellAppearing(cellElement);
    }
  };

  /**
   * Undoes last move if available.
   */
  const undo = () => {
    const state = StateManager.getState();
    if (state.history.length === 0) return;
    
    try {
      const [lastSnapshot] = state.history;
      const restored = SnapshotService.restoreSnapshot(lastSnapshot);
      StateManager.setState((prevState) => ({
        ...restored,
        history: prevState.history.slice(1),
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
      UIService.hideQuestFailPopup();
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
    UIService.hideQuestFailPopup();
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
   * Checks win/lose conditions and delegates mode-specific reactions.
   * @private
   * @param {Object} state - Current flattened game state.
   */
  const _checkGameStatus = (state) => {
    const modeRules = getModeRules(state.gameMode);

    if (state.gameMode === 'quest') {
      const outcome = GameCore.checkQuestOutcome(state);
      if (outcome === 'win') {
        modeRules.onWin(state);
      } else if (outcome === 'lose') {
        modeRules.onLose(state);
      }
      return;
    }

    if (state.gameMode === 'infinity' && !GameCore.canMakeMove(state)) {
      modeRules.onLose(state);
    }
  };

  const _saveCurrentGameStats = (state) => saveCurrentGameStats(state);

  return {
    move,
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
