import assert from 'node:assert/strict';

import { GameCore } from '../src/core/GameCore.js';
import { GridService } from '../src/modules/GridService.js';
import { StateManager } from '../src/modules/StateManager.js';
import { SnapshotService } from '../src/modules/SnapshotService.js';
import { ErrorHandler } from '../src/modules/ErrorHandling.js';
import { GameValidator } from '../src/modules/GameValidator.js';
import { PerformanceUtils } from '../src/modules/PerformanceUtils.js';
import { ModeRules, registerMode, getModeRules, getRegisteredModes } from '../src/modules/ModeRules.js';
import { GameLogic } from '../src/modules/GameLogic.js';

console.log('Testing GridService...');
const grid = GridService.createEmptyGrid(3);
assert.equal(grid.length, 3);
assert.equal(grid[0].length, 3);
assert.equal(grid.flat().every(v => v === null), true);

const original = [[1, 2], [3, 4]];
const cloned = GridService.cloneGrid(original);
assert.deepEqual(cloned, original);
cloned[0][0] = 99;
assert.equal(original[0][0], 1);

assert.equal(GridService.isValidPosition(0, 0, 3), true);
assert.equal(GridService.isValidPosition(2, 2, 3), true);
assert.equal(GridService.isValidPosition(-1, 0, 3), false);
assert.equal(GridService.isValidPosition(3, 0, 3), false);

const [row, col] = GridService.findNewPosition([[2, null, null], [null, null, null], [null, null, null]], 3, 0, 0, 0, 1);
assert.equal(row, 0);
assert.equal(col, 2);

assert.equal(GridService.calculateGridSum([[2, 4], [null, 8]]), 14);
assert.equal(GridService.getAllEmptyCells([[2, null], [null, 4]], 2).length, 2);
console.log('✅ GridService tests passed');

console.log('Testing StateManager...');
StateManager.initializeState();
assert.equal(StateManager.getGameState().score, 0);
assert.equal(StateManager.getGameState().moves, 0);
assert.equal(StateManager.getUIState().theme, 'dark');

StateManager.setState({ score: 10, moves: 5 });
assert.equal(StateManager.getGameState().score, 10);
assert.equal(StateManager.getGameState().moves, 5);

StateManager.setState({ theme: 'light' });
assert.equal(StateManager.getUIState().theme, 'light');
console.log('✅ StateManager tests passed');

console.log('Testing SnapshotService...');
const state = {
  grid: [[2, 4], [null, null]],
  moves: 3, levelMoves: 1, totalMoves: 4,
  score: 10, levelScore: 2, totalScore: 12
};
const snapshot = SnapshotService.makeSnapshot(state);
state.grid[0][0] = 99;
const restored = SnapshotService.restoreSnapshot(snapshot);
assert.equal(restored.grid[0][0], 2);
assert.equal(restored.moves, 3);
assert.equal(restored.score, 10);
console.log('✅ SnapshotService tests passed');

console.log('Testing ErrorHandler...');
const obj = { val: 42, getVal() { return this.val; } };
const wrapped = ErrorHandler.wrap(obj.getVal.bind(obj), 'test');
assert.equal(wrapped(), 42);
console.log('✅ ErrorHandler tests passed');

console.log('Testing ModeRules...');
assert.ok(getModeRules('infinity'));
assert.ok(getModeRules('quest'));

registerMode('customTest', {
  applyMoveCounters: prev => ({ moves: prev.moves + 1 }),
  applyScore: (prev, d) => ({ score: prev.score + (d || 0) }),
  onLose: () => {},
  onWin: () => {}
});
assert.ok(getRegisteredModes().includes('customTest'));
assert.equal(getModeRules('customTest').applyMoveCounters({ moves: 5 }).moves, 6);
console.log('✅ ModeRules tests passed');

console.log('Testing GameValidator...');
StateManager.initializeState({ game: { size: 3 } });
assert.equal(GameValidator.isValidPosition(1, 1), true);
assert.equal(GameValidator.isValidPosition(3, 3), false);
assert.equal(GameValidator.canSplit(2), true);
assert.equal(GameValidator.canSplit(0), false);
console.log('✅ GameValidator tests passed');

console.log('Testing GameLogic Intents...');
const restartIntent = GameLogic.restart();
assert.deepEqual(restartIntent, { action: 'PLACE_INITIAL_TILES' });
const nextLevelIntent = GameLogic.startNextQuestLevel();
assert.deepEqual(nextLevelIntent, { action: 'PLACE_INITIAL_TILES' });
console.log('✅ GameLogic tests passed');

console.log('\n🎉 ALL MODULE UNIT TESTS PASSED SUCCESSFULLY!');
