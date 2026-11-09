/**
 * Application helper: the answers of the Niantic form, as plain text blocks
 * to paste by hand. The form itself is never automated.
 */
import { fillLetterPlaceholders, resolveLocalized } from '../../../shared/letter';
import type { Language } from '../../../shared/rules';
import type { Mission, MissionDay, Partner, TeamContact } from '../../../shared/types';

/** Identifies each answer of the form. */
export type ApplicationBlockKey =
  'whyThisCity' | 'theme' | 'attractions' | 'mapLink' | 'logoLink' | 'pointsOfContact' | 'partner';

/** One answer ready to paste. */
export interface ApplicationBlock {
  key: ApplicationBlockKey;
  text: string;
}

/**
 * Formats a person of the team.
 *
 * @param faction - Faction label.
 * @param person - Codename and contact.
 * @returns One line of text.
 */
function contactLine(faction: string, person: TeamContact): string {
  return `${faction}: ${person.codename}${person.contact === '' ? '' : ` (${person.contact})`}`;
}

/**
 * Builds the answers of the form.
 *
 * @param missionDay - The Mission Day.
 * @param selected - Selected missions, in order.
 * @param partner - The partner, or null when there is none.
 * @param language - Language of the texts.
 * @param partnerStatusLabel - Translated status of the partner.
 * @returns The answers, in the order of the form.
 */
export function buildApplicationBlocks(
  missionDay: MissionDay,
  selected: readonly Mission[],
  partner: Partner | null,
  language: Language,
  partnerStatusLabel: string,
): ApplicationBlock[] {
  const blocks: ApplicationBlock[] = [
    {
      key: 'whyThisCity',
      text: fillLetterPlaceholders(resolveLocalized(missionDay.letter.whyThisCity, language), {
        partner: partner?.name ?? '',
        city: missionDay.city,
      }),
    },
    { key: 'theme', text: missionDay.applicationTheme },
    { key: 'attractions', text: selected.map((mission) => mission.landmark).join('\n') },
    { key: 'mapLink', text: missionDay.myMapsUrl ?? '' },
    { key: 'logoLink', text: missionDay.logoUrl ?? '' },
    {
      key: 'pointsOfContact',
      text: [
        contactLine('ENL', missionDay.team.enlPoc),
        contactLine('RES', missionDay.team.resPoc),
      ].join('\n'),
    },
  ];
  if (partner !== null) {
    blocks.push({ key: 'partner', text: `${partner.name} (${partnerStatusLabel})` });
  }
  return blocks;
}
