/**
 * GridService - Manages grid-related operations and calculations.
 */
export const GridService = (() => {
  /**
   * Creates empty grid of specified size.
   * @param {number} size - Grid size.
   * @returns {Array<Array<null>>} Empty grid.
   */
  const createEmptyGrid = (size) => {
    return Array.from({ length: size }, () => Array(size).fill(null));
  };

  /**
   * Deep clones grid.
   * @param {Array<Array<number|null>>} grid - Grid to clone.
   * @returns {Array<Array<number|null>>} Cloned grid.
   */
  const cloneGrid = (grid) => {
    return grid.map(row => [...row]);
  };

  /**
   * Checks whether a grid position is valid.
   * @param {number} row
   * @param {number} col
   * @param {number} size
   * @returns {boolean}
   */
  /**
   * Checks whether a grid position is valid and playable (not inactive void).
   * @param {number} row
   * @param {number} col
   * @param {number} size
   * @param {Array<Array<string>>} [cellTypes]
   * @returns {boolean}
   */
  const isValidPosition = (row, col, size, cellTypes = null) => {
    const inBounds = Number.isInteger(row) && Number.isInteger(col) &&
                     row >= 0 && row < size && 
                     col >= 0 && col < size;
    if (!inBounds) return false;
    if (cellTypes && cellTypes[row] && cellTypes[row][col] === 'inactive') {
      return false;
    }
    return true;
  };

  /**
   * Finds new position after movement in direction, stopping before obstacles and inactive void cells.
   * @param {Array<Array<number|null>>} grid
   * @param {number} size
   * @param {number} row - Starting row.
   * @param {number} col - Starting column.
   * @param {number} deltaRow - Row movement delta.
   * @param {number} deltaCol - Column movement delta.
   * @param {Array<Array<string>>} [cellTypes]
   * @returns {[number, number]} New position.
   */
  const findNewPosition = (grid, size, row, col, deltaRow, deltaCol, cellTypes = null) => {
    let newRow = row + deltaRow;
    let newCol = col + deltaCol;
    
    while (isValidPosition(newRow, newCol, size, cellTypes) && 
           grid[newRow][newCol] === null) {
      row = newRow;
      col = newCol;
      newRow += deltaRow;
      newCol += deltaCol;
    }
    
    return [row, col];
  };

  /**
   * Gets all playable (non-inactive) cell positions.
   * @param {number} size
   * @param {Array<Array<string>>} [cellTypes]
   * @returns {Array<[number, number]>}
   */
  const getAllPlayableCells = (size, cellTypes = null) => {
    const playable = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!cellTypes || cellTypes[r]?.[c] !== 'inactive') {
          playable.push([r, c]);
        }
      }
    }
    return playable;
  };

  /**
   * Gets random empty cell position.
   * @param {Array<Array<number|null>>} grid
   * @param {number} size
   * @param {Array<Array<string>>} [cellTypes]
   * @returns {[number, number]|null} Random empty position or null.
   */
  const getRandomEmptyCell = (grid, size, cellTypes = null) => {
    const emptyCells = getAllEmptyCells(grid, size, cellTypes);
    return emptyCells.length > 0 ? 
      emptyCells[Math.floor(Math.random() * emptyCells.length)] : null;
  };

  /**
   * Gets all empty cell positions on playable tiles.
   * @param {Array<Array<number|null>>} grid
   * @param {number} size
   * @param {Array<Array<string>>} [cellTypes]
   * @returns {Array<[number, number]>} Array of empty positions.
   */
  const getAllEmptyCells = (grid, size, cellTypes = null) => {
    const emptyCells = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if ((!cellTypes || cellTypes[r]?.[c] !== 'inactive') && grid[r]?.[c] === null) {
          emptyCells.push([r, c]);
        }
      }
    }
    return emptyCells;
  };

  /**
   * Calculates total grid value sum.
   * @param {Array<Array<number|null>>} grid
   * @returns {number} Sum of all cell values.
   */
  const calculateGridSum = (grid) => {
    return grid.flat()
      .filter(val => val !== null && typeof val === 'number' && val > 0)
      .reduce((sum, val) => sum + val, 0);
  };

  /**
   * Checks if two grids are identical.
   * @param {Array<Array<number|null>>} grid1 
   * @param {Array<Array<number|null>>} grid2 
   * @returns {boolean} True if grids are identical, false otherwise.
   */
  const areGridsIdentical = (grid1, grid2) => {
    if (!grid1 || !grid2 || grid1.length !== grid2.length || grid1[0].length !== grid2[0].length) {
      return false;
    }
    for (let r = 0; r < grid1.length; r++) {
      for (let c = 0; c < grid1[r].length; c++) {
        if (grid1[r][c] !== grid2[r][c]) {
          return false;
        }
      }
    }
    return true;
  };

  /**
   * Gets all empty cell positions for Infinity mode, accounting for cells that will disappear.
   * Combines currently empty cells (null) with cells designated to disappear.
   * @param {Array<Array<number|null>>} grid - Current grid.
   * @param {number} size - Grid size.
   * @param {Array<{row: number, col: number}>} [disappearingCells=[]] - Cells scheduled to disappear.
   * @param {Array<Array<string>>} [cellTypes]
   * @returns {Array<[number, number]>} Array of empty and disappearing positions.
   */
  const getAllEmptyCellsInfinity = (grid, size, disappearingCells = [], cellTypes = null) => {
    const emptyCells = [];
    const disappearingSet = new Set(
      disappearingCells.map(c => `${c.row},${c.col}`)
    );

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (cellTypes && cellTypes[r]?.[c] === 'inactive') continue;
        if (grid[r]?.[c] === null || disappearingSet.has(`${r},${c}`)) {
          emptyCells.push([r, c]);
        }
      }
    }
    return emptyCells;
  };

  return {
    createEmptyGrid,
    cloneGrid,
    findNewPosition,
    getRandomEmptyCell,
    getAllEmptyCells,
    getAllPlayableCells,
    getAllEmptyCellsInfinity,
    calculateGridSum,
    areGridsIdentical,
    isValidPosition,
  };
})();
