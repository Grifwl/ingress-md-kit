/**
 * Interface dictionaries and message lookup, free of any UI dependency.
 */
import type { Language } from '../../shared/rules';
import ca from './ca.json';
import en from './en.json';
import es from './es.json';

/** A key of the interface dictionaries. */
export type MessageKey = keyof typeof en;

/** Values substituted into the `{placeholders}` of a message. */
export type MessageParams = Record<string, string | number>;

/** Dictionaries by language. */
export const DICTIONARIES: Record<Language, Record<string, string>> = { ca, es, en };

/**
 * Looks up and fills in a message, falling back to English and finally to
 * the key itself so that a gap never breaks a screen.
 *
 * @param language - Language to use.
 * @param key - Message key.
 * @param params - Placeholder values.
 * @returns The text to display.
 */
export function translate(language: Language, key: string, params: MessageParams = {}): string {
  const template = DICTIONARIES[language][key] ?? DICTIONARIES.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    params[name] === undefined ? placeholder : String(params[name]),
  );
}
