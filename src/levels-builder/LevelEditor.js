import { TILE_PALETTE, CELL_TYPES } from '../modules/constants.js';
import { StorageService } from '../modules/StorageService.js';
import { ErrorHandler } from '../modules/ErrorHandling.js';

/**
 * LevelEditor - Manages level construction, dual-state editing (Initial & Win Condition),
 * cell functionality, and bidirectional Symbolic DSL translation.
 */
export const LevelEditor = (() => {
  let _elements = {};
  let _gameInstance = null;
  let _isDrawing = false;
  let _pointerListenersSetup = false;

  // Editor State
  let _state = {
    size: 5,
    name: 'Custom Level 1',
    mode: 'akure', // 'akure' or 'quest'
    activeTab: 'initial', // 'initial' | 'winCondition'
    selectedCategory: 'cellType', // 'cellType' | 'tileValue' | 'lock'
    selectedCellType: 'active', // 'active' | 'medium' | 'inactive'
    selectedTileValue: 512, // number or null
    selectedLockMode: false,
    
    // Matrices (size x size)
    cellTypes: [],      // 2D: 'active' | 'medium' | 'inactive'
    initialGrid: [],    // 2D: number | null
    lockedCells: new Set(), // Set of 'r,c'
    winConditionType: 'all_filled', // 'all_filled' | 'all_cleared' | 'custom_grid'
    winConditionGrid: [], // 2D: number | null (for custom target pattern)
    mediumTargets: {},  // 'r,c' -> targetNumber
  };

  /**
   * Initializes the Level Editor with cached DOM elements and game instance.
   * @param {Object} elements
   * @param {Object} gameInstance
   */
  const init = (elements, gameInstance) => {
    _elements = elements;
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

    render();
  };

  /**
   * Switches the active editor tab between Initial State and Win Condition.
   * @param {'initial' | 'winCondition'} tab
   */
  const switchTab = (tab) => {
    _state.activeTab = tab;
    render();
  };

  /**
   * Sets the level mode (akure / quest).
   * @param {'akure' | 'quest'} mode
   */
  const setMode = (mode) => {
    _state.mode = mode;
    if (_state.winConditionType !== 'custom_grid') {
      _state.winConditionType = mode === 'akure' ? 'all_filled' : 'all_cleared';
    }
    render();
  };

  /**
   * Handles clicking a cell in the editor canvas.
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
        if (_state.cellTypes[r][c] !== 'inactive') {
          _state.initialGrid[r][c] = _state.selectedTileValue;
        }
      } else if (_state.selectedCategory === 'lock') {
        if (_state.initialGrid[r][c] !== null) {
          if (_state.lockedCells.has(key)) {
            _state.lockedCells.delete(key);
          } else {
            _state.lockedCells.add(key);
          }
        }
      } else if (_state.selectedCategory === 'mediumTarget') {
        if (_state.cellTypes[r][c] === 'medium') {
          _state.mediumTargets[key] = _state.selectedTileValue;
        }
      }
    } else { // winCondition tab
      if (_state.cellTypes[r][c] !== 'inactive') {
        _state.winConditionGrid[r][c] = _state.winConditionGrid[r][c] === _state.selectedTileValue 
          ? null 
          : _state.selectedTileValue;
        _state.winConditionType = 'custom_grid';
      }
    }

    render();
  };

  /**
   * Generates cell sequential code: e.g. 01, 02, 03... 25
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
    const { size, name, mode, cellTypes, initialGrid, lockedCells, winConditionType, winConditionGrid, mediumTargets } = _state;
    
    let dsl = `# ==========================================\n`;
    dsl += `# 4321 LEVEL SPECIFICATION DSL\n`;
    dsl += `# ==========================================\n`;
    dsl += `LEVEL: "${name}"\n`;
    dsl += `SIZE: ${size}\n`;
    dsl += `MODE: ${mode}\n\n`;

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
        } else if (line === 'GRID_LAYOUT:') {
          section = 'LAYOUT';
        } else if (line === 'INITIAL_TILES:') {
          section = 'INITIAL';
        } else if (line === 'WIN_CONDITION:') {
          section = 'WIN';
        } else if (section === 'LAYOUT') {
          // Token format: [01:ACT] [02:OFF] [03:MED(128)]
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
          // Format: 07: 512 [LOCKED]
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
        _state.cellTypes = cellTypes;
        _state.initialGrid = initialGrid;
        _state.winConditionGrid = winConditionGrid || Array.from({ length: size }, () => Array(size).fill(null));
        _state.lockedCells = lockedCells;
        _state.mediumTargets = mediumTargets;
        _state.winConditionType = winConditionType;
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
   * Converts editor state into a playable Game payload.
   * @returns {Object}
   */
  const exportPlayableLevel = () => {
    return {
      id: `lvl_${Date.now()}`,
      name: _state.name,
      size: _state.size,
      mode: _state.mode,
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
    const levelData = exportPlayableLevel();
    StorageService.saveCustomLevel(levelData);
    renderCustomLevelsList();
  };

  /**
   * Launches current level in the game immediately!
   */
  const playLevel = () => {
    const playable = exportPlayableLevel();
    if (_gameInstance && typeof _gameInstance.loadAndPlayCustomLevel === 'function') {
      _gameInstance.loadAndPlayCustomLevel(playable);
    }
  };

  /**
   * Renders the Level Editor DOM.
   */
  const render = () => {
    const container = document.getElementById('editorCanvas');
    const dslOutput = document.getElementById('editorDslOutput');
    const levelNameInput = document.getElementById('editorLevelName');
    const modeBadge = document.getElementById('editorModeBadge');
    
    if (levelNameInput) levelNameInput.value = _state.name;
    if (modeBadge) modeBadge.textContent = _state.mode.toUpperCase();
    if (dslOutput) dslOutput.value = generateDSL();

    if (!container) return;

    container.innerHTML = '';
    container.style.gridTemplateColumns = `repeat(${_state.size}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${_state.size}, 1fr)`;

    const currentMatrix = _state.activeTab === 'initial' ? _state.initialGrid : _state.winConditionGrid;

    for (let r = 0; r < _state.size; r++) {
      for (let c = 0; c < _state.size; c++) {
        const cell = document.createElement('div');
        const type = _state.cellTypes[r][c];
        const val = currentMatrix[r][c];
        const key = `${r},${c}`;
        const isLocked = _state.lockedCells.has(key);
        const cellCode = getCellCode(r, c, _state.size);

        cell.className = `editor-cell editor-cell--${type}`;
        if (isLocked) cell.classList.add('editor-cell--locked');
        if (val) {
          cell.dataset.value = String(val);
          cell.textContent = String(Math.log2(val) - 1);
        } else if (type === 'medium' && _state.mediumTargets[key]) {
          const targetVal = _state.mediumTargets[key];
          cell.innerHTML = `<span class="target-hint">${Math.log2(targetVal) - 1}</span>`;
        }

        const badge = document.createElement('span');
        badge.className = 'editor-cell-num';
        badge.textContent = cellCode;
        cell.appendChild(badge);

        if (isLocked) {
          const lockIcon = document.createElement('span');
          lockIcon.className = 'editor-lock-icon';
          lockIcon.textContent = '🔒';
          cell.appendChild(lockIcon);
        }

        cell.addEventListener('pointerdown', (e) => {
          cell.releasePointerCapture(e.pointerId);
          _isDrawing = true;
          handleCellClick(r, c);
        });

        cell.addEventListener('pointerenter', () => {
          if (_isDrawing) {
            handleCellClick(r, c);
          }
        });

        // Fallback standard click for accessibility
        cell.addEventListener('click', () => {
          if (!_isDrawing) handleCellClick(r, c);
        });

        container.appendChild(cell);
      }
    }

    if (!_pointerListenersSetup) {
      window.addEventListener('pointerup', () => { _isDrawing = false; });
      window.addEventListener('pointercancel', () => { _isDrawing = false; });
      _pointerListenersSetup = true;
    }

    renderCustomLevelsList();
    renderActiveToolSelection();
  };

  /**
   * Highlights selected active tools in the palette.
   */
  const renderActiveToolSelection = () => {
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
          <span>${lvl.size}x${lvl.size} | Mode: ${lvl.mode.toUpperCase()}</span>
        </div>
        <div class="editor-level-actions">
          <button class="btn-sm btn-play" data-id="${lvl.id}">Play</button>
          <button class="btn-sm btn-load" data-id="${lvl.id}">Load</button>
          <button class="btn-sm btn-del" data-id="${lvl.id}">✕</button>
        </div>
      `;

      item.querySelector('.btn-play')?.addEventListener('click', () => {
        if (_gameInstance) _gameInstance.loadAndPlayCustomLevel(lvl);
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
   * @param {string} category - 'cellType' | 'tileValue' | 'lock' | 'mediumTarget'
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
    selectTool,
    generateDSL,
    parseDSL,
    saveLevel,
    playLevel,
    render,
    getState: () => ({ ..._state }),
    setName: (name) => { _state.name = name; }
  };
})();
