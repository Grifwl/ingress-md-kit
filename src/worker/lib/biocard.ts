/**
 * What public pages receive about a Mission Day's Biocards.
 */
import { BIOCARD_GENERIC_KEY, biocardName, chosenBiocardKeys } from '../../shared/biocard';
import type {
  LocalizedText,
  Mission,
  MissionDay,
  PublicBiocardCard,
  PublicBiocards,
} from '../../shared/types';

/**
 * Describes the ticked Biocards for a public page, provided the organisers
 * chose to show them there and both templates exist. Only cards with a
 * picture are sent: the Mission Day's own card needs its photo or, for a
 * collage, a selected mission with a photo; a mission card needs its
 * mission to be selected, since public pages only know selected missions,
 * and to have a photo. Each field is copied on purpose, like the rest of
 * public views.
 *
 * @param missionDay - The Mission Day.
 * @param missions - All its candidates.
 * @param shown - Whether the organisers show the cards on this page.
 * @param describe - Reduces a description to what the page needs, such
 *   as the one language of a proposal.
 * @returns The cards, or null when the page must not show any.
 */
export function buildPublicBiocards(
  missionDay: MissionDay,
  missions: readonly Mission[],
  shown: boolean,
  describe: (description: LocalizedText) => LocalizedText,
): PublicBiocards | null {
  const { biocard, biocardFiles } = missionDay;
  if (!shown || biocardFiles.front === null || biocardFiles.back === null) {
    return null;
  }
  const chosen = chosenBiocardKeys(biocard, missions);
  const selected = missions
    .filter((mission) => mission.selected)
    .sort((a, b) => (a.recommendedOrder ?? 0) - (b.recommendedOrder ?? 0));
  const cards: PublicBiocardCard[] = [];

  const genericHasPicture =
    biocard.genericPhoto === 'collage'
      ? selected.some((mission) => mission.hasPhoto)
      : biocardFiles.photo !== null;
  if (chosen.has(BIOCARD_GENERIC_KEY) && genericHasPicture) {
    cards.push({
      key: BIOCARD_GENERIC_KEY,
      name: biocard.genericName,
      picture: biocard.genericPhoto,
      photoVersion: biocardFiles.photo ?? 0,
      description: describe(biocard.genericDescription),
    });
  }
  for (const mission of selected) {
    if (chosen.has(mission.id) && mission.hasPhoto) {
      cards.push({
        key: mission.id,
        name: biocardName(mission),
        picture: 'mission',
        photoVersion: mission.photoVersion,
        description: describe(mission.description),
      });
    }
  }

  if (cards.length === 0) {
    return null;
  }
  return {
    layout: biocard.layout,
    frontVersion: biocardFiles.front,
    backVersion: biocardFiles.back,
    fontVersion: biocardFiles.font,
    cards,
  };
}
