import { GridService } from './GridService.js';
import { AKURE_INITIAL_TILES } from './constants.js';

/**
 * AkureLevelGenerator - Manages curated Akure Quest campaign levels and procedural puzzle generation.
 * Core rule: Players must divide tiles so that ZERO 'null' cells remain on the playable grid.
 */
export const AkureLevelGenerator = (() => {
  /**
   * Curated campaign levels for Akure Quest mode.
   * Levels progress from small 3x3 boards to complex 4x4 and 5x5 boards with obstacles and move budgets.
   */
  const CAMPAIGN_LEVELS = [
    {
      level: 1,
      name: 'Akure Quest 1: Split to Fill',
      size: 3,
      maxMoves: 6,
      initialTiles: [
        { row: 1, col: 1, value: 128 }
      ],
      description: 'Divide the 128 tile into halves to fill all 9 cells in 6 moves.'
    },
    {
      level: 2,
      name: 'Akure Quest 2: Dual Core',
      size: 3,
      maxMoves: 5,
      initialTiles: [
        { row: 0, col: 1, value: 64 },
        { row: 2, col: 1, value: 64 }
      ],
      description: 'Fill the 3x3 board using two starting 64 tiles in 5 moves.'
    },
    {
      level: 3,
      name: 'Akure Quest 3: Corner Start',
      size: 3,
      maxMoves: 6,
      initialTiles: [
        { row: 0, col: 0, value: 128 }
      ],
      description: 'Navigate from the top-left corner to spread across all 9 cells.'
    },
    {
      level: 4,
      name: 'Akure Quest 4: The 4x4 Awakening',
      size: 4,
      maxMoves: 8,
      initialTiles: [
        { row: 1, col: 1, value: 256 }
      ],
      description: 'Divide the 256 tile to occupy all 16 cells in 8 moves.'
    },
    {
      level: 5,
      name: 'Akure Quest 5: Symmetrical Division',
      size: 4,
      maxMoves: 7,
      initialTiles: [
        { row: 1, col: 1, value: 128 },
        { row: 2, col: 2, value: 128 }
      ],
      description: 'Synchronize the two 128 cores to fill the 4x4 grid in 7 moves.'
    },
    {
      level: 6,
      name: 'Akure Quest 6: Island Center',
      size: 4,
      maxMoves: 9,
      cellTypes: [
        ['active', 'active', 'active', 'active'],
        ['active', 'inactive', 'inactive', 'active'],
        ['active', 'inactive', 'inactive', 'active'],
        ['active', 'active', 'active', 'active']
      ],
      initialTiles: [
        { row: 0, col: 0, value: 128 },
        { row: 3, col: 3, value: 128 }
      ],
      description: 'Fill the outer ring (12 cells) around the central wall.'
    },
    {
      level: 7,
      name: 'Akure Quest 7: The Cross',
      size: 5,
      maxMoves: 10,
      cellTypes: [
        ['inactive', 'inactive', 'active', 'inactive', 'inactive'],
        ['inactive', 'inactive', 'active', 'inactive', 'inactive'],
        ['active', 'active', 'active', 'active', 'active'],
        ['inactive', 'inactive', 'active', 'inactive', 'inactive'],
        ['inactive', 'inactive', 'active', 'inactive', 'inactive']
      ],
      initialTiles: [
        { row: 2, col: 2, value: 256 }
      ],
      description: 'Distribute tiles along the cross to fill all 9 active cells in 10 moves.'
    },
    {
      level: 8,
      name: 'Akure Quest 8: 5x5 Grand Fill',
      size: 5,
      maxMoves: 12,
      initialTiles: [
        { row: 2, col: 2, value: 512 }
      ],
      description: 'Fill all 25 cells of the 5x5 board starting from a single 512 tile.'
    },
    {
      level: 9,
      name: 'Akure Quest 9: Four Pillars',
      size: 5,
      maxMoves: 10,
      initialTiles: [
        { row: 1, col: 1, value: 128 },
        { row: 1, col: 3, value: 128 },
        { row: 3, col: 1, value: 128 },
        { row: 3, col: 3, value: 128 }
      ],
      description: 'Coordinate four 128 pillars to achieve 100% board fill in 10 moves.'
    },
    {
      level: 10,
      name: 'Akure Quest 10: Master Architect',
      size: 5,
      maxMoves: 14,
      cellTypes: [
        ['active', 'active', 'active', 'active', 'active'],
        ['active', 'inactive', 'active', 'inactive', 'active'],
        ['active', 'active', 'active', 'active', 'active'],
        ['active', 'inactive', 'active', 'inactive', 'active'],
        ['active', 'active', 'active', 'active', 'active']
      ],
      initialTiles: [
        { row: 2, col: 2, value: 512 }
      ],
      description: 'Fill all 21 active cells avoiding the 4 pillar obstacles in 14 moves.'
    }
  ];

  /**
   * Retrieves a campaign level by number (1-indexed).
   * @param {number} levelNum
   * @returns {Object}
   */
  const getLevel = (levelNum) => {
    const idx = (levelNum - 1) % CAMPAIGN_LEVELS.length;
    return CAMPAIGN_LEVELS[idx] || CAMPAIGN_LEVELS[0];
  };

  /**
   * Gets total number of curated campaign levels.
   * @returns {number}
   */
  const getTotalLevels = () => CAMPAIGN_LEVELS.length;

  /**
   * Generates a procedural random Akure puzzle for free play.
   * Calculates minimum required initial value so that the total sum >= playableCells * 2.
   * @param {number} size
   * @param {Array<Array<string>>} [cellTypes]
   * @returns {Object}
   */
  const generateRandomLevel = (size = 4, cellTypes = null) => {
    const playableCells = GridService.getAllPlayableCells(size, cellTypes);
    const count = playableCells.length;

    // Minimum sum needed to give at least value 2 to each cell is count * 2
    let targetValue = 16;
    while (targetValue < count * 8 && targetValue < 4096) {
      targetValue *= 2;
    }

    // Pick 1 or 2 random starting positions
    const shuffled = [...playableCells].sort(() => Math.random() - 0.5);
    const numStartingTiles = size >= 5 ? 2 : 1;
    const initialTiles = [];

    if (numStartingTiles === 1) {
      const [r, c] = shuffled[0];
      initialTiles.push({ row: r, col: c, value: targetValue });
    } else {
      const halfValue = Math.max(16, targetValue / 2);
      initialTiles.push({ row: shuffled[0][0], col: shuffled[0][1], value: halfValue });
      initialTiles.push({ row: shuffled[1][0], col: shuffled[1][1], value: halfValue });
    }

    return {
      name: `Random Akure ${size}x${size}`,
      size,
      cellTypes,
      initialTiles,
      maxMoves: Math.round(count * 0.75) + 4,
    };
  };

  return {
    getLevel,
    getTotalLevels,
    generateRandomLevel,
    CAMPAIGN_LEVELS,
  };
})();
