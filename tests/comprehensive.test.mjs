import test from 'node:test';
import assert from 'node:assert/strict';

import { GameCore } from '../src/core/GameCore.js';
import { GridService } from '../src/modules/GridService.js';
import { StateManager } from '../src/modules/StateManager.js';
import { SnapshotService } from '../src/modules/SnapshotService.js';
import { GameValidator } from '../src/modules/GameValidator.js';
import { PerformanceUtils } from '../src/modules/PerformanceUtils.js';
import { registerMode, getModeRules, getRegisteredModes } from '../src/modules/ModeRules.js';
import { StorageService } from '../src/modules/StorageService.js';
import { GameLogic } from '../src/modules/GameLogic.js';
import { EventBus } from '../src/modules/EventBus.js';
import { WorkerService } from '../src/modules/WorkerService.js';
import { RANDOM_TILE_SPAWN_LIMITS } from '../src/modules/constants.js';

test('1. GridService operations', () => {
  const empty3 = GridService.createEmptyGrid(3);
  assert.equal(empty3.length, 3);
  assert.equal(empty3[0].length, 3);
  assert.equal(empty3.flat().every(v => v === null), true);

  const matrix = [[2, 4], [null, 8]];
  const clonedMatrix = GridService.cloneGrid(matrix);
  assert.deepEqual(clonedMatrix, matrix);
  clonedMatrix[0][0] = 999;
  assert.equal(matrix[0][0], 2);

  assert.equal(GridService.isValidPosition(0, 0, 3), true);
  assert.equal(GridService.isValidPosition(2, 2, 3), true);
  assert.equal(GridService.isValidPosition(-1, 0, 3), false);
  assert.equal(GridService.isValidPosition(3, 0, 3), false);
  assert.equal(GridService.isValidPosition(0, 3, 3), false);
  assert.equal(GridService.isValidPosition(1.5, 0, 3), false);

  const [newRow, newCol] = GridService.findNewPosition([[2, null, null], [null, null, null], [null, null, null]], 3, 0, 0, 0, 1);
  assert.equal(newRow, 0);
  assert.equal(newCol, 2);

  assert.equal(GridService.calculateGridSum(matrix), 14);
  assert.equal(GridService.getAllEmptyCells([[2, null], [null, 4]], 2).length, 2);
  assert.equal(GridService.getAllEmptyCellsInfinity([[2, null], [null, 4]], 2, [{ row: 0, col: 0 }]).length, 3);
  assert.equal(GridService.areGridsIdentical(matrix, matrix), true);
  assert.equal(GridService.areGridsIdentical(matrix, clonedMatrix), false);
});

test('2. EventBus architecture', () => {
  let eventFiredCount = 0;
  let lastPayload = null;

  const unsubscribe = EventBus.on('test:event', (payload) => {
    eventFiredCount++;
    lastPayload = payload;
  });

  EventBus.emit('test:event', { foo: 'bar' });
  assert.equal(eventFiredCount, 1);
  assert.deepEqual(lastPayload, { foo: 'bar' });

  unsubscribe();
  EventBus.emit('test:event', { foo: 'baz' });
  assert.equal(eventFiredCount, 1);
});

test('3. StateManager & EventBus integration', async () => {
  let stateReceived = null;
  const unsubState = StateManager.subscribe((st) => {
    stateReceived = st;
  });

  StateManager.setState({ score: 120 });
  assert.equal(StateManager.getState().score, 120);

  // Allow scheduled publish timer (16ms) to fire
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(stateReceived.score, 120);

  unsubState();
});

test('4. SnapshotService', () => {
  const sampleState = {
    grid: [[4, null], [2, 16]],
    moves: 5, levelMoves: 2, totalMoves: 7,
    score: 24, levelScore: 8, totalScore: 32
  };
  const snap = SnapshotService.makeSnapshot(sampleState);
  sampleState.grid[0][0] = 128;

  const restoredState = SnapshotService.restoreSnapshot(snap);
  assert.equal(restoredState.grid[0][0], 4);
  assert.equal(restoredState.moves, 5);
  assert.equal(restoredState.score, 24);
});

test('5. ModeRules strategy pattern', () => {
  assert.ok(getModeRules('infinity'));
  assert.ok(getModeRules('quest'));

  registerMode('zen_mode', {
    applyMoveCounters: prev => ({ moves: prev.moves + 1 }),
    applyScore: (prev, d) => ({ score: prev.score + (d || 0) }),
    onLose: () => {},
    onWin: () => {}
  });
  assert.ok(getRegisteredModes().includes('zen_mode'));
  const zenStrategy = getModeRules('zen_mode');
  assert.equal(zenStrategy.applyMoveCounters({ moves: 10 }).moves, 11);

  assert.throws(() => {
    registerMode('bad_strategy', {
      applyMoveCounters: () => {}
    });
  }, /missing required method/);
});

test('6. GameCore edge cases and spawn limits', () => {
  const blockedGrid = {
    grid: [
      [2, 4],
      [8, 16]
    ],
    size: 2,
    gameMode: 'infinity',
    moves: 10
  };
  assert.equal(GameCore.canMakeMove(blockedGrid), false);

  const placeholderGrid = {
    grid: [
      [1, 1],
      [1, 1]
    ],
    size: 2,
    gameMode: 'infinity',
    moves: 5
  };
  assert.equal(GameCore.canMakeMove(placeholderGrid), true);

  const winQuestState = {
    grid: [
      [null, null],
      [null, null]
    ],
    size: 2,
    gameMode: 'quest'
  };
  assert.equal(GameCore.checkQuestOutcome(winQuestState), 'win');

  const loseQuestState = {
    grid: [
      [2, 4],
      [8, 16]
    ],
    size: 2,
    gameMode: 'quest'
  };
  assert.equal(GameCore.checkQuestOutcome(loseQuestState), 'lose');

  for (const s of [3, 4, 5, 7, 9, 11]) {
    assert.ok(RANDOM_TILE_SPAWN_LIMITS[s]);
  }

  const exceedSumState = {
    grid: [
      [100, null, null],
      [null, null, null],
      [null, null, null]
    ],
    size: 3,
    gameMode: 'infinity',
    moves: 1
  };
  assert.equal(GameCore.maybeAddRandomCell(exceedSumState), null);
});

test('7. StorageService & schema migration with deduplication', () => {
  StorageService.migrateIfNeeded();
  const statsStore = StorageService.getStatsStore();
  assert.ok(typeof statsStore.version === 'number');
  assert.ok(Array.isArray(statsStore.games));

  const initialCount = statsStore.games.length;
  const sampleStats = {
    date: '16.11.2026',
    time: '19:05:30',
    size: 3,
    moves: 4,
    score: 0,
    mode: 'quest',
  };

  StorageService.saveGameStats(sampleStats);
  const afterFirstSave = StorageService.getStatsStore().games.length;
  assert.equal(afterFirstSave, initialCount + 1);

  // Immediate second save of identical game stats should be ignored by deduplication
  StorageService.saveGameStats(sampleStats);
  const afterSecondSave = StorageService.getStatsStore().games.length;
  assert.equal(afterSecondSave, initialCount + 1, 'Duplicate game stats within recent window should be deduplicated');
});

test('8. WorkerService sync fallback', () => {
  const workerMoveResult = WorkerService.computeMove({
    grid: [[2, null], [null, null]],
    size: 2,
    gameMode: 'infinity',
    moves: 1
  }, 'ArrowRight');

  assert.equal(workerMoveResult.changed, true);
  assert.equal(workerMoveResult.patch.grid[0][0], 1);
  assert.equal(workerMoveResult.patch.grid[0][1], 1);
});
