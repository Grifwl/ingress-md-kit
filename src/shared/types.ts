/**
 * Domain types shared by the Worker and the frontend.
 *
 * These describe the JSON the API exchanges, not the database rows: the
 * Worker maps snake_case columns and JSON columns to these shapes.
 */
import type { MissionFormat } from './rules';

/** Text kept per language, keyed by language code such as `en`. */
export type LocalizedText = Record<string, string>;

/** Role of an organiser within one Mission Day. */
export type MembershipRole = 'owner' | 'editor';

/** Lifecycle of a Mission Day application. */
export type MissionDayStatus = 'draft' | 'applied' | 'approved' | 'done';

/** Agent faction, as used for the Points of Contact. */
export type Faction = 'ENL' | 'RES';

/** A person named on the Mission Day team. */
export interface TeamContact {
  codename: string;
  contact: string;
}

/** Team of a Mission Day: both faction Points of Contact plus other organisers. */
export interface Team {
  enlPoc: TeamContact;
  resPoc: TeamContact;
  others: TeamContact[];
}

/** Shared sections of the partner letter, each one per language. */
export interface LetterSections {
  aboutUs: LocalizedText;
  whatIsIngress: LocalizedText;
  whatIsMissionDay: LocalizedText;
  whyThisCity: LocalizedText;
  closing: LocalizedText;
}

/** One Mission Day hosted by the instance. */
export interface MissionDay {
  id: string;
  slug: string;
  city: string;
  year: number;
  date: string | null;
  format: MissionFormat;
  status: MissionDayStatus;
  team: Team;
  letter: LetterSections;
  myMapsUrl: string | null;
  participantViewEnabled: boolean;
}

/** A Mission Day together with the role of the person requesting it. */
export interface MissionDayWithRole extends MissionDay {
  role: MembershipRole;
}

/** Square region of the original photo, in that photo's own pixels. */
export interface CropRect {
  x: number;
  y: number;
  size: number;
}

/**
 * One portal stop of a mission. The action is always a portal hack, so it
 * is not stored. `portalGuid` is null for portals entered by hand until a
 * Ultimate Mission Maker import supplies the real identifier.
 */
export interface Waypoint {
  position: number;
  portalGuid: string | null;
  title: string;
  lat: number;
  lng: number;
  imageUrl: string | null;
}

/** A candidate mission; `selected` marks those in the final set. */
export interface Mission {
  id: string;
  missionDayId: string;
  landmark: string;
  description: LocalizedText;
  photoVersion: number;
  hasPhoto: boolean;
  crop: CropRect | null;
  selected: boolean;
  recommendedOrder: number | null;
  notes: string;
  colour: string;
  waypoints: Waypoint[];
}

/** The signed-in organiser, as reported by the API. */
export interface CurrentUser {
  email: string;
  isInstanceAdmin: boolean;
}
