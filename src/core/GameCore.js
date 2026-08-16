import { GridService } from '../modules/GridService.js';
import { DIRECTION_DELTAS, RANDOM_TILE_VALUES } from '../modules/constants.js';

/**
 * Builds the traversal order based on sweep direction to ensure cells move correctly.
 */
const createProcessingOrder = (size, deltaRow, deltaCol) => {
  const rows = Array.from({ length: size }, (_, index) => deltaRow > 0 ? size - 1 - index : index);
  const cols = Array.from({ length: size }, (_, index) => deltaCol > 0 ? size - 1 - index : index);
  const order = [];
  for (const row of rows) {
    for (const col of cols) {
      order.push({ row, col });
    }
  }
  return order;
};

/**
 * Applies the splitting rule to a single cell, capturing split metadata and disappeared cells.
 */
const applySplit = (state, row, col, value, deltaRow, deltaCol, newGrid, disappearingCells, splitActions) => {
  const splitValue = value / 2;
  const [targetRow, targetCol] = GridService.findNewPosition(
    state.grid,
    state.size,
    row + deltaRow,
    col + deltaCol,
    deltaRow,
    deltaCol
  );

  newGrid[row][col] = splitValue;

  const action = {
    from: { row, col },
    to: GridService.isValidPosition(targetRow, targetCol, state.size) ? { row: targetRow, col: targetCol } : undefined,
    value: splitValue,
    deltaRow,
    deltaCol,
  };
  splitActions.push(action);

  if (action.to) {
    newGrid[targetRow][targetCol] = splitValue;
    if (splitValue === 2) {
      disappearingCells.push({ row, col }, { row: targetRow, col: targetCol });
    }
  } else if (splitValue === 2) {
    disappearingCells.push({ row, col });
  }

  return true;
};

/**
 * Moves a cell according to direction deltas, delegating to splitting logic when applicable.
 */
const applyMoveToCell = (state, row, col, value, deltaRow, deltaCol, newGrid, disappearingCells, splitActions) => {
  const nextRow = row + deltaRow;
  const nextCol = col + deltaCol;

  if (GridService.isValidPosition(nextRow, nextCol, state.size) && state.grid[nextRow][nextCol] === null) {
    return applySplit(state, row, col, value, deltaRow, deltaCol, newGrid, disappearingCells, splitActions);
  }

  const [targetRow, targetCol] = GridService.findNewPosition(
    state.grid,
    state.size,
    row,
    col,
    deltaRow,
    deltaCol
  );
  newGrid[targetRow][targetCol] = value;
  return targetRow !== row || targetCol !== col;
};

export const GameCore = {
  /**
   * Evaluates a directional move, returns the new grid plus metadata for animations.
   */
  computeMove: (state, direction) => {
    const { grid, size } = state;
    const [deltaRow, deltaCol] = DIRECTION_DELTAS[direction];
    const ordering = createProcessingOrder(size, deltaRow, deltaCol);
    const newGrid = GridService.createEmptyGrid(size);
    const disappearingCells = [];
    const splitActions = [];
    let changed = false;

    for (const { row, col } of ordering) {
      const value = grid[row][col];
      if (typeof value !== 'number' || value < 2) {
        continue;
      }
      const cellChanged = applyMoveToCell(
        state,
        row,
        col,
        value,
        deltaRow,
        deltaCol,
        newGrid,
        disappearingCells,
        splitActions
      );
      changed = changed || cellChanged;
    }

    let spawnedCellPayload = null;
    if (changed) {
      const nextStateForSpawn = {
        ...state,
        grid: newGrid,
        moves: state.moves + (state.gameMode === 'infinity' ? 1 : 0),
      };
      spawnedCellPayload = GameCore.maybeAddRandomCell(nextStateForSpawn);
    }

    const effects = {
      splitActions,
      disappearingCells,
      scoreGain: disappearingCells.length,
      spawnedCell: spawnedCellPayload
        ? { position: spawnedCellPayload.position, value: spawnedCellPayload.value }
        : undefined,
    };

    const finalGrid = spawnedCellPayload ? spawnedCellPayload.grid : newGrid;

    return {
      patch: { grid: finalGrid },
      changed,
      effects,
    };
  },

  /**
   * Optionally seeds a new random tile in infinity mode after the first move.
   */
  maybeAddRandomCell: (state) => {
    if (state.gameMode !== 'infinity' || state.moves === 0) {
      return null;
    }

    const emptyCells = GridService.getAllEmptyCells(state.grid, state.size);
    if (emptyCells.length === 0) {
      return null;
    }

    const gridSum = GridService.calculateGridSum(state.grid);
    const threshold = state.size * 25;
    if (gridSum > threshold || emptyCells.length <= state.size / 2) {
      return null;
    }

    const [row, col] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const generator = RANDOM_TILE_VALUES[state.size];
    const value = generator ? generator() : 16;
    const updatedGrid = GridService.cloneGrid(state.grid);
    updatedGrid[row][col] = value;

    return {
      grid: updatedGrid,
      position: { row, col },
      value,
    };
  },

  /**
   * Checks whether any legal move is still possible on the current grid.
   */
  canMakeMove: (state) => {
    // Treat placeholder cells (value 1) and empty cells as free space to avoid false loses.
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        const value = state.grid[r][c];
        if (value === null || value === 1) {
          return true;
        }
      }
    }

    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        const value = state.grid[r][c];
        if (typeof value !== 'number' || value < 2) {
          continue;
        }
        for (const [dr, dc] of Object.values(DIRECTION_DELTAS)) {
          const nextRow = r + dr;
          const nextCol = c + dc;
          if (GridService.isValidPosition(nextRow, nextCol, state.size) && state.grid[nextRow][nextCol] === null) {
            return true;
          }
        }
      }
    }
    return false;
  },

  /**
   * Examines quest mode win/lose conditions without mutating state.
   */
  checkQuestOutcome: (state) => {
    if (state.gameMode !== 'quest') {
      return null;
    }

    const emptyCells = GridService.getAllEmptyCells(state.grid, state.size);
    const totalCells = state.size * state.size;
    const hasMoves = GameCore.canMakeMove(state);

    if (emptyCells.length === totalCells) {
      return 'win';
    }
    if (emptyCells.length === 0 && !hasMoves) {
      return 'lose';
    }
    return null;
  },
};
