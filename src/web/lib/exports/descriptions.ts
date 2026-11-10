/**
 * Mission descriptions as they leave the tool. The handbook lets them be in
 * the local language and asks to add English when there is room, so this
 * decides, for a whole set of missions at once, which of the two applies.
 */
import { resolveLocalized } from '../../../shared/letter';
import {
  MISSION_DESCRIPTION_MAX_LENGTH,
  characterCount,
  type Language,
} from '../../../shared/rules';
import type { Mission } from '../../../shared/types';

/** What goes between the two languages: the end of the line and a blank line. */
const LANGUAGE_SEPARATOR = '\n\n';

/**
 * Joins the text in one language with the English one.
 *
 * @param description - Description of the mission, per language.
 * @param language - The language that goes first.
 * @returns The joined text, or null when either language is missing or the
 *   result would exceed the limit of the handbook.
 */
function joinWithEnglish(description: Mission['description'], language: Language): string | null {
  const local = description[language]?.trim() ?? '';
  const english = description.en?.trim() ?? '';
  if (local === '' || english === '') {
    return null;
  }
  const joined = `${local}${LANGUAGE_SEPARATOR}${english}`;
  return characterCount(joined) <= MISSION_DESCRIPTION_MAX_LENGTH ? joined : null;
}

/**
 * Builds the descriptions of a set of missions. Outside English, each one
 * carries the chosen language followed by English, but only when that is
 * possible for every mission: the set must read the same way throughout, so
 * a single mission that cannot do it leaves them all in the chosen language.
 *
 * @param missions - The missions being exported.
 * @param language - The chosen language.
 * @returns One description per mission, in the order received.
 */
export function exportedDescriptions(
  missions: readonly Pick<Mission, 'description'>[],
  language: Language,
): string[] {
  const singleLanguage = missions.map(({ description }) => resolveLocalized(description, language));
  if (language === 'en') {
    return singleLanguage;
  }
  const joined = missions.map(({ description }) => joinWithEnglish(description, language));
  return joined.every((text): text is string => text !== null) ? joined : singleLanguage;
}
