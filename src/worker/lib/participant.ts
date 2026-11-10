/**
 * Builds what the participant view of a Mission Day shows.
 */
import { mayShowLogo } from '../../shared/partners';
import { fullMissionName } from '../../shared/rules';
import type { Mission, MissionDay, ParticipantMission, ParticipantView } from '../../shared/types';
import { findMissionDayFile } from './db';
import { findPartner, findPartnerFile } from './partners';

/** The overlay applied to the participant view's images. */
export interface ParticipantOverlay {
  key: string;
  type: string;
  /** Changes with the file, so that browsers never keep a replaced one. */
  tag: string;
}

/**
 * Chooses the overlay of the participant view: the chosen partner's while
 * it may still show its logo, and the default one otherwise. Checking it
 * on every request means a withdrawn permission takes effect at once.
 *
 * @param db - D1 binding.
 * @param missionDay - The Mission Day.
 * @returns The overlay, or null when there is none to apply.
 */
export async function findParticipantOverlay(
  db: D1Database,
  missionDay: MissionDay,
): Promise<ParticipantOverlay | null> {
  if (missionDay.participantPartnerId !== null) {
    const partner = await findPartner(db, missionDay.id, missionDay.participantPartnerId);
    if (partner !== null && partner.hasOverlay && mayShowLogo(partner)) {
      const file = await findPartnerFile(db, partner.id, 'overlay');
      if (file !== null) {
        return { ...file, tag: `p${partner.overlayVersion}-${partner.id.slice(0, 8)}` };
      }
    }
  }
  const file = await findMissionDayFile(db, missionDay.id, 'default_overlay');
  return file === null ? null : { ...file, tag: `d${missionDay.defaultOverlayVersion}` };
}

/**
 * Assembles the participant view. Each field is copied on purpose, so that
 * notes, contacts and partner talks can never reach the public page.
 *
 * @param missionDay - The Mission Day.
 * @param missions - All its candidates; only the selected ones are shown.
 * @param overlayTag - Tag of the overlay applied, or null for none.
 * @returns The data for the public page.
 */
export function buildParticipantView(
  missionDay: MissionDay,
  missions: readonly Mission[],
  overlayTag: string | null,
): ParticipantView {
  const selected: ParticipantMission[] = missions
    .filter((mission) => mission.selected && mission.recommendedOrder !== null)
    .sort((a, b) => a.recommendedOrder! - b.recommendedOrder!)
    .map((mission) => ({
      id: mission.id,
      name: fullMissionName(missionDay, mission.landmark),
      description: { ...mission.description },
      colour: mission.colour,
      order: mission.recommendedOrder!,
      hasPhoto: mission.hasPhoto,
      photoVersion: mission.photoVersion,
      waypoints: mission.waypoints.map(({ title, lat, lng }) => ({ title, lat, lng })),
    }));
  return {
    city: missionDay.city,
    year: missionDay.year,
    date: missionDay.date,
    missions: selected,
    myMapsUrl: missionDay.myMapsUrl,
    overlayTag,
  };
}
