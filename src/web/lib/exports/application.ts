/**
 * Application helper: the answers of the Niantic form, as plain text blocks
 * to paste by hand. The form itself is never automated.
 */
import { fillLetterPlaceholders, resolveLocalized } from '../../../shared/letter';
import type { Language } from '../../../shared/rules';
import type { Mission, MissionDay, Partner, PointOfContact } from '../../../shared/types';

/** The form is in English, so its answers are too, whatever the interface uses. */
export const APPLICATION_LANGUAGE: Language = 'en';

/** Identifies each answer of the form. */
export type ApplicationBlockKey =
  | 'whyThisCity'
  | 'theme'
  | 'attractions'
  | 'mapLink'
  | 'logoLink'
  | 'pointsOfContact'
  | 'difference'
  | 'partner';

/** One answer ready to paste. */
export interface ApplicationBlock {
  key: ApplicationBlockKey;
  text: string;
}

/**
 * Formats a Point of Contact, with the fields in the order of the form,
 * whose questions are in English.
 *
 * @param faction - Faction label.
 * @param person - The Point of Contact.
 * @returns The text.
 */
function contactLines(faction: string, person: PointOfContact): string {
  return [
    `${faction} codename: ${person.codename}`,
    `Email: ${person.email}`,
    `Primary contact: ${person.contact}`,
    `Backup contact: ${person.backupContact}`,
  ].join('\n');
}

/**
 * Builds the answers of the form.
 *
 * @param missionDay - The Mission Day.
 * @param selected - Selected missions, in order.
 * @param partner - The partner, or null when there is none.
 * @param partnerStatusLabel - Status of the partner, in the application's language.
 * @param sampleUrl - Address of the picture of the logo/medal.
 * @returns The answers, in the order of the form.
 */
export function buildApplicationBlocks(
  missionDay: MissionDay,
  selected: readonly Mission[],
  partner: Partner | null,
  partnerStatusLabel: string,
  sampleUrl: string,
): ApplicationBlock[] {
  const blocks: ApplicationBlock[] = [
    {
      key: 'whyThisCity',
      text: fillLetterPlaceholders(
        resolveLocalized(missionDay.letter.whyThisCity, APPLICATION_LANGUAGE),
        { partner: partner?.name ?? '', city: missionDay.city },
      ),
    },
    { key: 'theme', text: missionDay.applicationTheme },
    { key: 'attractions', text: selected.map((mission) => mission.landmark).join('\n') },
    { key: 'mapLink', text: missionDay.myMapsUrl ?? '' },
    { key: 'logoLink', text: sampleUrl },
    {
      key: 'pointsOfContact',
      text: [
        contactLines('ENL', missionDay.team.enlPoc),
        contactLines('RES', missionDay.team.resPoc),
      ].join('\n\n'),
    },
  ];
  if (missionDay.applicationDifference.trim() !== '') {
    blocks.push({ key: 'difference', text: missionDay.applicationDifference });
  }
  if (partner !== null) {
    blocks.push({ key: 'partner', text: `${partner.name} (${partnerStatusLabel})` });
  }
  return blocks;
}
