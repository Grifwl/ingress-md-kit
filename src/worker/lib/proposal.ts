/**
 * Builds what a public proposal shows.
 */
import { fillLetterPlaceholders, resolveLocalized } from '../../shared/letter';
import { fullMissionName } from '../../shared/rules';
import type {
  LocalizedText,
  Mission,
  MissionDay,
  Partner,
  ProposalMission,
  ProposalView,
} from '../../shared/types';

/**
 * Lists the selected missions as the partner will see them.
 *
 * @param missionDay - Provides the name pattern.
 * @param missions - All the candidates.
 * @param partner - Provides the language.
 * @returns The selected missions, in recommended order.
 */
function proposalMissions(
  missionDay: MissionDay,
  missions: readonly Mission[],
  partner: Partner,
): ProposalMission[] {
  return missions
    .filter((mission) => mission.selected && mission.recommendedOrder !== null)
    .sort((a, b) => a.recommendedOrder! - b.recommendedOrder!)
    .map((mission) => ({
      id: mission.id,
      name: fullMissionName(missionDay, mission.landmark),
      description: resolveLocalized(mission.description, partner.letterLanguage),
      colour: mission.colour,
      order: mission.recommendedOrder!,
      hasPhoto: mission.hasPhoto,
      photoVersion: mission.photoVersion,
      waypoints: mission.waypoints.map(({ title, lat, lng }) => ({ title, lat, lng })),
    }));
}

/**
 * Assembles a proposal. Each field is copied on purpose, so that notes,
 * contact details and negotiation status can never reach the public page.
 *
 * @param missionDay - The Mission Day.
 * @param partner - The partner the proposal is for.
 * @param missions - All the candidates of the Mission Day.
 * @returns The data for the public page.
 */
export function buildProposalView(
  missionDay: MissionDay,
  partner: Partner,
  missions: readonly Mission[],
): ProposalView {
  const language = partner.letterLanguage;
  const values = { partner: partner.name, city: missionDay.city };

  /**
   * Resolves a text for the partner and fills in its placeholders.
   *
   * @param text - Per-language map.
   * @returns The final text.
   */
  const render = (text: LocalizedText) =>
    fillLetterPlaceholders(resolveLocalized(text, language), values);

  return {
    city: missionDay.city,
    year: missionDay.year,
    language,
    partnerName: partner.name,
    hasLogo: partner.hasLogo,
    logoVersion: partner.logoVersion,
    hasOverlay: partner.hasOverlay || missionDay.hasDefaultOverlay,
    overlayVersion: partner.hasOverlay ? partner.overlayVersion : missionDay.defaultOverlayVersion,
    letter: {
      aboutUs: render(missionDay.letter.aboutUs),
      whatIsIngress: render(missionDay.letter.whatIsIngress),
      whatIsMissionDay: render(missionDay.letter.whatIsMissionDay),
      whyThisCity: render(missionDay.letter.whyThisCity),
      whyYou: render(partner.whyYou),
      logoRequest: render(partner.logoRequest),
      closing: render(missionDay.letter.closing),
    },
    missions: proposalMissions(missionDay, missions, partner),
    myMapsUrl: missionDay.myMapsUrl,
    hasMapScreenshot: missionDay.hasMapScreenshot,
    mapScreenshotVersion: missionDay.mapScreenshotVersion,
  };
}
