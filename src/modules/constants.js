// === Constants ===
export const ANIMATION_DURATION = 250;
export const DEFAULT_SIZE = 9;
export const DEBOUNCE_TIME = 310;
export const MAX_HISTORY_SIZE = 30;
export const SWIPE_THRESHOLD = 30;
export const RANDOM_CELL_PROBABILITY = {
  SMALL_GRID: 0.01,
  LARGE_GRID: 0.05
};

// Performance optimization constants
export const BATCH_UPDATE_DELAY = 16; // ~60fps
export const DOM_CACHE_REFRESH_INTERVAL = 1000;

// Initial tile values by grid size
export const INITIAL_TILES = {
  4: [128, 64, 32, 16, 8],
  5: [256, 128, 64, 32, 8],
  7: [2048, 1024, 512, 128, 64, 32, 32],
  9: [2048, 1024, 1024, 512, 512, 256, 128],
  11: [4096, 2048, 2048, 2048, 1024, 1024, 1024, 512, 256]
};

// Random tile values by grid size
export const RANDOM_TILE_VALUES = {
  4: () => Math.random() < 0.8 ? 32 : 64,
  5: () => Math.random() < 0.8 ? 64 : 128,
  7: () => Math.random() < 0.8 ? 1024 : 512,
  9: () => 2048,
  11: () => 2048
};

// Direction deltas for movement
export const DIRECTION_DELTAS = {
  'ArrowUp': [-1, 0],
  'ArrowDown': [1, 0],
  'ArrowLeft': [0, -1],
  'ArrowRight': [0, 1]
};

// Animation class mappings
export const ANIMATION_CLASSES = {
  SPLIT_DIRECTIONS: {
    1: 'split-appear-down',
    [-1]: 'split-appear-up',
    [0]: { 1: 'split-appear-right', [-1]: 'split-appear-left' }
  }
};
