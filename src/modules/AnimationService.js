import { ANIMATION_DURATION, ANIMATION_CLASSES } from './constants.js';
import { StateManager } from './StateManager.js';

/**
 * AnimationService - Manages all game animations and visual effects.
 */
export const AnimationService = (() => {
  const _getCellElement = (elements, row, col) => {
    return elements?.cells?.[row]?.[col] || document.getElementById(`cell-${row}-${col}`);
  };
  /**
   * Gets animation class for split direction.
   * @private
   * @param {number} deltaRow - Row delta.
   * @param {number} deltaCol - Column delta.
   * @returns {string} CSS animation class.
   */
  const _getSplitAnimationClass = (deltaRow, deltaCol) => {
    if (deltaRow !== 0) return ANIMATION_CLASSES.SPLIT_DIRECTIONS[deltaRow];
    return ANIMATION_CLASSES.SPLIT_DIRECTIONS[0][deltaCol];
  };

  /**
   * Animates cell splitting effect.
   * @param {number} row - Cell row.
   * @param {number} col - Cell column.
   * @param {number} deltaRow - Row delta.
   * @param {number} deltaCol - Column delta.
   */
  const animateCellSplit = (row, col, deltaRow, deltaCol, elements) => {
    const cell = _getCellElement(elements, row, col);
    if (!cell) return;
    
    const animationClass = _getSplitAnimationClass(deltaRow, deltaCol);
    if (!animationClass) return;
    
    cell.classList.add(animationClass);
    setTimeout(() => cell.classList.remove(animationClass), ANIMATION_DURATION); // Slightly longer to ensure completion
  };

  /**
   * Animates split appearance with smooth transition.
   * Creates a temporary cell to simulate split movement.
   * @param {number} parentRow - Parent cell row.
   * @param {number} parentCol - Parent cell column.  
   * @param {number} targetRow - Target cell row.
   * @param {number} targetCol - Target cell column.
   * @param {number} value - Cell value.
   * @param {number} deltaRow - Row delta.
   * @param {number} deltaCol - Column delta.
   * @param {Object} elements - Cached DOM elements.
   */
  const animateSplitAppear = (parentRow, parentCol, targetRow, targetCol, value, deltaRow, deltaCol, elements) => {
    const { size } = StateManager.getGameState();
    const { showValues } = StateManager.getUIState();
    const gameField = elements.game; // Assuming 'game' is cached in elements
    if (!gameField) return;
    
    const cellSize = gameField.offsetWidth / size;
    
    // Create and setup temporary animation element
    const tempCell = _createTempAnimationCell(parentRow, parentCol, value, cellSize, showValues);
    const targetCell = _getCellElement(elements, targetRow, targetCol);
    
    if (targetCell) {
      _hideTargetCell(targetCell);
    }
    
    gameField.appendChild(tempCell);
    
    // Animate to target position
    _animateToTarget(tempCell, targetRow, targetCol, cellSize);
    
    // Clean up after animation
    setTimeout(() => {
      _cleanupSplitAnimation(tempCell, targetCell, targetRow, targetCol, value, deltaRow, deltaCol, showValues);
    }, ANIMATION_DURATION + 50); // Extra 50ms to ensure animation completion
  };

  /**
   * Creates temporary cell for split animation.
   * @private
   */
  const _createTempAnimationCell = (parentRow, parentCol, value, cellSize, showValues) => {
    const tempCell = document.createElement('div');
    Object.assign(tempCell, {
      className: 'cell split-appear-anim',
    });
    
    Object.assign(tempCell.style, {
      position: 'absolute',
      zIndex: '2',
      width: `${cellSize}px`,
      height: `${cellSize}px`,
      left: '0px',
      top: '0px',
      transform: `translate(${parentCol * cellSize}px, ${parentRow * cellSize}px)`
    });
    
    tempCell.dataset.value = value;
    
    if (showValues) {
      tempCell.textContent = value ? Math.log2(value) - 1 : '';
    }
    
    return tempCell;
  };

  /**
   * Hides target cell during animation.
   * @private
   */
  const _hideTargetCell = (targetCell) => {
    targetCell.classList.add('cell-null');
    targetCell.textContent = '';
    targetCell.dataset.value = '';
  };

  /**
   * Animates temporary cell to target position.
   * @private
   */
  const _animateToTarget = (tempCell, targetRow, targetCol, cellSize) => {
    requestAnimationFrame(() => {
      tempCell.style.transition = `transform ${ANIMATION_DURATION}ms`;
      tempCell.style.transform = `translate(${targetCol * cellSize}px, ${targetRow * cellSize}px)`;
    });
  };

  /**
   * Cleans up split animation elements.
   * @private
   */
  const _cleanupSplitAnimation = (tempCell, targetCell, targetRow, targetCol, value, deltaRow, deltaCol, showValues) => {
    if (targetCell) {
      targetCell.classList.remove('cell-null');
      targetCell.textContent = showValues ? (value ? Math.log2(value) - 1 : '') : '';
      targetCell.dataset.value = value;

      const appearClass = _getSplitAnimationClass(deltaRow, deltaCol);
      if (appearClass) {
        targetCell.classList.add(appearClass);
        setTimeout(() => targetCell.classList.remove(appearClass), ANIMATION_DURATION);
      }
    }

    if (tempCell.parentNode) {
      tempCell.parentNode.removeChild(tempCell);
    }
  };

  /**
   * Animates cell removal with disappearing effect.
   * @param {number} row - Cell row.
   * @param {number} col - Cell column.
   */
  const animateAndRemoveCell = (row, col, elements) => {
    const cell = _getCellElement(elements, row, col);
    if (!cell) return;
    
    cell.classList.add('disappearing');
    cell.addEventListener('animationend', function handler() {
      cell.classList.remove('disappearing');
      cell.textContent = '';
      cell.dataset.value = '';
      cell.removeEventListener('animationend', handler);
    });
  };

  /**
   * Animates cell appearing effect.
   * @param {HTMLElement} cell - Cell element to animate.
   */
  const animateCellAppearing = (cell) => {
    if (!cell) return;
    
    cell.classList.add('appearing');
    setTimeout(() => cell.classList.remove('appearing'), ANIMATION_DURATION);
  };

  return {
    animateCellSplit,
    animateSplitAppear,
    animateAndRemoveCell,
    animateCellAppearing,
  };
})();
