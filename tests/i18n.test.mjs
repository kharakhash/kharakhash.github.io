import test from 'node:test';
import assert from 'node:assert/strict';
import { I18nService } from '../src/modules/I18nService.js';
import { EventBus } from '../src/modules/EventBus.js';

test('I18nService: default language and available languages', () => {
  const languages = I18nService.getAvailableLanguages();
  assert.deepStrictEqual(languages, ['uk', 'en'], 'Should support uk and en languages');
});

test('I18nService: switching language and translations', () => {
  // Set to Ukrainian
  I18nService.setLanguage('uk');
  assert.strictEqual(I18nService.getLanguage(), 'uk', 'Language should be uk');
  assert.strictEqual(I18nService.t('btn.options'), 'опції', 'Ukrainian translation for btn.options');
  assert.strictEqual(I18nService.t('settings.language'), 'мова', 'Ukrainian translation for settings.language');
  assert.strictEqual(I18nService.t('modes.infinity.name'), 'Нескінченний', 'Ukrainian translation for infinity mode');

  // Set to English
  I18nService.setLanguage('en');
  assert.strictEqual(I18nService.getLanguage(), 'en', 'Language should be en');
  assert.strictEqual(I18nService.t('btn.options'), 'options', 'English translation for btn.options');
  assert.strictEqual(I18nService.t('settings.language'), 'language', 'English translation for settings.language');
  assert.strictEqual(I18nService.t('modes.infinity.name'), 'Infinity', 'English translation for infinity mode');
});

test('I18nService: fallback behavior for unknown key or language', () => {
  I18nService.setLanguage('en');
  // Fallback argument
  assert.strictEqual(I18nService.t('nonexistent.key', 'Default Fallback'), 'Default Fallback');
  // Key as fallback
  assert.strictEqual(I18nService.t('nonexistent.key'), 'nonexistent.key');

  // Invalid language code defaults to uk
  I18nService.setLanguage('invalid_code');
  assert.strictEqual(I18nService.getLanguage(), 'uk', 'Invalid language should fall back to uk');
});

test('I18nService: EventBus integration on language change', () => {
  let emittedLang = null;
  const unsubscribe = EventBus.on('i18n:change', (data) => {
    emittedLang = data.language;
  });

  I18nService.setLanguage('en');
  assert.strictEqual(emittedLang, 'en', 'EventBus should emit i18n:change with new language');

  I18nService.setLanguage('uk');
  assert.strictEqual(emittedLang, 'uk', 'EventBus should emit i18n:change with uk');

  if (typeof unsubscribe === 'function') unsubscribe();
});
