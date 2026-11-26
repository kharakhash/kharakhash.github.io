import { GameCore } from '../core/GameCore.js';

/**
 * WorkerService - Manages background Web Worker execution with seamless synchronous fallback.
 */
export const WorkerService = (() => {
  let worker = null;
  let isWorkerAvailable = false;
  let requestId = 0;
  /** @type {Map<number, { resolve: Function, reject: Function }>} */
  const pendingRequests = new Map();

  const initWorker = () => {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      isWorkerAvailable = false;
      return;
    }

    try {
      // Use module worker
      const workerUrl = new URL('../workers/gameCoreWorker.js', import.meta.url);
      worker = new Worker(workerUrl, { type: 'module' });

      worker.onmessage = (event) => {
        const { id, success, result, canMove, outcome, error } = event.data;
        const pending = pendingRequests.get(id);
        if (!pending) return;

        pendingRequests.delete(id);
        if (success) {
          pending.resolve(result !== undefined ? result : (canMove !== undefined ? canMove : outcome));
        } else {
          pending.reject(new Error(error));
        }
      };

      worker.onerror = (err) => {
        console.warn('[WorkerService] Worker error, falling back to sync:', err);
        isWorkerAvailable = false;
      };

      isWorkerAvailable = true;
    } catch (e) {
      console.warn('[WorkerService] Web Worker initialization failed, using main thread:', e);
      isWorkerAvailable = false;
    }
  };

  // Attempt init
  initWorker();

  /**
   * Computes directional move using worker if available, otherwise synchronous GameCore.
   * @param {Object} state - Current flattened game state.
   * @param {string} direction - Arrow direction.
   * @returns {Promise<Object>|Object}
   */
  const computeMove = (state, direction) => {
    // For small grids (size <= 5), sync is faster than postMessage serialization overhead
    if (!isWorkerAvailable || !worker || state.size <= 5) {
      return GameCore.computeMove(state, direction);
    }

    return new Promise((resolve, reject) => {
      const id = ++requestId;
      pendingRequests.set(id, { resolve, reject });
      worker.postMessage({
        id,
        type: 'computeMove',
        payload: { state, direction },
      });
    });
  };

  const isAvailable = () => isWorkerAvailable;

  const terminate = () => {
    if (worker) {
      worker.terminate();
      worker = null;
      isWorkerAvailable = false;
      pendingRequests.clear();
    }
  };

  return {
    computeMove,
    isAvailable,
    terminate,
  };
})();
