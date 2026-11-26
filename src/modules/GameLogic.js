import { StateManager } from './StateManager.js';
import { EventBus } from './EventBus.js';
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

      EventBus.emit('game:move', { direction, effects: result.effects });

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
      scoreGain += 1;
      // Clear the cell only if it still holds value 2 (was not replaced by spawned tile)
      if (updatedGrid[row][col] === 2) {
        updatedGrid[row][col] = null;
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
      console.log(`[GameLogic] 💥 Cleared ${scoreGain} bulb cell(s) (value 2). Score gain: +${scoreGain}`);
      EventBus.emit('game:score', { scoreGain });
      UIService.showScorePopup(scoreGain);
    }

    checkGameStatus(StateManager.getState());
  };

  /**
   * Places the newly spawned tile into state on the computer turn.
   * @param {Object|undefined} spawnedCell - Spawned cell information.
   */
  const applySpawnedCell = (spawnedCell) => {
    if (!spawnedCell) return;
    const { position, value } = spawnedCell;
    const { row, col } = position;

    StateManager.setState((prevState) => {
      const updatedGrid = GridService.cloneGrid(prevState.grid);
      updatedGrid[row][col] = value;
      return { grid: updatedGrid };
    });

    EventBus.emit('game:spawn', spawnedCell);
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
      totalMoves: (state.gameMode === 'quest' || state.gameMode === 'akure') ? 0 : state.totalMoves,
      levelScore: 0,
      totalScore: (state.gameMode === 'quest' || state.gameMode === 'akure') ? 0 : state.totalScore,
      history: [],
      isProcessing: false,
      grid: GridService.createEmptyGrid(state.size),
    };

    StateManager.setState(patch);
    UIService.hideGameOverPopup();
    UIService.hideQuestWinPopup();
    UIService.hideQuestFailPopup();
    UIService.hideAkureWinPopup();
    UIService.hideAkureFailPopup();

    return { action: 'PLACE_INITIAL_TILES' };
  };

  /**
   * Restarts game in Quest mode with the same initial grid.
   * @returns {{ action: string } | null}
   */
  const tryAgainQuestMode = () => {
    const state = StateManager.getState();
    if (state.gameMode === 'quest' && state.initialGrid.length > 0) {
      StateManager.setState((prevState) => ({
        levelMoves: 0,
        levelScore: 0,
        history: [],
        isProcessing: false,
        grid: GridService.cloneGrid(prevState.initialGrid),
      }));
      UIService.hideQuestFailPopup();
      UIService.hideGameOverPopup();
      return null;
    }
    return restart();
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
   * Restarts game in Akure mode with the same initial grid.
   * @returns {{ action: string } | null}
   */
  const tryAgainAkureMode = () => {
    const state = StateManager.getState();
    if (state.gameMode === 'akure' && state.initialGrid.length > 0) {
      StateManager.setState((prevState) => ({
        levelMoves: 0,
        levelScore: 0,
        history: [],
        isProcessing: false,
        grid: GridService.cloneGrid(prevState.initialGrid),
      }));
      UIService.hideAkureFailPopup();
      UIService.hideGameOverPopup();
      return null;
    }
    return restart();
  };

  /**
   * Restarts game in Akure mode with a newly generated grid.
   * @returns {{ action: string }}
   */
  const tryAnotherAkureMode = () => {
    const result = restart();
    UIService.hideAkureFailPopup();
    return result;
  };

  /**
   * Starts the next akure level.
   * @returns {{ action: string }}
   */
  const startNextAkureLevel = () => {
    UIService.hideAkureWinPopup();
    const currentQuestLvl = StorageService.getAkureQuestLevel() || 1;
    const nextLevel = currentQuestLvl + 1;
    StorageService.setAkureQuestLevel(nextLevel);
    StateManager.setState((prevState) => ({
      akureQuestLevel: nextLevel,
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

    if (state.gameMode === 'akure') {
      const outcome = GameCore.checkAkureOutcome(state);
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
    applySpawnedCell,
    undo,
    restart,
    tryAgainQuestMode,
    tryAnotherQuestMode,
    startNextQuestLevel,
    tryAgainAkureMode,
    tryAnotherAkureMode,
    startNextAkureLevel,
    checkGameStatus,
    saveCurrentGameStats,
  };
})();
