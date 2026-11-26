import { DEBOUNCE_TIME } from './constants.js';

/**
 * PerformanceUtils - Utility functions for performance optimizations.
 */
export const PerformanceUtils = (() => {
  /**
   * Debounced function executor.
   * @param {Function} func - Function to debounce.
   * @param {number} wait - Wait time in ms.
   * @returns {Function} Debounced function.
   */
  const debounce = (func, wait = DEBOUNCE_TIME) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  return {
    debounce,
  };
})();
