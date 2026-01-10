import assert from 'assert';
import { GameCore } from '../src/core/GameCore.js';
import { GridService } from '../src/modules/GridService.js';

const splitState = {
  grid: [
    [2, null],
    [null, null]
  ],
  size: 2,
  gameMode: 'infinity',
  moves: 1
};

const splitResult = GameCore.computeMove(splitState, 'ArrowRight');
assert.strictEqual(splitResult.changed, true, 'Split move should register as a change');
assert.strictEqual(splitResult.patch.grid[0][0], 1, 'Source cell should be halved');
assert.strictEqual(splitResult.patch.grid[0][1], 1, 'Target cell should receive the other half');
assert.strictEqual(splitResult.effects.disappearingCells.length, 0, 'No 2-valued cells should disappear');
assert.ok(splitResult.effects.splitActions.length >= 1, 'Split action metadata should be collected');

const blockedState = {
  grid: [
    [2, 4],
    [8, 16]
  ],
  size: 2,
  gameMode: 'infinity',
  moves: 10
};
assert.strictEqual(GameCore.canMakeMove(blockedState), false, 'No empties should mean no move');

const placeholderState = {
  grid: [
    [1, 1],
    [1, 1]
  ],
  size: 2,
  gameMode: 'infinity',
  moves: 10
};
assert.strictEqual(GameCore.canMakeMove(placeholderState), true, 'Placeholder cells should keep the game alive');

const canMoveState = {
  grid: [
    [2, null],
    [null, 4]
  ],
  size: 2,
  gameMode: 'infinity',
  moves: 5
};
assert.strictEqual(GameCore.canMakeMove(canMoveState), true, 'Empty neighbors allow splitting');

const randomState = {
  grid: [
    [2, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ],
  size: 4,
  gameMode: 'infinity',
  moves: 2
};
const randomPayload = GameCore.maybeAddRandomCell(randomState);
assert.ok(randomPayload, 'Random cell should be added in infinity mode after first move');
const randomCellValue = randomPayload.grid[randomPayload.position.row][randomPayload.position.col];
assert.strictEqual(randomCellValue, randomPayload.value, 'Random payload must match grid value');

assert.strictEqual(GridService.areGridsIdentical(splitResult.patch.grid, splitResult.patch.grid), true, 'Identical grids should match');
assert.strictEqual(GridService.areGridsIdentical(splitResult.patch.grid, blockedState.grid), false, 'Different grids should not match');

console.log('GameCore + GridService smoke tests passed');
