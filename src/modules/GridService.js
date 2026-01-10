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
  const isValidPosition = (row, col, size) => {
    return Number.isInteger(row) && Number.isInteger(col) &&
           row >= 0 && row < size && 
           col >= 0 && col < size;
  };

  /**
   * Finds new position after movement in direction.
   * @param {Array<Array<number|null>>} grid
   * @param {number} size
   * @param {number} row - Starting row.
   * @param {number} col - Starting column.
   * @param {number} deltaRow - Row movement delta.
   * @param {number} deltaCol - Column movement delta.
   * @returns {[number, number]} New position.
   */
  const findNewPosition = (grid, size, row, col, deltaRow, deltaCol) => {
    let newRow = row + deltaRow;
    let newCol = col + deltaCol;
    
    while (isValidPosition(newRow, newCol, size) && 
           grid[newRow][newCol] === null) {
      row = newRow;
      col = newCol;
      newRow += deltaRow;
      newCol += deltaCol;
    }
    
    return [row, col];
  };

  /**
   * Gets random empty cell position.
   * @param {Array<Array<number|null>>} grid
   * @param {number} size
   * @returns {[number, number]|null} Random empty position or null.
   */
  const getRandomEmptyCell = (grid, size) => {
    const emptyCells = [];
    
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === null) {
          emptyCells.push([r, c]);
        }
      }
    }
    
    return emptyCells.length > 0 ? 
      emptyCells[Math.floor(Math.random() * emptyCells.length)] : null;
  };

  /**
   * Gets all empty cell positions.
   * @param {Array<Array<number|null>>} grid
   * @param {number} size
   * @returns {Array<[number, number]>} Array of empty positions.
   */
  const getAllEmptyCells = (grid, size) => {
    const emptyCells = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === null) {
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
      .filter(val => val !== null)
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

  return {
    createEmptyGrid,
    cloneGrid,
    findNewPosition,
    getRandomEmptyCell,
    getAllEmptyCells,
    calculateGridSum,
    areGridsIdentical,
    isValidPosition,
  };
})();
