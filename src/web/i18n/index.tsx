/**
 * Language selection for the interface, shared through a Preact context.
 */
import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useMemo, useState } from 'preact/hooks';
import { LANGUAGES, type Language } from '../../shared/rules';
import { translate, type MessageKey, type MessageParams } from './messages';

const STORAGE_KEY = 'ingress-md-kit.language';

/** What components receive from `useI18n`. */
export interface I18n {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey, params?: MessageParams) => string;
  /** Translates a key built at run time, such as one derived from an issue code. */
  tDynamic: (key: string, params?: MessageParams) => string;
}

const I18nContext = createContext<I18n | null>(null);

/**
 * Picks the initial language: the saved choice, then the browser's, then
 * English. Storage can be blocked by the browser, in which case the
 * choice simply lasts for this visit.
 *
 * @returns The language to start with.
 */
function initialLanguage(): Language {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage is optional.
  }
  const candidate = saved ?? navigator.language.slice(0, 2);
  return LANGUAGES.includes(candidate as Language) ? (candidate as Language) : 'en';
}

/**
 * Provides the current language to the components below it.
 *
 * @param props - Child components.
 * @returns The provider element.
 */
export function I18nProvider({ children }: { children: ComponentChildren }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage is optional.
    }
  }, []);

  const value = useMemo<I18n>(
    () => ({
      language,
      setLanguage,
      t: (key, params) => translate(language, key, params),
      tDynamic: (key, params) => translate(language, key, params),
    }),
    [language, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Gives access to the current language and to the translation functions.
 *
 * @returns The i18n helpers.
 */
export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (value === null) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return value;
}
