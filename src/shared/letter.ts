/**
 * Rules for rendering a partner's letter and for its address.
 */
import { LANGUAGES, type Language } from './rules';
import type { LocalizedText } from './types';

/** Word used in the proposal address for each letter language. */
export const PROPOSAL_WORDS: Record<Language, string> = {
  ca: 'proposta',
  es: 'propuesta',
  en: 'proposal',
};

/** Values replacing the placeholders organisers can write in letter texts. */
export interface LetterValues {
  partner: string;
  city: string;
}

/** Parts of the last segment of a proposal address. */
export interface ProposalSegment {
  word: string;
  token: string;
}

/**
 * Builds the path of a proposal, with the word of its letter language.
 *
 * @param slug - Mission Day slug.
 * @param language - Letter language of the partner.
 * @param token - Secret token of the proposal.
 * @returns The path.
 */
export function proposalPath(slug: string, language: Language, token: string): string {
  return `/${slug}/${PROPOSAL_WORDS[language]}-${token}`;
}

/**
 * Splits the last segment of a proposal address.
 *
 * @param segment - Text such as `proposta-AbC123…`.
 * @returns Its parts, or null when it is not a proposal address.
 */
export function parseProposalSegment(segment: string): ProposalSegment | null {
  const match = /^(proposta|propuesta|proposal)-([A-Za-z0-9_-]{16,})$/.exec(segment);
  return match === null ? null : { word: match[1]!, token: match[2]! };
}

/**
 * Finds the language a word of the proposal address belongs to.
 *
 * @param word - Word from the address.
 * @returns Its language; English for an unknown word.
 */
export function languageOfProposalWord(word: string): Language {
  return LANGUAGES.find((language) => PROPOSAL_WORDS[language] === word) ?? 'en';
}

/**
 * Picks the text to show from a per-language map: the requested language,
 * then English, then whichever language has content.
 *
 * @param text - Per-language map.
 * @param language - Preferred language.
 * @returns The text, or an empty string when there is none.
 */
export function resolveLocalized(text: LocalizedText, language: Language): string {
  const filled = (value: string | undefined) =>
    value !== undefined && value.trim() !== '' ? value : undefined;
  return filled(text[language]) ?? filled(text.en) ?? Object.values(text).find(filled) ?? '';
}

/**
 * Replaces `{partner}` and `{city}` in a letter text. Default texts serve
 * every Mission Day, so these are what lets them mention specific names.
 *
 * @param text - Text written by the organisers.
 * @param values - Values to insert.
 * @returns The final text.
 */
export function fillLetterPlaceholders(text: string, values: LetterValues): string {
  return text.replaceAll('{partner}', values.partner).replaceAll('{city}', values.city);
}
