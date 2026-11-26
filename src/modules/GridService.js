/**
 * GridService - Manages grid-related operations and calculations.
 */
export const GridService = (() => {
  /**
   * Calculates row length for a regular hexagonal grid of given radius/size.
   * Total rows = 2 * size - 1. Center row index = size - 1 with length 2 * size - 1.
   * @param {number} size
   * @param {number} r
   * @returns {number}
   */
  const hexRowLength = (size, r) => {
    return (2 * size - 1) - Math.abs(r - (size - 1));
  };

  /**
   * Converts hex grid (row, col) to cube coordinates (x, y, z) where x + y + z = 0.
   * @param {number} size
   * @param {number} r
   * @param {number} c
   * @returns {{x: number, y: number, z: number}}
   */
  const hexRcToCube = (size, r, c) => {
    const R = size - 1;
    const y = R - r;
    const xMin = Math.max(-R, -R - y);
    const x = xMin + c;
    const z = -x - y;
    return { x, y, z };
  };

  /**
   * Converts cube coordinates (x, y, z) back to hex grid [row, col].
   * @param {number} size
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {[number, number]}
   */
  const hexCubeToRc = (size, x, y, z) => {
    const R = size - 1;
    const r = R - y;
    const xMin = Math.max(-R, -R - y);
    const c = x - xMin;
    return [r, c];
  };

  /**
   * Checks whether cube coordinates lie within a regular hexagon of radius (size - 1).
   * @param {number} size
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {boolean}
   */
  const isHexValidCube = (size, x, y, z) => {
    const R = size - 1;
    return Math.abs(x) <= R && Math.abs(y) <= R && Math.abs(z) <= R && (x + y + z === 0);
  };

  /**
   * Creates empty grid of specified size and grid type.
   * @param {number} size - Grid size (or hex radius parameter).
   * @param {*} [fillVal=null] - Value to fill each cell with.
   * @param {string} [gridType='square'] - 'square' or 'hex'.
   * @returns {Array<Array<*>>} Empty grid.
   */
  const createEmptyGrid = (size, fillVal = null, gridType = 'square') => {
    if (gridType === 'hex') {
      const numRows = 2 * size - 1;
      return Array.from({ length: numRows }, (_, r) => Array(hexRowLength(size, r)).fill(fillVal));
    }
    return Array.from({ length: size }, () => Array(size).fill(fillVal));
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
   * Checks whether a grid position is valid and playable (not inactive void).
   * @param {number} row
   * @param {number} col
   * @param {number} size
   * @param {Array<Array<string>>} [cellTypes]
   * @param {string} [gridType='square']
   * @returns {boolean}
   */
  const isValidPosition = (row, col, size, cellTypes = null, gridType = 'square') => {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const isHex = gridType === 'hex';
    const numRows = isHex ? 2 * size - 1 : size;
    if (row < 0 || row >= numRows) return false;
    const numCols = isHex ? hexRowLength(size, row) : size;
    if (col < 0 || col >= numCols) return false;
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
    
    while (isValidPosition(newRow, newCol, size, cellTypes, 'square') && 
           grid[newRow][newCol] === null) {
      row = newRow;
      col = newCol;
      newRow += deltaRow;
      newCol += deltaCol;
    }
    
    return [row, col];
  };

  /**
   * Finds new position in a hexagonal grid after sliding in direction delta.
   * @param {Array<Array<number|null>>} grid
   * @param {number} size
   * @param {number} row - Candidate starting row.
   * @param {number} col - Candidate starting column.
   * @param {{dx: number, dy: number, dz: number}} dirDelta - Hex direction delta.
   * @param {Array<Array<string>>} [cellTypes]
   * @returns {[number, number]} Furthest reachable [row, col].
   */
  const findNewPositionHex = (grid, size, row, col, dirDelta, cellTypes = null) => {
    if (!isValidPosition(row, col, size, cellTypes, 'hex') || grid[row]?.[col] !== null) {
      return [row, col];
    }
    const { dx, dy, dz } = dirDelta;
    let cube = hexRcToCube(size, row, col);

    while (true) {
      const nextX = cube.x + dx;
      const nextY = cube.y + dy;
      const nextZ = cube.z + dz;
      const R = size - 1;
      if (Math.abs(nextX) > R || Math.abs(nextY) > R || Math.abs(nextZ) > R) {
        break;
      }
      const [nextR, nextC] = hexCubeToRc(size, nextX, nextY, nextZ);
      if (cellTypes && cellTypes[nextR]?.[nextC] === 'inactive') {
        break;
      }
      if (grid[nextR]?.[nextC] !== null) {
        break;
      }
      row = nextR;
      col = nextC;
      cube = { x: nextX, y: nextY, z: nextZ };
    }
    return [row, col];
  };

  /**
   * Gets all playable (non-inactive) cell positions.
   * @param {number} size
   * @param {Array<Array<string>>} [cellTypes]
   * @param {string} [gridType='square']
   * @returns {Array<[number, number]>}
   */
  const getAllPlayableCells = (size, cellTypes = null, gridType = 'square') => {
    const isHex = gridType === 'hex';
    const numRows = isHex ? 2 * size - 1 : size;
    const playable = [];
    for (let r = 0; r < numRows; r++) {
      const numCols = isHex ? hexRowLength(size, r) : size;
      for (let c = 0; c < numCols; c++) {
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
   * @param {string} [gridType='square']
   * @returns {[number, number]|null} Random empty position or null.
   */
  const getRandomEmptyCell = (grid, size, cellTypes = null, gridType = 'square') => {
    const emptyCells = getAllEmptyCells(grid, size, cellTypes, gridType);
    return emptyCells.length > 0 ? 
      emptyCells[Math.floor(Math.random() * emptyCells.length)] : null;
  };

  /**
   * Gets all empty cell positions on playable tiles.
   * @param {Array<Array<number|null>>} grid
   * @param {number} size
   * @param {Array<Array<string>>} [cellTypes]
   * @param {string} [gridType='square']
   * @returns {Array<[number, number]>} Array of empty positions.
   */
  const getAllEmptyCells = (grid, size, cellTypes = null, gridType = 'square') => {
    const isHex = gridType === 'hex';
    const numRows = isHex ? 2 * size - 1 : size;
    const emptyCells = [];
    for (let r = 0; r < numRows; r++) {
      const numCols = isHex ? hexRowLength(size, r) : size;
      for (let c = 0; c < numCols; c++) {
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
    if (!grid1 || !grid2 || grid1.length !== grid2.length) {
      return false;
    }
    for (let r = 0; r < grid1.length; r++) {
      if (!grid1[r] || !grid2[r] || grid1[r].length !== grid2[r].length) {
        return false;
      }
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
   * @param {string} [gridType='square']
   * @returns {Array<[number, number]>} Array of empty and disappearing positions.
   */
  const getAllEmptyCellsInfinity = (grid, size, disappearingCells = [], cellTypes = null, gridType = 'square') => {
    const isHex = gridType === 'hex';
    const numRows = isHex ? 2 * size - 1 : size;
    const emptyCells = [];
    const disappearingSet = new Set(
      disappearingCells.map(c => `${c.row},${c.col}`)
    );

    for (let r = 0; r < numRows; r++) {
      const numCols = isHex ? hexRowLength(size, r) : size;
      for (let c = 0; c < numCols; c++) {
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
    findNewPositionHex,
    getRandomEmptyCell,
    getAllEmptyCells,
    getAllPlayableCells,
    getAllEmptyCellsInfinity,
    calculateGridSum,
    areGridsIdentical,
    isValidPosition,
    hexRowLength,
    hexRcToCube,
    hexCubeToRc,
    isHexValidCube,
  };
})();
