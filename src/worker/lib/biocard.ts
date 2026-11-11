/**
 * What public pages receive about a Mission Day's own Biocard.
 */
import type { LocalizedText, Mission, MissionDay, PublicBiocard } from '../../shared/types';

/**
 * Describes the Mission Day's own card for a public page, provided the
 * organisers chose to show it there and everything it needs exists: both
 * templates, and its photo or, for a collage, a selected mission with a
 * photo. Each field is copied on purpose, like the rest of public views.
 *
 * @param missionDay - The Mission Day.
 * @param missions - All its candidates.
 * @param shown - Whether the organisers show the card on this page.
 * @param description - Description to send, already reduced if needed.
 * @returns The card, or null when the page must not show one.
 */
export function buildPublicBiocard(
  missionDay: MissionDay,
  missions: readonly Mission[],
  shown: boolean,
  description: LocalizedText,
): PublicBiocard | null {
  const { biocard, biocardFiles } = missionDay;
  const hasPicture =
    biocard.genericPhoto === 'collage'
      ? missions.some((mission) => mission.selected && mission.hasPhoto)
      : biocardFiles.photo !== null;
  if (!shown || biocardFiles.front === null || biocardFiles.back === null || !hasPicture) {
    return null;
  }
  return {
    layout: biocard.layout,
    name: biocard.genericName,
    photo: biocard.genericPhoto,
    description,
    frontVersion: biocardFiles.front,
    backVersion: biocardFiles.back,
    photoVersion: biocardFiles.photo ?? 0,
    fontVersion: biocardFiles.font,
  };
}
