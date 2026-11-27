import { EventBus } from './EventBus.js';

/**
 * Translations dictionary supporting Ukrainian and English.
 */
export const TRANSLATIONS = {
  uk: {
    // Header & Main Controls
    'app.title': '4321',
    'btn.settings': 'опції',
    'btn.options': 'опції',
    'btn.stats': 'стат',
    'btn.restart': 'скинути',
    'btn.undo': 'скасувати',
    'btn.apply': 'застосувати',
    'btn.back': 'назад',
    'btn.clear': 'очистити',
    'btn.menu': 'меню',
    'btn.tryAgain': 'ще раз',
    'btn.anotherLevel': 'інший рівень',
    'btn.nextLevel': 'наступний',

    // HUD & Scores
    'hud.moves': 'Ходи',
    'hud.score': 'Рахунок',
    'hud.levelMoves': 'Ходи рівня',
    'hud.totalMoves': 'Загалом ходів',
    'hud.levelScore': 'Рахунок рівня',
    'hud.totalScore': 'Загальний рахунок',

    // Modes
    'mode.label': 'Режим гри',
    'modes.infinity.name': 'Нескінченний',
    'modes.infinity.title': 'Нескінченний',
    'modes.infinity.badge': 'Виживання',
    'modes.infinity.desc': 'Розділяйте плитки, прибирайте двійки та набирайте максимум очок під час появи нових плиток.',

    'modes.quest.name': 'Квест',
    'modes.quest.title': 'Квест',
    'modes.quest.badge': 'Очищення',
    'modes.quest.desc': 'Очистіть усе поле до останньої клітинки, плануючи ідеальні розділення.',

    // Settings
    'settings.title': 'Налаштування',
    'settings.gameMode': 'Режим гри',
    'settings.squareBoard': 'Квадратне поле',
    'settings.switchTheme': 'змінити тему',
    'settings.showValues': 'показувати значення',
    'settings.language': 'мова',

    // Statistics
    'stats.title': 'Статистика',
    'stats.recordMoves': 'рекорд ходів:',
    'stats.recordScore': 'рекорд очок:',
    'stats.totalMoves': 'усього ходів:',
    'stats.totalScore': 'усього очок:',
    'stats.noData': 'немає даних...',
    'stats.cardMoves': 'Ходи',
    'stats.cardScore': 'Рахунок',
    'stats.confirmClear': 'Ви впевнені, що хочете очистити всю статистику?',
    'stats.clearBtn': 'очистити статистику',
    'stats.backBtn': 'назад',

    // Popups
    'popup.infinityLose': 'ви не досягли нескінченності',
    'popup.questLose': 'ви програли, спробувати знову?',
    'popup.questWin': 'Рівень пройдено!',
    'popup.tryAgain': 'ще раз',
    'popup.tryAnother': 'інший рівень',
    'popup.nextLevel': 'наступний рівень'
  },
  en: {
    // Header & Main Controls
    'app.title': '4321',
    'btn.settings': 'options',
    'btn.options': 'options',
    'btn.stats': 'stats',
    'btn.restart': 'restart',
    'btn.undo': 'undo',
    'btn.apply': 'apply',
    'btn.back': 'back',
    'btn.clear': 'clear',
    'btn.menu': 'menu',
    'btn.tryAgain': 'try again',
    'btn.anotherLevel': 'another level',
    'btn.nextLevel': 'next level',

    // HUD & Scores
    'hud.moves': 'Moves',
    'hud.score': 'Score',
    'hud.levelMoves': 'Level moves',
    'hud.totalMoves': 'Total moves',
    'hud.levelScore': 'Level score',
    'hud.totalScore': 'Total score',

    // Modes
    'mode.label': 'Game Mode',
    'modes.infinity.name': 'Infinity',
    'modes.infinity.title': 'Infinity',
    'modes.infinity.badge': 'Survival',
    'modes.infinity.desc': 'Split tiles, clear twos, and score maximum points with new tiles spawning.',

    'modes.quest.name': 'Quest',
    'modes.quest.title': 'Quest',
    'modes.quest.badge': 'Clearance',
    'modes.quest.desc': 'Clear the entire grid down to the very last cell by planning perfect splits.',

    // Settings
    'settings.title': 'Settings',
    'settings.gameMode': 'Game Mode',
    'settings.squareBoard': 'Square Board',
    'settings.switchTheme': 'switch theme',
    'settings.showValues': 'show values',
    'settings.language': 'language',

    // Statistics
    'stats.title': 'Statistics',
    'stats.movesRecord': 'moves record:',
    'stats.scoreRecord': 'score record:',
    'stats.totalMoves': 'total moves:',
    'stats.totalScore': 'total score:',
    'stats.noData': 'no data yet...',
    'stats.cardMoves': 'Moves',
    'stats.cardScore': 'Score',
    'stats.confirmClear': 'Are you sure you want to clear all game statistics?',
    'stats.clearBtn': 'clear statistics',
    'stats.backBtn': 'back',

    // Popups
    'popup.infinityLose': "you didn't reach the infinity",
    'popup.questLose': 'you lose, try again?',
    'popup.questWin': 'Level Cleared!',
    'popup.tryAgain': 'try again',
    'popup.tryAnother': 'try another',
    'popup.nextLevel': 'next level'
  }
};

/**
 * I18nService - Manages multilingual support across the game.
 */
export const I18nService = (() => {
  let _currentLang = 'uk';

  /**
   * Sets the current language and applies translations to DOM if document is available.
   * @param {string} lang - 'uk' or 'en'
   * @returns {string} Effective language set
   */
  const setLanguage = (lang) => {
    _currentLang = (lang === 'en') ? 'en' : 'uk';
    if (typeof document !== 'undefined') {
      if (document.documentElement) {
        document.documentElement.lang = _currentLang;
      }
      applyTranslations(document);
    }
    EventBus.emit('i18n:change', { language: _currentLang });
    return _currentLang;
  };

  /**
   * Gets current language code.
   * @returns {string} 'uk' or 'en'
   */
  const getLanguage = () => _currentLang;

  /**
   * Translates a key with optional fallback.
   * @param {string} key
   * @param {string} [fallback='']
   * @returns {string}
   */
  const t = (key, fallback = '') => {
    const dict = TRANSLATIONS[_currentLang] || TRANSLATIONS.uk;
    if (dict && Object.prototype.hasOwnProperty.call(dict, key)) {
      return dict[key];
    }
    const fallbackDict = TRANSLATIONS.en;
    if (fallbackDict && Object.prototype.hasOwnProperty.call(fallbackDict, key)) {
      return fallbackDict[key];
    }
    return fallback || key;
  };

  /**
   * Translates all elements with data-i18n attributes in the given container.
   * @param {HTMLElement|Document} root
   */
  const applyTranslations = (root = (typeof document !== 'undefined' ? document : null)) => {
    if (!root || typeof root.querySelectorAll !== 'function') return;

    // Text content
    const elements = root.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = t(key, el.textContent);
      }
    });

    // Placeholders
    const inputs = root.querySelectorAll('[data-i18n-placeholder]');
    inputs.forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.placeholder = t(key, el.placeholder);
      }
    });

    // Titles
    const titles = root.querySelectorAll('[data-i18n-title]');
    titles.forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.title = t(key, el.title);
      }
    });

    // Aria labels
    const arias = root.querySelectorAll('[data-i18n-aria-label]');
    arias.forEach(el => {
      const key = el.getAttribute('data-i18n-aria-label');
      if (key) {
        el.setAttribute('aria-label', t(key, el.getAttribute('aria-label')));
      }
    });
  };

  return {
    setLanguage,
    getLanguage,
    t,
    applyTranslations,
    getAvailableLanguages: () => ['uk', 'en'],
  };
})();
