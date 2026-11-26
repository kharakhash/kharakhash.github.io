import { TILE_PALETTE, CELL_TYPES } from '../modules/constants.js';
import { StorageService } from '../modules/StorageService.js';
import { ErrorHandler } from '../modules/ErrorHandling.js';
import { GridService } from '../modules/GridService.js';
import { GameCore } from '../core/GameCore.js';

/**
 * LevelEditor - Manages level construction, dual-state editing (Initial & Win Condition),
 * in-place DOM updates, click-only painting, soft validation, DSL serialization/deserialization,
 * file sharing, and self-contained Quick Test modal execution.
 */
export const LevelEditor = (() => {
  let _elements = {};
  let _gameInstance = null;
  let _testSession = null;

  // Editor State
  let _state = {
    size: 5,
    name: 'Custom Level 1',
    mode: 'akure', // 'akure' | 'quest'
    moveLimit: null, // number | null
    activeTab: 'initial', // 'initial' | 'winCondition'
    selectedCategory: 'cellType', // 'cellType' | 'tileValue' | 'lock'
    selectedCellType: 'active', // 'active' | 'medium' | 'inactive'
    selectedTileValue: 512, // number | null
    selectedLockMode: false,

    // Matrices (size x size)
    cellTypes: [],          // 2D: 'active' | 'medium' | 'inactive'
    initialGrid: [],        // 2D: number | null
    lockedCells: new Set(), // Set of 'r,c'
    winConditionType: 'all_filled', // 'all_filled' | 'all_cleared' | 'custom_grid'
    winConditionGrid: [],   // 2D: number | null (for custom target pattern)
    mediumTargets: {},      // 'r,c' -> targetNumber
  };

  /**
   * Initializes the Level Editor with cached DOM elements and game instance.
   * @param {Object} elements
   * @param {Object} gameInstance
   */
  const init = (elements, gameInstance) => {
    _elements = elements || {};
    _gameInstance = gameInstance;
    resetEditorState(5);
  };

  /**
   * Resets or resizes the editor grid.
   * @param {number} size
   */
  const resetEditorState = (size = 5) => {
    _state.size = size;
    _state.cellTypes = Array.from({ length: size }, () => Array(size).fill('active'));
    _state.initialGrid = Array.from({ length: size }, () => Array(size).fill(null));
    _state.winConditionGrid = Array.from({ length: size }, () => Array(size).fill(null));
    _state.lockedCells = new Set();
    _state.mediumTargets = {};
    _state.winConditionType = _state.mode === 'akure' ? 'all_filled' : 'all_cleared';

    // Put a default starting tile in center for Akure
    const mid = Math.floor(size / 2);
    _state.initialGrid[mid][mid] = 512;

    buildCanvasDOM();
    render();
  };

  /**
   * Builds the DOM grid structure once per resize/reset.
   */
  const buildCanvasDOM = () => {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('editorCanvas');
    if (!container) return;

    container.innerHTML = '';
    container.style.gridTemplateColumns = `repeat(${_state.size}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${_state.size}, 1fr)`;

    for (let r = 0; r < _state.size; r++) {
      for (let c = 0; c < _state.size; c++) {
        const cell = document.createElement('div');
        cell.className = 'editor-cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);

        const badge = document.createElement('span');
        badge.className = 'editor-cell-num';
        cell.appendChild(badge);

        const lockIcon = document.createElement('span');
        lockIcon.className = 'editor-lock-icon';
        lockIcon.textContent = '🔒';
        cell.appendChild(lockIcon);

        const valSpan = document.createElement('span');
        valSpan.className = 'editor-val-text';
        cell.appendChild(valSpan);

        // Click-only editing: strictly single click/tap, no drag-draw
        cell.addEventListener('click', (e) => {
          e.preventDefault();
          handleCellClick(r, c);
        });

        container.appendChild(cell);
      }
    }
  };

  /**
   * Switches the active editor tab between Initial State and Win Condition.
   * @param {'initial' | 'winCondition'} tab
   */
  const switchTab = (tab) => {
    _state.activeTab = tab;
    if (typeof document !== 'undefined') {
      const winBar = document.getElementById('editorWinConditionBar');
      if (winBar) {
        winBar.classList.toggle('hidden', tab !== 'winCondition' || _state.mode !== 'quest');
      }
      renderActiveToolSelection();
      updateCanvasDisplay();
    }
  };

  /**
   * Sets the level mode (akure / quest).
   * @param {'akure' | 'quest'} mode
   */
  const setMode = (mode) => {
    _state.mode = mode;
    if (_state.mode === 'akure') {
      _state.winConditionType = 'all_filled';
    } else if (_state.winConditionType === 'all_filled') {
      _state.winConditionType = 'all_cleared';
    }

    if (typeof document !== 'undefined') {
      const winBar = document.getElementById('editorWinConditionBar');
      if (winBar) {
        winBar.classList.toggle('hidden', _state.activeTab !== 'winCondition' || _state.mode !== 'quest');
      }
    }

    render();
  };

  /**
   * Toggles mode between Akure and Quest.
   */
  const toggleMode = () => {
    setMode(_state.mode === 'akure' ? 'quest' : 'akure');
  };

  /**
   * Sets move limit (null for unconstrained).
   * @param {number|null} limit
   */
  const setMoveLimit = (limit) => {
    _state.moveLimit = (typeof limit === 'number' && limit > 0) ? limit : null;
    if (typeof document !== 'undefined') {
      const dslOutput = document.getElementById('editorDslOutput');
      if (dslOutput) dslOutput.value = generateDSL();
    }
  };

  /**
   * Sets win condition type for Quest mode ('all_cleared' | 'custom_grid').
   * @param {'all_cleared' | 'custom_grid'} type
   */
  const setWinConditionType = (type) => {
    _state.winConditionType = type;
    if (typeof document !== 'undefined') {
      document.getElementById('editorWinConditionAllCleared')?.classList.toggle('active', type === 'all_cleared');
      document.getElementById('editorWinConditionCustomGrid')?.classList.toggle('active', type === 'custom_grid');
    }
    render();
  };

  /**
   * Handles clicking a cell in the editor canvas.
   * Modifies state and performs in-place DOM updates without re-building the grid.
   * @param {number} r - Row index.
   * @param {number} c - Column index.
   */
  const handleCellClick = (r, c) => {
    const key = `${r},${c}`;

    if (_state.activeTab === 'initial') {
      if (_state.selectedCategory === 'cellType') {
        _state.cellTypes[r][c] = _state.selectedCellType;
        if (_state.selectedCellType === 'inactive') {
          _state.initialGrid[r][c] = null;
          _state.lockedCells.delete(key);
          delete _state.mediumTargets[key];
        }
      } else if (_state.selectedCategory === 'tileValue') {
        if (_state.cellTypes[r][c] === 'medium') {
          // Setting target requirement for Medium cell
          if (_state.selectedTileValue === null) {
            delete _state.mediumTargets[key];
          } else {
            _state.mediumTargets[key] = _state.selectedTileValue;
          }
        } else if (_state.cellTypes[r][c] !== 'inactive') {
          // Direct stamp or toggle tile value
          if (_state.initialGrid[r][c] === _state.selectedTileValue) {
            _state.initialGrid[r][c] = null;
          } else {
            _state.initialGrid[r][c] = _state.selectedTileValue;
          }
        }
      } else if (_state.selectedCategory === 'lock') {
        if (_state.initialGrid[r][c] !== null) {
          if (_state.lockedCells.has(key)) {
            _state.lockedCells.delete(key);
          } else {
            _state.lockedCells.add(key);
          }
        }
      }
    } else {
      // winCondition tab
      if (_state.cellTypes[r][c] !== 'inactive') {
        _state.winConditionGrid[r][c] = _state.winConditionGrid[r][c] === _state.selectedTileValue
          ? null
          : _state.selectedTileValue;
        _state.winConditionType = 'custom_grid';
        setWinConditionType('custom_grid');
      }
    }

    updateCellDOM(r, c);

    // Update DSL display
    const dslOutput = document.getElementById('editorDslOutput');
    if (dslOutput) dslOutput.value = generateDSL();
  };

  /**
   * Updates an individual cell's visual state in the DOM without touching others.
   * @param {number} r
   * @param {number} c
   */
  const updateCellDOM = (r, c) => {
    const container = document.getElementById('editorCanvas');
    if (!container) return;

    const cell = container.querySelector(`.editor-cell[data-row="${r}"][data-col="${c}"]`);
    if (!cell) return;

    const type = _state.cellTypes[r][c];
    const key = `${r},${c}`;
    const isLocked = _state.lockedCells.has(key);
    const cellCode = getCellCode(r, c, _state.size);
    const currentMatrix = _state.activeTab === 'initial' ? _state.initialGrid : _state.winConditionGrid;
    const val = currentMatrix[r][c];

    // Reset base classes
    cell.className = `editor-cell editor-cell--${type}`;
    if (isLocked) cell.classList.add('editor-cell--locked');

    // Number badge
    const badge = cell.querySelector('.editor-cell-num');
    if (badge) badge.textContent = cellCode;

    // Lock icon
    const lockIcon = cell.querySelector('.editor-lock-icon');
    if (lockIcon) {
      lockIcon.style.display = isLocked ? 'inline-block' : 'none';
    }

    // Value text / medium target hint
    const valSpan = cell.querySelector('.editor-val-text');
    if (val) {
      cell.dataset.value = String(val);
      if (valSpan) {
        valSpan.textContent = String(Math.log2(val) - 1);
        valSpan.className = 'editor-val-text';
      }
    } else if (type === 'medium' && _state.mediumTargets[key]) {
      cell.removeAttribute('data-value');
      if (valSpan) {
        valSpan.textContent = String(Math.log2(_state.mediumTargets[key]) - 1);
        valSpan.className = 'editor-val-text target-hint';
      }
    } else {
      cell.removeAttribute('data-value');
      if (valSpan) {
        valSpan.textContent = '';
        valSpan.className = 'editor-val-text';
      }
    }
  };

  /**
   * Refreshes all cells in place.
   */
  const updateCanvasDisplay = () => {
    for (let r = 0; r < _state.size; r++) {
      for (let c = 0; c < _state.size; c++) {
        updateCellDOM(r, c);
      }
    }
  };

  /**
   * Generates cell sequential code: e.g. 01, 02, 03...
   * @param {number} r
   * @param {number} c
   * @param {number} size
   * @returns {string}
   */
  const getCellCode = (r, c, size = _state.size) => {
    const num = r * size + c + 1;
    return num < 10 ? `0${num}` : `${num}`;
  };

  /**
   * Generates Symbolic DSL specification from current editor state.
   * @returns {string}
   */
  const generateDSL = () => {
    const { size, name, mode, moveLimit, cellTypes, initialGrid, lockedCells, winConditionType, winConditionGrid, mediumTargets } = _state;

    let dsl = `# ==========================================\n`;
    dsl += `# 4321 LEVEL SPECIFICATION DSL\n`;
    dsl += `# ==========================================\n`;
    dsl += `LEVEL: "${name}"\n`;
    dsl += `SIZE: ${size}\n`;
    dsl += `MODE: ${mode}\n`;
    if (moveLimit && moveLimit > 0) {
      dsl += `MOVE_LIMIT: ${moveLimit}\n`;
    }
    dsl += `\n`;

    dsl += `GRID_LAYOUT:\n`;
    for (let r = 0; r < size; r++) {
      const rowTokens = [];
      for (let c = 0; c < size; c++) {
        const code = getCellCode(r, c, size);
        const type = cellTypes[r][c];
        const key = `${r},${c}`;
        if (type === 'inactive') {
          rowTokens.push(`[${code}:OFF]`);
        } else if (type === 'medium') {
          const target = mediumTargets[key];
          rowTokens.push(target ? `[${code}:MED(${target})]` : `[${code}:MED]`);
        } else {
          rowTokens.push(`[${code}:ACT]`);
        }
      }
      dsl += rowTokens.join(' ') + '\n';
    }

    dsl += `\nINITIAL_TILES:\n`;
    let hasTiles = false;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const val = initialGrid[r][c];
        if (val !== null && val !== undefined) {
          hasTiles = true;
          const code = getCellCode(r, c, size);
          const isLocked = lockedCells.has(`${r},${c}`);
          dsl += `${code}: ${val}${isLocked ? ' [LOCKED]' : ''}\n`;
        }
      }
    }
    if (!hasTiles) {
      dsl += `NONE\n`;
    }

    dsl += `\nWIN_CONDITION:\n`;
    if (winConditionType === 'custom_grid') {
      dsl += `TARGET_GRID:\n`;
      for (let r = 0; r < size; r++) {
        const targets = [];
        for (let c = 0; c < size; c++) {
          const code = getCellCode(r, c, size);
          const val = winConditionGrid[r][c];
          if (val) {
            targets.push(`${code}:${val}`);
          }
        }
        if (targets.length > 0) {
          dsl += targets.join(' ') + '\n';
        }
      }
    } else if (winConditionType === 'all_filled') {
      dsl += `ALL_FILLED\n`;
    } else {
      dsl += `ALL_CLEARED\n`;
    }

    return dsl;
  };

  /**
   * Parses Symbolic DSL text and updates editor state.
   * @param {string} dslText
   */
  const parseDSL = (dslText) => {
    try {
      const lines = dslText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      let levelName = 'Imported Level';
      let size = 5;
      let mode = 'akure';
      let moveLimit = null;
      let section = null;

      let cellTypes = null;
      let initialGrid = null;
      let winConditionGrid = null;
      const lockedCells = new Set();
      const mediumTargets = {};
      let winConditionType = 'all_filled';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('LEVEL:')) {
          const match = line.match(/LEVEL:\s*"([^"]+)"/);
          if (match) levelName = match[1];
        } else if (line.startsWith('SIZE:')) {
          size = parseInt(line.replace('SIZE:', '').trim(), 10) || 5;
          cellTypes = Array.from({ length: size }, () => Array(size).fill('active'));
          initialGrid = Array.from({ length: size }, () => Array(size).fill(null));
          winConditionGrid = Array.from({ length: size }, () => Array(size).fill(null));
        } else if (line.startsWith('MODE:')) {
          mode = line.replace('MODE:', '').trim().toLowerCase();
        } else if (line.startsWith('MOVE_LIMIT:')) {
          const parsedLimit = parseInt(line.replace('MOVE_LIMIT:', '').trim(), 10);
          moveLimit = !isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
        } else if (line === 'GRID_LAYOUT:') {
          section = 'LAYOUT';
        } else if (line === 'INITIAL_TILES:') {
          section = 'INITIAL';
        } else if (line === 'WIN_CONDITION:') {
          section = 'WIN';
        } else if (section === 'LAYOUT') {
          const tokenRegex = /\[(\d+):([A-Z]+)(?:\((\d+)\))?\]/g;
          let match;
          while ((match = tokenRegex.exec(line)) !== null) {
            const idx = parseInt(match[1], 10) - 1;
            const r = Math.floor(idx / size);
            const c = idx % size;
            const typeStr = match[2];
            const targetVal = match[3] ? parseInt(match[3], 10) : null;

            if (r < size && c < size) {
              if (typeStr === 'OFF') cellTypes[r][c] = 'inactive';
              else if (typeStr === 'MED') {
                cellTypes[r][c] = 'medium';
                if (targetVal) mediumTargets[`${r},${c}`] = targetVal;
              } else {
                cellTypes[r][c] = 'active';
              }
            }
          }
        } else if (section === 'INITIAL') {
          if (line !== 'NONE') {
            const match = line.match(/(\d+):\s*(\d+)(\s*\[LOCKED\])?/);
            if (match) {
              const idx = parseInt(match[1], 10) - 1;
              const r = Math.floor(idx / size);
              const c = idx % size;
              const val = parseInt(match[2], 10);
              const isLocked = Boolean(match[3]);

              if (r < size && c < size) {
                initialGrid[r][c] = val;
                if (isLocked) lockedCells.add(`${r},${c}`);
              }
            }
          }
        } else if (section === 'WIN') {
          if (line === 'ALL_FILLED') {
            winConditionType = 'all_filled';
          } else if (line === 'ALL_CLEARED') {
            winConditionType = 'all_cleared';
          } else if (line === 'TARGET_GRID:' || line.includes(':')) {
            winConditionType = 'custom_grid';
            const pairs = line.replace('TARGET_GRID:', '').trim().split(/\s+/);
            pairs.forEach(p => {
              const parts = p.split(':');
              if (parts.length === 2) {
                const idx = parseInt(parts[0], 10) - 1;
                const val = parseInt(parts[1], 10);
                const r = Math.floor(idx / size);
                const c = idx % size;
                if (r < size && c < size) winConditionGrid[r][c] = val;
              }
            });
          }
        }
      }

      if (cellTypes && initialGrid) {
        _state.size = size;
        _state.name = levelName;
        _state.mode = mode;
        _state.moveLimit = moveLimit;
        _state.cellTypes = cellTypes;
        _state.initialGrid = initialGrid;
        _state.winConditionGrid = winConditionGrid || Array.from({ length: size }, () => Array(size).fill(null));
        _state.lockedCells = lockedCells;
        _state.mediumTargets = mediumTargets;
        _state.winConditionType = winConditionType;

        buildCanvasDOM();
        render();
        return { success: true };
      }
      return { success: false, error: 'Incomplete DSL structure' };
    } catch (err) {
      ErrorHandler.handle(err, 'LevelEditor.parseDSL');
      return { success: false, error: err.message };
    }
  };

  /**
   * Validates level setup with basic sanity rules and soft solvability warnings.
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  const validateLevel = () => {
    const errors = [];
    const warnings = [];

    // 1. Level name check
    if (!_state.name || !_state.name.trim()) {
      errors.push('Level name cannot be empty.');
    }

    // 2. Playable cells check
    let activeCellCount = 0;
    for (let r = 0; r < _state.size; r++) {
      for (let c = 0; c < _state.size; c++) {
        if (_state.cellTypes[r][c] !== 'inactive') {
          activeCellCount++;
        }
      }
    }

    if (activeCellCount === 0) {
      errors.push('The level must have at least one active or medium cell.');
    }

    // 3. Starting tiles check
    let initialTilesCount = 0;
    let initialTilePowerUnits = 0; // Each tile of 2^k can split down into 2^(k-1) units
    for (let r = 0; r < _state.size; r++) {
      for (let c = 0; c < _state.size; c++) {
        const val = _state.initialGrid[r][c];
        if (val !== null && val !== undefined) {
          if (_state.cellTypes[r][c] === 'inactive') {
            errors.push(`Tile placed on inactive cell at ${getCellCode(r, c, _state.size)}.`);
          } else {
            initialTilesCount++;
            // Tile value v splits down to 2-tiles: v/2 tiles
            initialTilePowerUnits += Math.max(1, Math.floor(val / 2));
          }
        }
      }
    }

    if (initialTilesCount === 0) {
      errors.push('Level must contain at least one starting tile.');
    }

    // 4. Mode-specific checks & soft solvability heuristics
    if (_state.mode === 'akure') {
      if (initialTilesCount >= activeCellCount && activeCellCount > 0) {
        warnings.push('The grid is already completely filled at start.');
      } else if (initialTilePowerUnits < activeCellCount) {
        // Mathematically, tiles can never divide into enough cells to fill the active board!
        warnings.push(`Starting tile power (${initialTilePowerUnits} units) is less than active cells (${activeCellCount}). Field might be impossible to fill.`);
      }
    } else if (_state.mode === 'quest') {
      if (_state.winConditionType === 'custom_grid') {
        let targetsFound = 0;
        for (let r = 0; r < _state.size; r++) {
          for (let c = 0; c < _state.size; c++) {
            if (_state.winConditionGrid[r]?.[c]) targetsFound++;
          }
        }
        if (targetsFound === 0) {
          errors.push('Custom pattern win condition selected, but no target tiles were specified in Tab 2.');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  };

  /**
   * Shows validation feedback in the UI.
   * @param {{ valid: boolean, errors: string[], warnings: string[] }} validation
   */
  const displayValidationFeedback = (validation) => {
    const box = document.getElementById('editorValidationFeedback');
    if (!box) return;

    if (!validation.valid) {
      box.className = 'editor-validation-feedback error';
      box.innerHTML = `<strong>Validation Error:</strong><br>${validation.errors.join('<br>')}`;
      box.classList.remove('hidden');
    } else if (validation.warnings.length > 0) {
      box.className = 'editor-validation-feedback warning';
      box.innerHTML = `<strong>Warning:</strong><br>${validation.warnings.join('<br>')}`;
      box.classList.remove('hidden');
    } else {
      box.className = 'editor-validation-feedback success';
      box.textContent = 'Level validated successfully! Everything looks good.';
      box.classList.remove('hidden');
      setTimeout(() => box.classList.add('hidden'), 3500);
    }
  };

  /**
   * Converts editor state into a playable Game payload.
   * @returns {Object}
   */
  const exportPlayableLevel = () => {
    return {
      id: `lvl_${Date.now()}`,
      name: _state.name,
      size: _state.size,
      mode: _state.mode,
      maxMoves: _state.moveLimit || null,
      cellTypes: _state.cellTypes.map(row => [...row]),
      initialGrid: _state.initialGrid.map(row => [...row]),
      lockedCells: Array.from(_state.lockedCells).map(coord => {
        const [r, c] = coord.split(',').map(Number);
        return { row: r, col: c };
      }),
      winConditionType: _state.winConditionType,
      winConditionGrid: _state.winConditionGrid ? _state.winConditionGrid.map(row => [...row]) : null,
      mediumTargets: { ..._state.mediumTargets },
      dsl: generateDSL()
    };
  };

  /**
   * Saves current level to localStorage.
   */
  const saveLevel = () => {
    const val = validateLevel();
    displayValidationFeedback(val);
    if (!val.valid) return false;

    const levelData = exportPlayableLevel();
    StorageService.saveCustomLevel(levelData);
    renderCustomLevelsList();
    return true;
  };

  /**
   * Downloads level as a .dsl file.
   */
  const downloadDSLFile = () => {
    const dsl = generateDSL();
    const safeName = (_state.name || 'custom_level').replace(/[^a-zA-Z0-9_-]/g, '_');
    const blob = new Blob([dsl], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.dsl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * Reads an uploaded .dsl / .txt file.
   * @param {File} file
   */
  const importDSLFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      if (typeof content === 'string') {
        const res = parseDSL(content);
        if (!res.success) {
          alert('Error importing file: ' + res.error);
        }
      }
    };
    reader.readAsText(file);
  };

  // --- Embedded Quick Test Modal System ---

  /**
   * Starts a quick playtest session within the editor overlay.
   */
  const playLevel = () => {
    const val = validateLevel();
    displayValidationFeedback(val);
    if (!val.valid) return;

    const modal = document.getElementById('editorTestModal');
    if (!modal) return;

    modal.classList.remove('hidden');

    _testSession = {
      size: _state.size,
      mode: _state.mode,
      maxMoves: _state.moveLimit,
      moves: 0,
      score: 0,
      grid: GridService.cloneGrid(_state.initialGrid),
      cellTypes: _state.cellTypes.map(row => [...row]),
      lockedCells: new Set(_state.lockedCells),
      winConditionType: _state.winConditionType,
      winConditionGrid: _state.winConditionGrid ? _state.winConditionGrid.map(row => [...row]) : null,
      status: 'playing', // 'playing' | 'win' | 'lose'
    };

    setupTestModalDOM();
    renderTestModal();
  };

  /**
   * Sets up test modal canvas grid DOM.
   */
  const setupTestModalDOM = () => {
    const canvas = document.getElementById('editorTestCanvas');
    if (!canvas) return;

    canvas.innerHTML = '';
    canvas.style.gridTemplateColumns = `repeat(${_testSession.size}, 1fr)`;
    canvas.style.gridTemplateRows = `repeat(${_testSession.size}, 1fr)`;

    for (let r = 0; r < _testSession.size; r++) {
      for (let c = 0; c < _testSession.size; c++) {
        const cell = document.createElement('div');
        cell.className = 'editor-test-cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        canvas.appendChild(cell);
      }
    }
  };

  /**
   * Renders the current state of the test session.
   */
  const renderTestModal = () => {
    if (!_testSession) return;

    document.getElementById('editorTestTitle').textContent = `Testing: ${_state.name}`;
    document.getElementById('editorTestMoves').textContent = String(_testSession.moves);
    document.getElementById('editorTestScore').textContent = String(_testSession.score);
    document.getElementById('editorTestMaxMoves').textContent = _testSession.maxMoves ? ` / ${_testSession.maxMoves}` : '';

    const goalEl = document.getElementById('editorTestGoal');
    if (goalEl) {
      if (_testSession.mode === 'akure') {
        goalEl.textContent = 'Fill entire board';
      } else if (_testSession.winConditionType === 'custom_grid') {
        goalEl.textContent = 'Match target pattern';
      } else {
        goalEl.textContent = 'Clear all tiles';
      }
    }

    const canvas = document.getElementById('editorTestCanvas');
    if (canvas) {
      for (let r = 0; r < _testSession.size; r++) {
        for (let c = 0; c < _testSession.size; c++) {
          const cell = canvas.querySelector(`.editor-test-cell[data-row="${r}"][data-col="${c}"]`);
          if (!cell) continue;

          const type = _testSession.cellTypes[r][c];
          const val = _testSession.grid[r][c];
          const isLocked = _testSession.lockedCells.has(`${r},${c}`);

          cell.className = `editor-test-cell editor-test-cell--${type}`;
          if (isLocked) cell.classList.add('editor-cell--locked');

          if (val) {
            cell.dataset.value = String(val);
            cell.textContent = String(Math.log2(val) - 1);
          } else {
            cell.removeAttribute('data-value');
            cell.textContent = '';
          }
        }
      }
    }

    // Result banner
    const banner = document.getElementById('editorTestBanner');
    if (banner) {
      if (_testSession.status === 'win') {
        banner.className = 'editor-test-banner win';
        banner.textContent = `🎉 Level Cleared in ${_testSession.moves} moves!`;
        banner.classList.remove('hidden');
      } else if (_testSession.status === 'lose') {
        banner.className = 'editor-test-banner lose';
        banner.textContent = `❌ Level Failed! Out of moves or blocked.`;
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }
  };

  /**
   * Executes a move inside the test modal.
   * @param {string} direction - 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
   */
  const handleTestMove = (direction) => {
    if (!_testSession || _testSession.status !== 'playing') return;

    const moveResult = GameCore.computeMove({
      grid: _testSession.grid,
      size: _testSession.size,
      gameMode: _testSession.mode,
      moves: _testSession.moves,
      levelMoves: _testSession.moves,
      cellTypes: _testSession.cellTypes,
      lockedCells: _testSession.lockedCells,
      winConditionGrid: _testSession.winConditionGrid,
      akureMaxMoves: _testSession.maxMoves
    }, direction);

    if (moveResult && moveResult.changed) {
      _testSession.grid = moveResult.patch.grid;
      _testSession.moves++;
      _testSession.score += (moveResult.score || 0);

      // Check outcome
      if (_testSession.mode === 'akure') {
        const outcome = GameCore.checkAkureOutcome({
          grid: _testSession.grid,
          size: _testSession.size,
          gameMode: 'akure',
          levelMoves: _testSession.moves,
          cellTypes: _testSession.cellTypes,
          lockedCells: _testSession.lockedCells,
          winConditionGrid: _testSession.winConditionGrid,
          akureMaxMoves: _testSession.maxMoves
        });
        if (outcome) _testSession.status = outcome;
      } else {
        // Quest
        const outcome = GameCore.checkQuestOutcome({
          grid: _testSession.grid,
          size: _testSession.size,
          gameMode: 'quest',
          levelMoves: _testSession.moves,
          cellTypes: _testSession.cellTypes,
          lockedCells: _testSession.lockedCells,
          winConditionGrid: _testSession.winConditionGrid
        });
        if (outcome) {
          _testSession.status = outcome;
        } else if (_testSession.maxMoves && _testSession.moves >= _testSession.maxMoves) {
          _testSession.status = 'lose';
        }
      }

      renderTestModal();
    }
  };

  /**
   * Restarts the current test session with the initial custom level state.
   */
  const restartTest = () => {
    if (!_testSession) return;
    _testSession.moves = 0;
    _testSession.score = 0;
    _testSession.grid = GridService.cloneGrid(_state.initialGrid);
    _testSession.status = 'playing';
    renderTestModal();
  };

  /**
   * Closes the quick test modal.
   */
  const closeTest = () => {
    const modal = document.getElementById('editorTestModal');
    if (modal) modal.classList.add('hidden');
    _testSession = null;
  };

  /**
   * Renders the Level Editor DOM.
   */
  const render = () => {
    if (typeof document === 'undefined') return;
    const levelNameInput = document.getElementById('editorLevelName');
    const modeBtn = document.getElementById('editorModeToggleBtn');
    const moveLimitInput = document.getElementById('editorMoveLimit');
    const dslOutput = document.getElementById('editorDslOutput');

    if (levelNameInput) levelNameInput.value = _state.name;
    if (moveLimitInput) moveLimitInput.value = _state.moveLimit ? String(_state.moveLimit) : '';

    if (modeBtn) {
      modeBtn.textContent = _state.mode.toUpperCase();
      modeBtn.className = `mode-badge-btn mode-${_state.mode}`;
    }

    if (dslOutput) dslOutput.value = generateDSL();

    const canvas = document.getElementById('editorCanvas');
    if (!canvas || canvas.children.length !== _state.size * _state.size) {
      buildCanvasDOM();
    }

    updateCanvasDisplay();
    renderCustomLevelsList();
    renderActiveToolSelection();
  };

  /**
   * Highlights selected active tools in the palette.
   */
  const renderActiveToolSelection = () => {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.editor-tool-btn').forEach(btn => {
      const cat = btn.dataset.category;
      const val = btn.dataset.val;

      if (cat === _state.selectedCategory) {
        if (cat === 'cellType' && val === _state.selectedCellType) {
          btn.classList.add('active');
        } else if (cat === 'tileValue' && String(val) === String(_state.selectedTileValue)) {
          btn.classList.add('active');
        } else if (cat === 'lock') {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      } else {
        btn.classList.remove('active');
      }
    });

    // Tab buttons
    const initialTabBtn = document.getElementById('editorTabInitial');
    const winTabBtn = document.getElementById('editorTabWin');
    if (initialTabBtn && winTabBtn) {
      initialTabBtn.classList.toggle('active', _state.activeTab === 'initial');
      winTabBtn.classList.toggle('active', _state.activeTab === 'winCondition');
    }

    // Win condition buttons
    document.getElementById('editorWinConditionAllCleared')?.classList.toggle('active', _state.winConditionType === 'all_cleared');
    document.getElementById('editorWinConditionCustomGrid')?.classList.toggle('active', _state.winConditionType === 'custom_grid');
  };

  /**
   * Renders the list of custom saved levels.
   */
  const renderCustomLevelsList = () => {
    const listContainer = document.getElementById('editorSavedLevelsList');
    if (!listContainer) return;

    const levels = StorageService.loadCustomLevels();
    listContainer.innerHTML = '';

    if (levels.length === 0) {
      listContainer.innerHTML = `<div class="editor-empty-msg">No saved custom levels yet. Create and save one!</div>`;
      return;
    }

    levels.forEach(lvl => {
      const item = document.createElement('div');
      item.className = 'editor-level-card';
      item.innerHTML = `
        <div class="editor-level-info">
          <strong>${lvl.name || 'Untitled'}</strong>
          <span>${lvl.size}x${lvl.size} | Mode: ${(lvl.mode || 'akure').toUpperCase()}${lvl.maxMoves ? ` | Moves: ${lvl.maxMoves}` : ''}</span>
        </div>
        <div class="editor-level-actions">
          <button class="btn-sm btn-play" data-id="${lvl.id}">Play</button>
          <button class="btn-sm btn-load" data-id="${lvl.id}">Load</button>
          <button class="btn-sm btn-del" data-id="${lvl.id}">✕</button>
        </div>
      `;

      item.querySelector('.btn-play')?.addEventListener('click', () => {
        if (lvl.dsl) parseDSL(lvl.dsl);
        playLevel();
      });

      item.querySelector('.btn-load')?.addEventListener('click', () => {
        if (lvl.dsl) parseDSL(lvl.dsl);
      });

      item.querySelector('.btn-del')?.addEventListener('click', () => {
        StorageService.deleteCustomLevel(lvl.id);
        renderCustomLevelsList();
      });

      listContainer.appendChild(item);
    });
  };

  /**
   * Selects an editor tool category and value.
   * @param {string} category - 'cellType' | 'tileValue' | 'lock'
   * @param {*} value
   */
  const selectTool = (category, value) => {
    _state.selectedCategory = category;
    if (category === 'cellType') {
      _state.selectedCellType = value;
    } else if (category === 'tileValue') {
      _state.selectedTileValue = value === 'clear' ? null : Number(value);
    }
    renderActiveToolSelection();
  };

  return {
    init,
    resetEditorState,
    switchTab,
    setMode,
    toggleMode,
    setMoveLimit,
    setWinConditionType,
    selectTool,
    validateLevel,
    generateDSL,
    parseDSL,
    saveLevel,
    downloadDSLFile,
    importDSLFile,
    playLevel,
    handleTestMove,
    restartTest,
    closeTest,
    isTesting: () => Boolean(_testSession),
    render,
    getState: () => ({ ..._state }),
    setName: (name) => { _state.name = name; }
  };
})();
