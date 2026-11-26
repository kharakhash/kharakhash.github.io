// === Constants ===
export const ANIMATION_DURATION = 300;
export const DEFAULT_SIZE = 3;
export const DEBOUNCE_TIME = 300;
export const MAX_HISTORY_SIZE = 30;
export const SWIPE_THRESHOLD = 30;

// Performance optimization constants
export const BATCH_UPDATE_DELAY = 16; // ~60fps
export const DOM_CACHE_REFRESH_INTERVAL = 1000;

// Initial tile values by grid size //
export const INITIAL_TILES = {
  3: [32, 16, 8],
  4: [128, 64, 32, 16, 8],
  5: [256, 128, 64, 32, 8],
  6: [512, 256, 128, 64, 32, 16],
  7: [1024, 1024, 512, 256, 128, 64, 32, 32],
  8: [2048, 1024, 512, 256, 128, 64, 32, 16],
  9: [2048, 1024, 1024, 512, 512, 256, 128],
  10: [4096, 2048, 2048, 1024, 1024, 1024, 512, 256],
  11: [4096, 2048, 2048, 1024, 1024, 1024, 512, 256, 128]
};

// Random tile values by grid size
export const RANDOM_TILE_VALUES = {
  3: () => Math.random() < 0.7 ? 16 : 32,
  4: () => Math.random() < 0.7 ? 32 : 64,
  5: () => Math.random() < 0.7 ? 64 : 128,
  6: () => Math.random() < 0.7 ? 128 : 256,
  7: () => Math.random() < 0.6 ? 512 : 1024,
  8: () => Math.random() < 0.5 ? 1024 : 2048,
  9: () => Math.random() < 0.3 ? 2048 : 4096,
  10: () => Math.random() < 0.1 ? 2048 : 4096,
  11: () => Math.random() < 0.1 ? 2048 : 4096
};

/**
 * Conditions under which a new random tile is NOT spawned in infinity mode.
 * - maxGridSum: if current total sum of cells > maxGridSum, new tile is NOT created.
 * - minEmptyCells: if number of remaining empty cells <= minEmptyCells, new tile is NOT created.
 * Configured separately per board size for independent balance tuning.
 */
export const RANDOM_TILE_SPAWN_LIMITS = {
  3: { maxGridSum: 40, minEmptyCells: 1 },
  4: { maxGridSum: 72, minEmptyCells: 1 },
  5: { maxGridSum: 128, minEmptyCells: 2 },
  6: { maxGridSum: 256, minEmptyCells: 3 },
  7: { maxGridSum: 512, minEmptyCells: 4 },
  8: { maxGridSum: 1024, minEmptyCells: 4 },
  9: { maxGridSum: 2048, minEmptyCells: 5 },
  10: { maxGridSum: 4096, minEmptyCells: 5 },
  11: { maxGridSum: 8192, minEmptyCells: 6 }
};

// Modes metadata for Carousel
export const MODES = ['infinity', 'quest'];

export const MODE_INFO = {
  infinity: {
    id: 'infinity',
    name: 'Infinity',
    title: 'Infinity',
    badge: 'Survival',
    desc: 'Split tiles, clear twos, and score maximum points with new tiles spawning.'
  },
  quest: {
    id: 'quest',
    name: 'Quest',
    title: 'Quest',
    badge: 'Clearance',
    desc: 'Clear the entire grid down to the very last cell by planning perfect splits.'
  }
};

// Direction deltas for movement
export const DIRECTION_DELTAS = {
  'ArrowUp': [-1, 0],
  'ArrowDown': [1, 0],
  'ArrowLeft': [0, -1],
  'ArrowRight': [0, 1]
};

// Safe fallbacks for internal core modules
export const HEX_DIRECTION_DELTAS = {};
export const HEX_INITIAL_TILES = {};
export const HEX_RANDOM_TILE_VALUES = {};
export const HEX_RANDOM_TILE_SPAWN_LIMITS = {};

// Animation class mappings
export const ANIMATION_CLASSES = {
  SPLIT_DIRECTIONS: {
    1: 'split-appear-down',
    [-1]: 'split-appear-up',
    [0]: { 1: 'split-appear-right', [-1]: 'split-appear-left' }
  }
};

