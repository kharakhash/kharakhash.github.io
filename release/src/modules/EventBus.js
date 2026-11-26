/**
 * EventBus - Centralized publish-subscribe event broker for Event-Driven Architecture (EDA).
 * Enables complete decoupling of game logic, animation coordination, and UI rendering.
 */
export const EventBus = (() => {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  /**
   * Subscribes a listener to a specific event.
   * @param {string} event - Event name.
   * @param {Function} callback - Event handler function.
   * @returns {Function} Unsubscribe function.
   */
  const on = (event, callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError(`[EventBus] Callback for event "${event}" must be a function.`);
    }

    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(callback);

    return () => off(event, callback);
  };

  /**
   * Subscribes a listener to an event for a single invocation.
   * @param {string} event - Event name.
   * @param {Function} callback - Event handler function.
   * @returns {Function} Unsubscribe function.
   */
  const once = (event, callback) => {
    const wrapper = (...args) => {
      off(event, wrapper);
      callback(...args);
    };
    return on(event, wrapper);
  };

  /**
   * Unsubscribes a listener from an event.
   * @param {string} event - Event name.
   * @param {Function} callback - Event handler function to remove.
   */
  const off = (event, callback) => {
    const eventListeners = listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
      if (eventListeners.size === 0) {
        listeners.delete(event);
      }
    }
  };

  /**
   * Emits an event with the provided payload to all registered listeners.
   * @param {string} event - Event name.
   * @param {*} [payload] - Data to pass to listeners.
   */
  const emit = (event, payload) => {
    const eventListeners = listeners.get(event);
    if (eventListeners) {
      for (const callback of eventListeners) {
        try {
          callback(payload);
        } catch (error) {
          console.error(`[EventBus] Error in listener for "${event}":`, error);
        }
      }
    }
  };

  /**
   * Clears all registered listeners or listeners for a specific event.
   * @param {string} [event] - Optional event name to clear.
   */
  const clear = (event) => {
    if (event) {
      listeners.delete(event);
    } else {
      listeners.clear();
    }
  };

  /**
   * Returns current count of registered listeners for an event.
   * @param {string} event - Event name.
   * @returns {number}
   */
  const listenerCount = (event) => {
    return listeners.get(event)?.size || 0;
  };

  return {
    on,
    once,
    off,
    emit,
    clear,
    listenerCount,
  };
})();
