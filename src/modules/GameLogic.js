import { StateManager } from './StateManager.js';
import { GameValidator } from './GameValidator.js';
import { GridService } from './GridService.js';
import { ErrorHandler } from './ErrorHandling.js';
import { UIService } from './UIService.js';
import { GameCore } from '../core/GameCore.js';
import { getModeRules, saveCurrentGameStats } from './ModeRules.js';
import { SnapshotService } from './SnapshotService.js';
import { MAX_HISTORY_SIZE, ANIMATION_DURATION } from './constants.js';

/**
 * GameLogic - Core game rules and mechanics.
 * Pure logic module — no DOM access, no Game instance reference.
 * Methods that need post-processing (e.g. placing tiles) return intent objects
 * that the Game coordinator interprets.
 */
export const GameLogic = (() => {
  /**
   * Validates and executes game move in specified direction.
   * @param {string} direction - Direction key (ArrowUp, ArrowDown, etc.).
   * @param {Object} elements - Cached DOM elements for validation.
   * @returns {{ effects: Object } | null} Move effects for animation, or null if move didn't happen.
   */
  const move = (direction, elements) => {
    if (!GameValidator.canExecuteMove(elements)) return null;

    StateManager.setState({ lastMoveTime: Date.now(), isProcessing: true });

    try {
      const state = StateManager.getState();
      const result = GameCore.computeMove(state, direction);
      if (!result.changed) {
        return null;
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

      return {
        effects: result.effects,
      };
    } catch (error) {
      ErrorHandler.handle(error, 'GameLogic.move');
      return null;
    } finally {
      StateManager.setState({ isProcessing: false });
    }
  };

  /**
   * Processes disappearing cells: updates grid, applies score, checks game status.
   * Called by the animation coordinator after the animation delay.
   * @param {Array<{row: number, col: number}>} disappearingCells - Cells to remove.
   */
  const processDisappearingCells = (disappearingCells) => {
    if (!disappearingCells || disappearingCells.length === 0) {
      checkGameStatus(StateManager.getState());
      return;
    }

    const state = StateManager.getState();
    const updatedGrid = GridService.cloneGrid(state.grid);
    let scoreGain = 0;

    for (const { row, col } of disappearingCells) {
      if (updatedGrid[row][col] === 2) {
        updatedGrid[row][col] = null;
        scoreGain += 1;
      }
    }

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

    checkGameStatus(StateManager.getState());
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
      UIService.hideGameOverPopup();
    } catch (error) {
      ErrorHandler.handle(error, 'GameLogic.undo');
    }
  };

  /**
   * Builds restart state patch. Returns an intent for the Game coordinator.
   * @returns {{ patch: Object, action: string }}
   */
  const restart = () => {
    const state = StateManager.getState();
    saveCurrentGameStats(state);

    const patch = {
      moves: 0,
      score: 0,
      levelMoves: 0,
      totalMoves: state.gameMode === 'quest' ? 0 : state.totalMoves,
      levelScore: 0,
      totalScore: state.gameMode === 'quest' ? 0 : state.totalScore,
      history: [],
      isProcessing: false,
      grid: GridService.createEmptyGrid(state.size),
    };

    StateManager.setState(patch);
    UIService.hideGameOverPopup();
    UIService.hideQuestWinPopup();

    return { action: 'PLACE_INITIAL_TILES' };
  };

  /**
   * Restarts game in Quest mode with the same initial grid.
   * @returns {{ action: string } | null}
   */
  const tryAgainQuestMode = () => {
    const state = StateManager.getState();
    if (state.gameMode === 'quest' && state.initialGrid.length > 0) {
      saveCurrentGameStats(state);
      StateManager.setState((prevState) => ({
        levelMoves: 0,
        levelScore: 0,
        history: [],
        isProcessing: false,
        grid: GridService.cloneGrid(prevState.initialGrid),
      }));
      UIService.hideQuestFailPopup();
      UIService.hideGameOverPopup();
      return null; // No tile placement needed — grid restored from snapshot
    }
    return restart(); // Fallback
  };

  /**
   * Restarts game in Quest mode with a newly generated grid.
   * @returns {{ action: string }}
   */
  const tryAnotherQuestMode = () => {
    const result = restart();
    UIService.hideQuestFailPopup();
    return result;
  };

  /**
   * Starts the next quest level.
   * @returns {{ action: string }}
   */
  const startNextQuestLevel = () => {
    UIService.hideQuestWinPopup();
    StateManager.setState((prevState) => ({
      levelMoves: 0,
      levelScore: 0,
      history: [],
      grid: GridService.createEmptyGrid(prevState.size),
    }));
    return { action: 'PLACE_INITIAL_TILES' };
  };

  /**
   * Checks win/lose conditions and delegates mode-specific reactions.
   * @param {Object} state - Current flattened game state.
   */
  const checkGameStatus = (state) => {
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

  return {
    move,
    processDisappearingCells,
    undo,
    restart,
    tryAgainQuestMode,
    tryAnotherQuestMode,
    startNextQuestLevel,
    checkGameStatus,
    saveCurrentGameStats,
  };
})();
