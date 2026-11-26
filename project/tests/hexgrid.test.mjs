import test from 'node:test';
import assert from 'node:assert/strict';
import { GameCore } from '../src/core/GameCore.js';
import { GridService } from '../src/modules/GridService.js';
import { HEX_DIRECTION_DELTAS } from '../src/modules/constants.js';

test('Hex Grid Geometry: 3x3x3 and 5x5x5 row counts and lengths', () => {
  // 3x3x3 (radius 2)
  const size3 = 3;
  const numRows3 = 2 * size3 - 1;
  assert.strictEqual(numRows3, 5, '3x3x3 hex board must have 5 rows');

  const expectedRowLengths3 = [3, 4, 5, 4, 3];
  let totalCells3 = 0;
  for (let r = 0; r < numRows3; r++) {
    const len = GridService.hexRowLength(size3, r);
    assert.strictEqual(len, expectedRowLengths3[r], `Row ${r} length should be ${expectedRowLengths3[r]}`);
    totalCells3 += len;
  }
  assert.strictEqual(totalCells3, 19, '3x3x3 hex board must have 19 cells in total');

  const grid3 = GridService.createEmptyGrid(3, null, 'hex');
  assert.strictEqual(grid3.length, 5);
  for (let r = 0; r < 5; r++) {
    assert.strictEqual(grid3[r].length, expectedRowLengths3[r]);
    assert.ok(grid3[r].every(c => c === null));
  }

  // 5x5x5 (radius 4)
  const size5 = 5;
  const numRows5 = 2 * size5 - 1;
  assert.strictEqual(numRows5, 9, '5x5x5 hex board must have 9 rows');

  const expectedRowLengths5 = [5, 6, 7, 8, 9, 8, 7, 6, 5];
  let totalCells5 = 0;
  for (let r = 0; r < numRows5; r++) {
    const len = GridService.hexRowLength(size5, r);
    assert.strictEqual(len, expectedRowLengths5[r], `Row ${r} length should be ${expectedRowLengths5[r]}`);
    totalCells5 += len;
  }
  assert.strictEqual(totalCells5, 61, '5x5x5 hex board must have 61 cells in total');

  const grid5 = GridService.createEmptyGrid(5, null, 'hex');
  assert.strictEqual(grid5.length, 9);
  for (let r = 0; r < 9; r++) {
    assert.strictEqual(grid5[r].length, expectedRowLengths5[r]);
    assert.ok(grid5[r].every(c => c === null));
  }
});

test('Hex Coordinates: Bijective roundtrip between (r, c) and cube (x, y, z)', () => {
  for (const size of [3, 5]) {
    const numRows = 2 * size - 1;
    let cellCount = 0;

    for (let r = 0; r < numRows; r++) {
      const rowLen = GridService.hexRowLength(size, r);
      for (let c = 0; c < rowLen; c++) {
        cellCount++;
        assert.strictEqual(
          GridService.isValidPosition(r, c, size, null, 'hex'),
          true,
          `Cell (${r}, ${c}) should be valid on hex size ${size}`
        );

        const cube = GridService.hexRcToCube(size, r, c);
        assert.strictEqual(
          cube.x + cube.y + cube.z,
          0,
          `Cube coords (${cube.x}, ${cube.y}, ${cube.z}) must satisfy x + y + z = 0`
        );
        assert.strictEqual(
          GridService.isHexValidCube(size, cube.x, cube.y, cube.z),
          true,
          `Cube coords must be within radius bounds`
        );

        const [rRound, cRound] = GridService.hexCubeToRc(size, cube.x, cube.y, cube.z);
        assert.strictEqual(rRound, r, `Row roundtrip failed for (${r}, ${c})`);
        assert.strictEqual(cRound, c, `Col roundtrip failed for (${r}, ${c})`);
      }
    }

    const expectedTotal = size === 3 ? 19 : 61;
    assert.strictEqual(cellCount, expectedTotal);
  }

  // Bounds checks
  assert.strictEqual(GridService.isValidPosition(-1, 0, 3, null, 'hex'), false);
  assert.strictEqual(GridService.isValidPosition(5, 0, 3, null, 'hex'), false);
  assert.strictEqual(GridService.isValidPosition(0, 3, 3, null, 'hex'), false); // row 0 only has cols 0, 1, 2
  assert.strictEqual(GridService.isValidPosition(2, 5, 3, null, 'hex'), false); // row 2 only has cols 0..4
});

test('Hex Ray Traversal: findNewPositionHex in all 6 directions', () => {
  const size = 3;
  const grid = GridService.createEmptyGrid(size, null, 'hex');

  // Center cell of 3x3x3 is row 2, col 2 (cube: 0, 0, 0)
  const centerR = 2;
  const centerC = 2;

  // 1. Right (dx: 1, dy: 0, dz: -1) -> slides along row 2 to col 4
  const [rRight, cRight] = GridService.findNewPositionHex(grid, size, centerR, centerC, HEX_DIRECTION_DELTAS.HexRight);
  assert.strictEqual(rRight, 2);
  assert.strictEqual(cRight, 4);

  // 2. Left (dx: -1, dy: 0, dz: 1) -> slides along row 2 to col 0
  const [rLeft, cLeft] = GridService.findNewPositionHex(grid, size, centerR, centerC, HEX_DIRECTION_DELTAS.HexLeft);
  assert.strictEqual(rLeft, 2);
  assert.strictEqual(cLeft, 0);

  // 3. Up-Left (dx: -1, dy: 1, dz: 0) -> slides to row 0, col 0
  const [rUpLeft, cUpLeft] = GridService.findNewPositionHex(grid, size, centerR, centerC, HEX_DIRECTION_DELTAS.HexUpLeft);
  assert.strictEqual(rUpLeft, 0);
  assert.strictEqual(cUpLeft, 0);

  // 4. Up-Right (dx: 0, dy: 1, dz: -1) -> slides to row 0, col 2
  const [rUpRight, cUpRight] = GridService.findNewPositionHex(grid, size, centerR, centerC, HEX_DIRECTION_DELTAS.HexUpRight);
  assert.strictEqual(rUpRight, 0);
  assert.strictEqual(cUpRight, 2);

  // 5. Down-Left (dx: 0, dy: -1, dz: 1) -> slides to row 4, col 0
  const [rDownLeft, cDownLeft] = GridService.findNewPositionHex(grid, size, centerR, centerC, HEX_DIRECTION_DELTAS.HexDownLeft);
  assert.strictEqual(rDownLeft, 4);
  assert.strictEqual(cDownLeft, 0);

  // 6. Down-Right (dx: 1, dy: -1, dz: 0) -> slides to row 4, col 2
  const [rDownRight, cDownRight] = GridService.findNewPositionHex(grid, size, centerR, centerC, HEX_DIRECTION_DELTAS.HexDownRight);
  assert.strictEqual(rDownRight, 4);
  assert.strictEqual(cDownRight, 2);

  // Stopping before obstacle / occupied cell
  grid[2][3] = 16;
  const [rObstacle, cObstacle] = GridService.findNewPositionHex(grid, size, centerR, centerC, HEX_DIRECTION_DELTAS.HexRight);
  assert.strictEqual(rObstacle, 2);
  assert.strictEqual(cObstacle, 2, 'Should stop before occupied cell at col 3');
});

test('Hex Move Mechanics: Splitting tiles and disappearing bulb values', () => {
  const size = 3;
  const grid = GridService.createEmptyGrid(size, null, 'hex');

  // Place a 4 at center cell (2, 2)
  grid[2][2] = 4;

  const state = {
    grid,
    size: 3,
    gridType: 'hex',
    gameMode: 'infinity',
    moves: 1
  };

  const moveRight = GameCore.computeMove(state, 'HexRight');
  assert.strictEqual(moveRight.changed, true, 'Moving into empty space must register as changed');
  assert.strictEqual(moveRight.patch.grid[2][2], 2, 'Source tile should be halved to 2');
  assert.strictEqual(moveRight.patch.grid[2][4], 2, 'Target tile should slide to wall and be 2');
  assert.strictEqual(moveRight.effects.disappearingCells.length, 2, 'Both value 2 cells should be marked as disappearing');
  assert.strictEqual(moveRight.effects.splitActions.length, 1, 'One split action recorded');

  // Move with a non-bulb value (e.g. 8)
  const grid8 = GridService.createEmptyGrid(size, null, 'hex');
  grid8[2][2] = 8;
  const state8 = {
    grid: grid8,
    size: 3,
    gridType: 'hex',
    gameMode: 'infinity',
    moves: 1
  };

  const moveLeft = GameCore.computeMove(state8, 'HexLeft');
  assert.strictEqual(moveLeft.changed, true);
  assert.strictEqual(moveLeft.patch.grid[2][2], 4, 'Source becomes 4');
  assert.strictEqual(moveLeft.patch.grid[2][0], 4, 'Target slides to left wall (col 0) and becomes 4');
  assert.strictEqual(moveLeft.effects.disappearingCells.length, 0, 'No bulbs to disappear');

  // Cannot move beyond boundary
  const gridBoundary = GridService.createEmptyGrid(size, null, 'hex');
  gridBoundary[2][4] = 4; // Rightmost cell of row 2
  const stateBoundary = {
    grid: gridBoundary,
    size: 3,
    gridType: 'hex',
    gameMode: 'infinity',
    moves: 1
  };
  const moveBlocked = GameCore.computeMove(stateBoundary, 'HexRight');
  assert.strictEqual(moveBlocked.changed, false, 'Moving against boundary should not change grid');
});

test('Hex Game Outcomes: canMakeMove, checkQuestOutcome, checkAkureOutcome', () => {
  const size = 3;
  const grid = GridService.createEmptyGrid(size, null, 'hex');

  // Empty grid can make move
  const emptyState = { grid, size: 3, gridType: 'hex', gameMode: 'quest' };
  assert.strictEqual(GameCore.canMakeMove(emptyState), true);

  // Quest Win: All cells cleared (empty)
  const questWinState = {
    grid,
    size: 3,
    gridType: 'hex',
    gameMode: 'quest'
  };
  assert.strictEqual(GameCore.checkQuestOutcome(questWinState), 'win');

  // Akure Win: All 19 cells filled (no nulls)
  const fullGrid = GridService.createEmptyGrid(size, 2, 'hex');
  const akureWinState = {
    grid: fullGrid,
    size: 3,
    gridType: 'hex',
    gameMode: 'akure',
    levelMoves: 5
  };
  assert.strictEqual(GameCore.checkAkureOutcome(akureWinState), 'win');

  // Akure in-progress
  grid[2][2] = 4;
  const akureInProgress = {
    grid,
    size: 3,
    gridType: 'hex',
    gameMode: 'akure',
    levelMoves: 1
  };
  assert.strictEqual(GameCore.checkAkureOutcome(akureInProgress), null);
});
