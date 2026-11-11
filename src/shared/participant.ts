/**
 * Rules for the organisers' presentation at the top of the participant
 * view: which text is shown, and the placeholders it may contain.
 */
import type { Language } from './rules';
import type { LocalizedText } from './types';

/**
 * Values replacing the placeholders organisers can write in their
 * presentation, so that it stays right if the selection changes.
 */
export interface IntroValues {
  /** Number of missions in the final set, such as 18. */
  missions: number;
  /** Missions to complete on the day to earn the medal. */
  medal: number;
}

/** Placeholders the presentation accepts, as organisers type them. */
export const INTRO_PLACEHOLDERS: readonly (keyof IntroValues)[] = ['missions', 'medal'];

/**
 * Replaces `{missions}` and `{medal}` in a presentation. Anything else in
 * braces is left as written.
 *
 * @param text - Text written by the organisers.
 * @param values - Values to insert.
 * @returns The final text.
 */
export function fillIntroPlaceholders(text: string, values: IntroValues): string {
  return INTRO_PLACEHOLDERS.reduce(
    (result, name) => result.replaceAll(`{${name}}`, String(values[name])),
    text,
  );
}

/**
 * Picks the organisers' presentation in the visitor's language. There is
 * deliberately no fallback to another language: when this one is empty,
 * the page shows its default sentence in the visitor's language instead.
 *
 * @param intro - The presentation, per language.
 * @param language - Language chosen by the visitor.
 * @param values - Values for the placeholders.
 * @returns The text to show, or null to show the default sentence.
 */
export function participantIntroText(
  intro: LocalizedText,
  language: Language,
  values: IntroValues,
): string | null {
  const text = (intro[language] ?? '').trim();
  return text === '' ? null : fillIntroPlaceholders(text, values);
}
