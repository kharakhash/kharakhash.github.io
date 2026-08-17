import { GridService } from '../modules/GridService.js';
import { DIRECTION_DELTAS, RANDOM_TILE_VALUES, RANDOM_TILE_SPAWN_LIMITS } from '../modules/constants.js';

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
  const isLocked = state.lockedCells && (
    (Array.isArray(state.lockedCells) && state.lockedCells.some(c => c.row === row && c.col === col)) ||
    (state.lockedCells instanceof Set && state.lockedCells.has(`${row},${col}`))
  );
  if (isLocked) {
    newGrid[row][col] = value;
    return false;
  }

  const splitValue = value / 2;
  const [targetRow, targetCol] = GridService.findNewPosition(
    state.grid,
    state.size,
    row + deltaRow,
    col + deltaCol,
    deltaRow,
    deltaCol,
    state.cellTypes
  );

  newGrid[row][col] = splitValue;

  const action = {
    from: { row, col },
    to: GridService.isValidPosition(targetRow, targetCol, state.size, state.cellTypes) ? { row: targetRow, col: targetCol } : undefined,
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
  const isLocked = state.lockedCells && (
    (Array.isArray(state.lockedCells) && state.lockedCells.some(c => c.row === row && c.col === col)) ||
    (state.lockedCells instanceof Set && state.lockedCells.has(`${row},${col}`))
  );
  if (isLocked) {
    newGrid[row][col] = value;
    return false;
  }

  const nextRow = row + deltaRow;
  const nextCol = col + deltaCol;

  if (GridService.isValidPosition(nextRow, nextCol, state.size, state.cellTypes) && state.grid[nextRow][nextCol] === null) {
    return applySplit(state, row, col, value, deltaRow, deltaCol, newGrid, disappearingCells, splitActions);
  }

  const [targetRow, targetCol] = GridService.findNewPosition(
    state.grid,
    state.size,
    row,
    col,
    deltaRow,
    deltaCol,
    state.cellTypes
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
      if (state.cellTypes && state.cellTypes[row]?.[col] === 'inactive') {
        continue;
      }
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
        disappearingCells,
        scoreGain: disappearingCells.length,
      };
      console.log(`[GameCore] ➡️ Move "${direction}" (${size}x${size}) | Splits: ${splitActions.length} | Disappearing: ${disappearingCells.length}`);
      spawnedCellPayload = GameCore.maybeAddRandomCell(nextStateForSpawn, disappearingCells);
    }

    const effects = {
      splitActions,
      disappearingCells,
      scoreGain: disappearingCells.length,
      spawnedCell: spawnedCellPayload
        ? { position: spawnedCellPayload.position, value: spawnedCellPayload.value }
        : undefined,
    };

    return {
      patch: { grid: newGrid },
      changed,
      effects,
    };
  },

  /**
   * Seeds a new random tile in infinity mode using getAllEmptyCellsInfinity.
   */
  maybeAddRandomCell: (state, disappearingCells = state?.disappearingCells || []) => {
    if (state.gameMode !== 'infinity' || state.moves === 0) {
      return null;
    }

    const disappearingList = Array.isArray(disappearingCells) ? disappearingCells : [];
    const allCandidateCells = GridService.getAllEmptyCellsInfinity(state.grid, state.size, disappearingList, state.cellTypes);
    const rawEmptyCells = GridService.getAllEmptyCells(state.grid, state.size, state.cellTypes);
    const rawEmptyCount = rawEmptyCells.length;
    const scoreGain = disappearingList.length || state?.scoreGain || 0;
    const gridSum = GridService.calculateGridSum(state.grid);
    const limits = RANDOM_TILE_SPAWN_LIMITS[state.size] || {
      maxGridSum: state.size * 12,
      minEmptyCells: state.size / 1.5,
    };

    console.log(
      `[GameCore] 🎲 Spawn check (${state.size}x${state.size}) | ` +
      `GridSum: ${gridSum} (limit <= ${limits.maxGridSum}) | ` +
      `EmptyCells: ${rawEmptyCount} + ${scoreGain} (${allCandidateCells.length}) (limit > ${limits.minEmptyCells})`
    );

    if (allCandidateCells.length === 0) {
      console.log('  ↳ ⛔ Tile spawn skipped: no empty cells left.');
      return null;
    }

    if (gridSum > limits.maxGridSum) {
      console.log(`  ↳ ⛔ Tile spawn skipped: GridSum (${gridSum}) > maxGridSum (${limits.maxGridSum}).`);
      return null;
    }

    if (allCandidateCells.length <= limits.minEmptyCells) {
      console.log(`  ↳ ⛔ Tile spawn skipped: EmptyCells (${rawEmptyCount} + ${scoreGain} = ${allCandidateCells.length}) <= minEmptyCells (${limits.minEmptyCells}).`);
      return null;
    }

    const spawnPool = rawEmptyCells.length > 0 ? rawEmptyCells : allCandidateCells;
    const [row, col] = spawnPool[Math.floor(Math.random() * spawnPool.length)];
    const generator = RANDOM_TILE_VALUES[state.size];
    const value = generator ? generator() : 16;
    const updatedGrid = GridService.cloneGrid(state.grid);
    updatedGrid[row][col] = value;

    console.log(`  ↳ ✨ Tile spawned: [${value}] at cell (${row}, ${col}). New GridSum: ${gridSum + value}`);

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
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        if (state.cellTypes && state.cellTypes[r]?.[c] === 'inactive') continue;
        const value = state.grid[r]?.[c];
        if (value === null || value === 1) {
          return true;
        }
      }
    }

    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        if (state.cellTypes && state.cellTypes[r]?.[c] === 'inactive') continue;
        const isLocked = state.lockedCells && (
          (Array.isArray(state.lockedCells) && state.lockedCells.some(cell => cell.row === r && cell.col === c)) ||
          (state.lockedCells instanceof Set && state.lockedCells.has(`${r},${c}`))
        );
        if (isLocked) continue;

        const value = state.grid[r]?.[c];
        if (typeof value !== 'number' || value < 2) {
          continue;
        }
        for (const [dr, dc] of Object.values(DIRECTION_DELTAS)) {
          const nextRow = r + dr;
          const nextCol = c + dc;
          if (GridService.isValidPosition(nextRow, nextCol, state.size, state.cellTypes) && state.grid[nextRow]?.[nextCol] === null) {
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

    const emptyCells = GridService.getAllEmptyCells(state.grid, state.size, state.cellTypes);
    const playableCells = GridService.getAllPlayableCells(state.size, state.cellTypes);
    const hasMoves = GameCore.canMakeMove(state);

    if (emptyCells.length === playableCells.length && playableCells.length > 0) {
      return 'win';
    }
    if (emptyCells.length === 0 && !hasMoves) {
      return 'lose';
    }
    return null;
  },

  /**
   * Examines akure mode win/lose conditions without mutating state.
   * Core rule: The goal is to leave NO 'null' cell on the playable grid (0 empty cells).
   */
  checkAkureOutcome: (state) => {
    if (state.gameMode !== 'akure') {
      return null;
    }

    const playableCells = GridService.getAllPlayableCells(state.size, state.cellTypes);
    const emptyCells = GridService.getAllEmptyCells(state.grid, state.size, state.cellTypes);
    const hasMoves = GameCore.canMakeMove(state);

    // 1. Check Win Condition:
    // If custom win condition matrix is set
    if (state.winConditionGrid && Array.isArray(state.winConditionGrid)) {
      let matches = true;
      for (const [r, c] of playableCells) {
        const expected = state.winConditionGrid[r]?.[c];
        const actual = state.grid[r]?.[c];
        if (expected !== null && expected !== undefined && expected > 0) {
          if (actual !== expected) {
            matches = false;
            break;
          }
        }
      }
      if (matches) return 'win';
    } else {
      // Standard Akure: ZERO 'null' cells left on playable board
      if (emptyCells.length === 0 && playableCells.length > 0) {
        return 'win';
      }
    }

    // 2. Check Max Moves limit (if defined in Quest level)
    if (state.akureMaxMoves && state.levelMoves >= state.akureMaxMoves) {
      return emptyCells.length === 0 ? 'win' : 'lose';
    }

    // 3. Lose if no more moves can be made and board not filled
    if (!hasMoves) {
      return 'lose';
    }

    return null;
  },
};
