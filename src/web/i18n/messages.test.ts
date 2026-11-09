import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../../shared/rules';
import { DICTIONARIES, translate } from './messages';

/**
 * Extracts the placeholder names of a message.
 *
 * @param message - Message template.
 * @returns The sorted names.
 */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

describe('dictionaries', () => {
  const englishKeys = Object.keys(DICTIONARIES.en).sort();

  it.each(LANGUAGES)('%s has exactly the English keys', (language) => {
    expect(Object.keys(DICTIONARIES[language]).sort()).toEqual(englishKeys);
  });

  it.each(LANGUAGES)('%s uses the same placeholders as English', (language) => {
    for (const key of englishKeys) {
      expect(placeholders(DICTIONARIES[language][key]!), key).toEqual(
        placeholders(DICTIONARIES.en[key]!),
      );
    }
  });
});

describe('translate', () => {
  it('fills in placeholders', () => {
    expect(translate('en', 'missions.portals', { count: 7 })).toBe('7 portals');
  });

  it('returns unknown keys unchanged', () => {
    expect(translate('ca', 'no.such.key')).toBe('no.such.key');
  });
});
