import assert from 'node:assert/strict';

import { GameCore } from '../src/core/GameCore.js';
import { GridService } from '../src/modules/GridService.js';
import { StateManager } from '../src/modules/StateManager.js';
import { SnapshotService } from '../src/modules/SnapshotService.js';
import { ErrorHandler } from '../src/modules/ErrorHandling.js';
import { GameValidator } from '../src/modules/GameValidator.js';
import { PerformanceUtils } from '../src/modules/PerformanceUtils.js';
import { registerMode, getModeRules, getRegisteredModes } from '../src/modules/ModeRules.js';
import { StorageService } from '../src/modules/StorageService.js';
import { GameLogic } from '../src/modules/GameLogic.js';
import { EventBus } from '../src/modules/EventBus.js';
import { WorkerService } from '../src/modules/WorkerService.js';

console.log('--- RUNNING COMPREHENSIVE TEST SUITE ---');

// 1. GridService tests
console.log('\n[1/8] Testing GridService...');
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
console.log('  ✅ GridService passed all checks.');

// 2. EventBus tests (EDA)
console.log('\n[2/8] Testing EventBus (EDA architecture)...');
let eventFiredCount = 0;
let lastPayload = null;

const unsubscribe = EventBus.on('test:event', (payload) => {
  eventFiredCount++;
  lastPayload = payload;
});

EventBus.emit('test:event', { foo: 'bar' });
assert.equal(eventFiredCount, 1);
assert.deepEqual(lastPayload, { foo: 'bar' });

// Test once()
let onceCount = 0;
EventBus.once('test:once', () => { onceCount++; });
EventBus.emit('test:once');
EventBus.emit('test:once');
assert.equal(onceCount, 1, 'once() should only fire on the first emission');

// Test off()
unsubscribe();
EventBus.emit('test:event', { foo: 'baz' });
assert.equal(eventFiredCount, 1, 'Listener should not fire after unsubscription');
console.log('  ✅ EventBus passed all checks.');

// 3. StateManager tests & EventBus integration
console.log('\n[3/8] Testing StateManager & EventBus integration...');
let stateEventReceived = null;
const offState = EventBus.on('state:change', (fullState) => {
  stateEventReceived = fullState;
});

StateManager.initializeState();
assert.equal(StateManager.getGameState().score, 0);
assert.equal(StateManager.getGameState().moves, 0);
assert.equal(StateManager.getUIState().theme, 'dark');

StateManager.setState({ score: 42, moves: 7 });
assert.equal(StateManager.getGameState().score, 42);
assert.equal(StateManager.getGameState().moves, 7);

StateManager.setState({ theme: 'light', showValues: false });
assert.equal(StateManager.getUIState().theme, 'light');
assert.equal(StateManager.getUIState().showValues, false);

offState();
console.log('  ✅ StateManager passed all checks.');

// 4. SnapshotService (Undo/Redo Integrity)
console.log('\n[4/8] Testing SnapshotService...');
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
console.log('  ✅ SnapshotService passed all checks.');

// 5. ModeRules & Strategy Pattern
console.log('\n[5/8] Testing ModeRules (Strategy Pattern)...');
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
    // Missing required methods
  });
}, /missing required method/);
console.log('  ✅ ModeRules passed all checks.');

// 6. GameCore Edge Cases: Blocked Grid & Win Conditions
console.log('\n[6/8] Testing GameCore edge cases...');

// Edge case 1: Fully blocked grid (Game Over condition)
const blockedGrid = {
  grid: [
    [2, 4],
    [8, 16]
  ],
  size: 2,
  gameMode: 'infinity',
  moves: 10
};
assert.equal(GameCore.canMakeMove(blockedGrid), false, 'Grid without empty neighbors should detect no moves possible');

// Edge case 2: Grid with placeholder cells (1) allows moves
const placeholderGrid = {
  grid: [
    [1, 1],
    [1, 1]
  ],
  size: 2,
  gameMode: 'infinity',
  moves: 5
};
assert.equal(GameCore.canMakeMove(placeholderGrid), true, 'Placeholder cells (1) must keep the game playable');

// Edge case 3: Quest mode win condition (all cells empty)
const winQuestState = {
  grid: [
    [null, null],
    [null, null]
  ],
  size: 2,
  gameMode: 'quest'
};
assert.equal(GameCore.checkQuestOutcome(winQuestState), 'win', 'Completely empty grid in quest mode is a win');

// Edge case 4: Quest mode lose condition (no empties and no moves)
const loseQuestState = {
  grid: [
    [2, 4],
    [8, 16]
  ],
  size: 2,
  gameMode: 'quest'
};
assert.equal(GameCore.checkQuestOutcome(loseQuestState), 'lose', 'Blocked grid in quest mode is a loss');

// Edge case 5: RANDOM_TILE_SPAWN_LIMITS per field size
import { RANDOM_TILE_SPAWN_LIMITS } from '../src/modules/constants.js';
for (const s of [3, 4, 5, 7, 9, 11]) {
  assert.ok(RANDOM_TILE_SPAWN_LIMITS[s], `Spawn limits must exist for size ${s}`);
  assert.ok(typeof RANDOM_TILE_SPAWN_LIMITS[s].maxGridSum === 'number');
  assert.ok(typeof RANDOM_TILE_SPAWN_LIMITS[s].minEmptyCells === 'number');
}

// Check that spawn is suppressed when exceeding maxGridSum
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
assert.equal(GameCore.maybeAddRandomCell(exceedSumState), null, 'Should not spawn tile when gridSum > maxGridSum (100 > 75)');
console.log('  ✅ GameCore edge cases & spawn limits passed all checks.');

// 7. StorageService & Migration
console.log('\n[7/8] Testing StorageService & Schema Migration...');
StorageService.migrateIfNeeded();
const statsStore = StorageService.getStatsStore();
assert.ok(typeof statsStore.version === 'number');
assert.ok(Array.isArray(statsStore.games));
console.log('  ✅ StorageService migration passed.');

// 8. WorkerService Fallback
console.log('\n[8/8] Testing WorkerService sync fallback...');
const workerMoveResult = WorkerService.computeMove({
  grid: [[2, null], [null, null]],
  size: 2,
  gameMode: 'infinity',
  moves: 1
}, 'ArrowRight');

assert.equal(workerMoveResult.changed, true);
assert.equal(workerMoveResult.patch.grid[0][0], 1);
assert.equal(workerMoveResult.patch.grid[0][1], 1);
console.log('  ✅ WorkerService fallback passed.');

console.log('\n======================================================');
console.log('🎉 ALL COMPREHENSIVE EDGE-CASE TESTS PASSED (100%)');
console.log('======================================================\n');
