/**
 * Bulb It - A puzzle game
 * Main application entry point
 * @version 3.0.0
 * @author kharakhash
 */

import { Game } from './src/Game.js';
import { ErrorHandler } from './src/modules/ErrorHandling.js';

/**
 * Initializes and starts the game when the DOM is fully loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
  try {
    const game = new Game();
    game.init();
  } catch (error) {
    ErrorHandler.handle(error, 'DOMContentLoaded');
    // Optionally display a user-friendly error message in the UI
  }
});
