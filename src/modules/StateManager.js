/**
 * StateManager - Centralized state management with a Pub/Sub pattern.
 * Provides a single source of truth for the application's state.
 */
export const StateManager = (() => {
  let state = {};
  const subscribers = new Set();

  /**
   * Initializes the state with default or provided values.
   * @param {Object} initialState - The initial state object.
   */
  const initializeState = (initialState) => {
    state = { ...initialState };
    publish();
  };

  /**
   * Gets the current state.
   * @returns {Object} The current immutable state.
   */
  const getState = () => Object.freeze({ ...state });

  /**
   * Updates the state with new values and notifies subscribers.
   * Merges the new state deeply into the existing state.
   * @param {Object|Function} newStateOrUpdater - New state object or a function that receives the current state and returns a new state object.
   */
  const setState = (newStateOrUpdater) => {
    const nextState = typeof newStateOrUpdater === 'function' ? newStateOrUpdater(getState()) : newStateOrUpdater;
    state = { ...state, ...nextState }; // Shallow merge for now, can be deep merged if needed
    publish();
  };

  /**
   * Subscribes a function to state changes.
   * @param {Function} callback - The function to call when state changes.
   * @returns {Function} An unsubscribe function.
   */
  const subscribe = (callback) => {
    subscribers.add(callback);
    // Immediately call with current state for initial render/setup
    callback(getState()); 
    return () => subscribers.delete(callback);
  };

  /**
   * Publishes the current state to all subscribers.
   * @private
   */
  const publish = () => {
    const currentState = getState();
    subscribers.forEach(callback => callback(currentState));
  };

  return {
    initializeState,
    getState,
    setState,
    subscribe,
  };
})();
