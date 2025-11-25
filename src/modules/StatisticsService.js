import { StorageService } from './StorageService.js';
import { ErrorHandler } from './ErrorHandling.js';

/**
 * StatisticsService - Manages game statistics and their rendering.
 */
export const StatisticsService = (() => {
  let _elements = {}; // Private variable to store cached DOM elements

  /**
   * Sets the cached DOM elements for the StatisticsService to use.
   * This should be called once during game initialization.
   * @param {Object} elements - The cached DOM elements object.
   */
  const setElements = (elements) => {
    _elements = elements;
  };

  /**
   * Calculates and renders all statistics to the DOM.
   */
  const renderStatistics = () => {
    try {
      const allGames = StorageService.loadAllGamesStats();
      _updateSummaryStats(allGames);
      _renderGamesList(allGames);
    } catch (error) {
      ErrorHandler.handle(error, 'StatisticsService.renderStatistics');
    }
  };

  /**
   * Updates summary statistics (records, totals) in the DOM.
   * @param {Array<Object>} allGames - Array of all game statistics.
   * @private
   */
  const _updateSummaryStats = (allGames) => {
    let recordMoves = 0;
    let recordScore = 0;
    let totalMoves = 0;
    let totalScore = 0;

    allGames.forEach(game => {
      recordMoves = Math.max(recordMoves, game.moves);
      recordScore = Math.max(recordScore, game.score);
      totalMoves += game.moves;
      totalScore += game.score;
    });

    if (_elements.recordMoves) _elements.recordMoves.textContent = recordMoves;
    if (_elements.recordScore) _elements.recordScore.textContent = recordScore;
    if (_elements.totalMoves) _elements.totalMoves.textContent = totalMoves;
    if (_elements.totalScore) _elements.totalScore.textContent = totalScore;
  };

  /**
   * Renders the list of all games to the DOM.
   * @param {Array<Object>} allGames - Array of all game statistics.
   * @private
   */
  const _renderGamesList = (allGames) => {
    if (!_elements.gamesList) return;

    _elements.gamesList.innerHTML = ''; // Clear previous list

    if (allGames.length === 0) {
      _elements.gamesList.innerHTML = '<li>no data yet...</li>';
      return;
    }
    allGames.sort((a, b) => new Date(`${b.date} ${b.time}`) - new Date(`${a.date} ${a.time}`)); // Sort by date/time
    
    allGames.forEach(game => {
      const listItem = document.createElement('li');
      listItem.textContent = 
        `${game.date} ${game.time} / ${game.size}x${game.size} / Moves: ${game.moves} / Score: ${game.score} / Mode: ${game.mode}`;
      _elements.gamesList.appendChild(listItem);
    });
  };

  /**
   * Handles clearing all statistics.
   */
  const clearStatistics = () => {
    if (confirm('Вы уверены, что хотите удалить всю статистику?')) {
      StorageService.clearAllGamesStats();
      renderStatistics(); // Re-render to show empty state
    }
  };

  return {
    setElements, // Export the setter for elements
    renderStatistics,
    clearStatistics,
  };
})();
