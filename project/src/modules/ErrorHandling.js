/**
 * ErrorHandler - Centralized error handling and logging.
 */
export const ErrorHandler = (() => {
  /**
   * Handles and logs errors.
   * @param {Error} error - Error object.
   * @param {string} context - Context where error occurred.
   */
  const handle = (error, context) => {
    console.error(`[BulbGame:${context}]`, error);
    // Could integrate with error reporting service here
  };

  /**
   * Wraps function with error handling.
   * @param {Function} fn - Function to wrap.
   * @param {string} context - Context name.
   * @returns {Function} Wrapped function.
   */
  const wrap = (fn, context) => {
    return function wrapped(...args) {
      try {
        return fn.apply(this, args);
      } catch (error) {
        handle(error, context);
      }
    };
  };

  return {
    handle,
    wrap,
  };
})();
