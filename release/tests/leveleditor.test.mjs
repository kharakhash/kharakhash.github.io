import test from 'node:test';
import assert from 'node:assert/strict';
import { LevelEditor } from '../src/levels-builder/LevelEditor.js';

test('LevelEditor: State initialization & resizing', () => {
  LevelEditor.resetEditorState(4);
  const state = LevelEditor.getState();
  assert.equal(state.size, 4);
  assert.equal(state.cellTypes.length, 4);
  assert.equal(state.cellTypes[0].length, 4);
  assert.equal(state.initialGrid.length, 4);
  // Center tile default
  assert.equal(state.initialGrid[2][2], 512);
});

test('LevelEditor: Mode & move limit configuration', () => {
  LevelEditor.setMode('akure');
  assert.equal(LevelEditor.getState().mode, 'akure');
  assert.equal(LevelEditor.getState().winConditionType, 'all_filled');

  LevelEditor.toggleMode();
  assert.equal(LevelEditor.getState().mode, 'quest');
  assert.equal(LevelEditor.getState().winConditionType, 'all_cleared');

  LevelEditor.setMoveLimit(12);
  assert.equal(LevelEditor.getState().moveLimit, 12);
});

test('LevelEditor: DSL serialization and deserialization roundtrip', () => {
  LevelEditor.resetEditorState(3);
  LevelEditor.setName('Test Chamber');
  LevelEditor.setMode('quest');
  LevelEditor.setMoveLimit(8);

  const dsl = LevelEditor.generateDSL();
  assert.ok(dsl.includes('LEVEL: "Test Chamber"'));
  assert.ok(dsl.includes('SIZE: 3'));
  assert.ok(dsl.includes('MODE: quest'));
  assert.ok(dsl.includes('MOVE_LIMIT: 8'));

  const parsed = LevelEditor.parseDSL(dsl);
  assert.equal(parsed.success, true);
  const state = LevelEditor.getState();
  assert.equal(state.name, 'Test Chamber');
  assert.equal(state.size, 3);
  assert.equal(state.mode, 'quest');
  assert.equal(state.moveLimit, 8);
});

test('LevelEditor: Soft validation logic', () => {
  LevelEditor.resetEditorState(3);
  LevelEditor.setName('');
  const invalidNameCheck = LevelEditor.validateLevel();
  assert.equal(invalidNameCheck.valid, false);
  assert.ok(invalidNameCheck.errors.some(e => e.includes('name')));

  LevelEditor.setName('Valid Room');
  LevelEditor.setMode('akure');
  // At 3x3, total active cells = 9. Starting tile = 512 (power units = 256 >= 9, plenty).
  const validCheck = LevelEditor.validateLevel();
  assert.equal(validCheck.valid, true);

  // Soft warning test: set only a 4-tile (power units = 2 < 9)
  LevelEditor.selectTool('tileValue', 'clear');
  // Clear center
  LevelEditor.getState().initialGrid[1][1] = 4;
  const underpoweredCheck = LevelEditor.validateLevel();
  assert.equal(underpoweredCheck.valid, true);
  assert.ok(underpoweredCheck.warnings.some(w => w.includes('Starting tile power')));
});
