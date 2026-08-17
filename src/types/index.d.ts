/**
 * TypeScript Type Definitions for Bulb It Puzzle Game
 */

export type Grid = (number | null)[][];

export type MoveDirection = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

export type GameMode = 'infinity' | 'quest' | string;

export interface Position {
  row: number;
  col: number;
}

export interface SplitAction {
  from: Position;
  to?: Position;
  value: number;
  deltaRow: number;
  deltaCol: number;
}

export interface SpawnedCell {
  position: Position;
  value: number;
}

export interface MoveEffects {
  splitActions: SplitAction[];
  disappearingCells: Position[];
  scoreGain: number;
  spawnedCell?: SpawnedCell;
}

export interface SpawnLimits {
  maxGridSum: number;
  minEmptyCells: number;
}

export type RandomTileSpawnLimits = Record<number, SpawnLimits>;

export interface MoveResult {
  patch: {
    grid: Grid;
  };
  changed: boolean;
  effects: MoveEffects;
}

export interface GameState {
  grid: Grid;
  size: number;
  selectedSize: number;
  history: Snapshot[];
  score: number;
  moves: number;
  levelMoves: number;
  totalMoves: number;
  levelScore: number;
  totalScore: number;
  isProcessing: boolean;
  lastMoveTime: number;
  touchStartX: number | null;
  touchStartY: number | null;
  initialGrid: Grid;
}

export interface UIState {
  theme: 'light' | 'dark' | string;
  showValues: boolean;
  gameMode: GameMode;
  isOverlayActive: boolean;
}

export interface FullState extends GameState, UIState {
  game: Readonly<GameState>;
  ui: Readonly<UIState>;
}

export type StatePatch = Partial<GameState & UIState> & {
  game?: Partial<GameState>;
  ui?: Partial<UIState>;
};

export interface Snapshot {
  grid: Grid;
  moves: number;
  levelMoves: number;
  totalMoves: number;
  score: number;
  levelScore: number;
  totalScore: number;
}

export interface GameStatsRecord {
  date: string;
  time: string;
  size: number;
  moves: number;
  score: number;
  mode: string;
  totalMoves?: number;
  totalScore?: number;
  recordedAt?: string;
}

export interface StatsStore {
  version: number;
  metadata: {
    updatedAt: string | null;
    gameCount: number;
  };
  games: GameStatsRecord[];
}

export interface ModeStrategy {
  applyMoveCounters: (prevState: Readonly<GameState>, oldState?: Readonly<FullState>) => Partial<GameState>;
  applyScore: (prevState: Readonly<GameState>, delta: number) => Partial<GameState>;
  onLose: (state: Readonly<FullState>) => void;
  onWin: (state: Readonly<FullState>) => void;
}

export interface GameIntent {
  action: 'PLACE_INITIAL_TILES' | string;
}

export interface EventMap {
  'game:move': { direction: MoveDirection; effects: MoveEffects };
  'game:score': { scoreGain: number };
  'game:win': { moves: number; score: number };
  'game:lose': { mode: string; message: string };
  'game:restart': { mode: string };
  'state:change': FullState;
  'ui:popup': { type: string; message?: string };
}
