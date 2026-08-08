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
      const { games } = StorageService.getStatsStore();
      _updateSummaryStats(games);
      _renderGamesList(games);
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

    _elements.gamesList.innerHTML = ''; // Clear previous cards

    if (allGames.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'games-blocks-empty';
      emptyMessage.textContent = 'no data yet...';
      _elements.gamesList.appendChild(emptyMessage);
      return;
    }

    const sortedGames = [...allGames].sort(
      (a, b) => new Date(`${b.date} ${b.time}`) - new Date(`${a.date} ${a.time}`)
    ); // Sort by date/time

    sortedGames.forEach(game => {
      const {
        date = '—',
        time = '—',
        size = 0,
        moves = 0,
        score = 0,
        mode = '—',
      } = game;

      const summaryMode = mode.charAt(0).toUpperCase() + mode.slice(1);
      const summarySize = size ? `${size}x${size}` : '—';

      const card = document.createElement('div');
      card.className = 'game-card';

      const summary = document.createElement('div');
      summary.className = 'game-card__summary';

      const infoGroup = document.createElement('div');
      infoGroup.className = 'game-card__info';

      const modeTag = document.createElement('span');
      modeTag.className = 'game-card__tag';
      modeTag.textContent = summaryMode;

      const sizeTag = document.createElement('span');
      sizeTag.className = 'game-card__tag game-card__tag--muted';
      sizeTag.textContent = summarySize;

      infoGroup.append(modeTag, sizeTag);

      const statsGroup = document.createElement('div');
      statsGroup.className = 'game-card__stats';

      const movesInfo = document.createElement('span');
      movesInfo.innerHTML = `<strong>Moves</strong><span>${moves}</span>`;

      const scoreInfo = document.createElement('span');
      scoreInfo.innerHTML = `<strong>Score</strong><span>${score}</span>`;

      statsGroup.append(movesInfo, scoreInfo);

      const metaLine = document.createElement('span');
      metaLine.className = 'game-card__meta';
      metaLine.textContent = `${date} ${time}`;

      summary.append(infoGroup, metaLine, statsGroup);
      card.append(summary);
      _elements.gamesList.appendChild(card);
    });
  };

  /**
   * Handles clearing all statistics.
   */
  const clearStatistics = () => {
    if (confirm('sure?')) {
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
