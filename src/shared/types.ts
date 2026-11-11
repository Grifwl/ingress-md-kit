/**
 * Domain types shared by the Worker and the frontend.
 *
 * These describe the JSON the API exchanges, not the database rows: the
 * Worker maps snake_case columns and JSON columns to these shapes.
 */
import type { PartnerKind, PartnerStatus } from './partners';
import type { Language, MissionFormat } from './rules';

/** Text kept per language, keyed by language code such as `en`. */
export type LocalizedText = Record<string, string>;

/** Role of an organiser within one Mission Day. */
export type MembershipRole = 'owner' | 'editor';

/** Lifecycle of a Mission Day application. */
export type MissionDayStatus = 'draft' | 'applied' | 'approved' | 'done';

/** Agent faction, as used for the Points of Contact and organiser profiles. */
export type Faction = 'ENL' | 'RES';

/** A person named on the Mission Day team. */
export interface TeamContact {
  codename: string;
  contact: string;
}

/** A faction's Point of Contact; `contact` is the primary contact method. */
export interface PointOfContact extends TeamContact {
  email: string;
  backupContact: string;
}

/** Team of a Mission Day: both faction Points of Contact plus other organisers. */
export interface Team {
  enlPoc: PointOfContact;
  resPoc: PointOfContact;
  others: TeamContact[];
}

/** Shared sections of the partner letter, each one per language. */
export interface LetterSections {
  aboutUs: LocalizedText;
  whatIsIngress: LocalizedText;
  whatIsMissionDay: LocalizedText;
  whyThisCity: LocalizedText;
  whyYou: LocalizedText;
  logoRequest: LocalizedText;
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
  /** The Mission Day's own presentation to agents, per language. */
  participantIntro: LocalizedText;
  /** Partner whose overlay the participant view uses; null for the default. */
  participantPartnerId: string | null;
  hasDefaultOverlay: boolean;
  defaultOverlayVersion: number;
  hasMapScreenshot: boolean;
  mapScreenshotVersion: number;
  /** Theme of the Mission Day, as asked by the application form. */
  applicationTheme: string;
  /** What sets it apart from a recent Mission Day in the area, if any. */
  applicationDifference: string;
  /** Whether the picture sent with the application has been generated. */
  hasSample: boolean;
  sampleVersion: number;
  /** Partner whose logo the picture shows; null for the default overlay. */
  samplePartnerId: string | null;
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

/** One recorded change in the conversation with a partner. */
export interface PartnerStatusChange {
  status: PartnerStatus;
  note: string;
  changedAt: string;
  changedBy: string;
}

/**
 * An entity asked to let the Mission Day use its logo. `whyYou` and
 * `logoRequest` are copied from the Mission Day when the partner is
 * created, so that they can be adapted to this partner alone.
 */
export interface Partner {
  id: string;
  missionDayId: string;
  name: string;
  kind: PartnerKind;
  contactPerson: string;
  contactEmail: string;
  whyYou: LocalizedText;
  logoRequest: LocalizedText;
  letterLanguage: Language;
  proposalToken: string;
  status: PartnerStatus;
  statusHistory: PartnerStatusChange[];
  hasLogo: boolean;
  logoVersion: number;
  hasOverlay: boolean;
  overlayVersion: number;
  hasApproval: boolean;
  approvalVersion: number;
  approvalName: string | null;
}

/** A selected mission as a partner sees it. */
export interface ProposalMission {
  id: string;
  name: string;
  description: string;
  colour: string;
  order: number;
  hasPhoto: boolean;
  photoVersion: number;
  waypoints: Pick<Waypoint, 'title' | 'lat' | 'lng'>[];
}

/**
 * Everything a public proposal shows. It is built field by field because
 * the page is open to anyone holding the link: private data such as notes
 * or contact details must be left out by construction.
 */
export interface ProposalView {
  city: string;
  year: number;
  language: Language;
  partnerName: string;
  hasLogo: boolean;
  logoVersion: number;
  /** Whether a partner or default overlay exists to apply to the images. */
  hasOverlay: boolean;
  overlayVersion: number;
  letter: {
    aboutUs: string;
    whatIsIngress: string;
    whatIsMissionDay: string;
    whyThisCity: string;
    whyYou: string;
    logoRequest: string;
    closing: string;
  };
  missions: ProposalMission[];
  myMapsUrl: string | null;
  hasMapScreenshot: boolean;
  mapScreenshotVersion: number;
}

/**
 * A selected mission as participants see it. The description keeps every
 * language, because the page follows the visitor's choice of language.
 */
export interface ParticipantMission {
  id: string;
  name: string;
  description: LocalizedText;
  colour: string;
  order: number;
  hasPhoto: boolean;
  photoVersion: number;
  waypoints: Pick<Waypoint, 'title' | 'lat' | 'lng'>[];
}

/**
 * Everything the participant view shows. Like a proposal, it is built
 * field by field, so that notes, contacts and partner talks never reach it.
 */
export interface ParticipantView {
  city: string;
  year: number;
  date: string | null;
  /** The organisers' own presentation, per language; may be empty. */
  intro: LocalizedText;
  missions: ParticipantMission[];
  myMapsUrl: string | null;
  /**
   * Identifies the overlay being applied, for the address of its image;
   * null when there is none. It changes whenever the overlay does, even
   * when the switch is between two files with the same version number.
   */
  overlayTag: string | null;
}

/**
 * A Mission Day as the home page lists it: only what its published
 * participant view already shows, plus whether it is over.
 */
export interface HomeMissionDay {
  slug: string;
  city: string;
  year: number;
  date: string | null;
  /** True once its date has passed or its organisers marked it as done. */
  past: boolean;
}

/** The contact of the instance, ready to display. */
export interface HomeContact {
  /** Text to show. */
  label: string;
  /** Address it links to, or null to show the text alone. */
  href: string | null;
}

/**
 * Everything the home page of the instance shows. Like the other public
 * views, it is built field by field.
 */
export interface HomeView {
  /** Mission Days whose participant view is published, upcoming first. */
  missionDays: HomeMissionDay[];
  /** How to reach whoever runs the instance; null when not set. */
  contact: HomeContact | null;
}

/** Settings of the whole instance that its administrators edit. */
export interface InstanceSettings {
  /** Contact text shown on the home page, such as `@someone`. */
  contactLabel: string;
  /** Where that text links to: an `https:`, `http:` or `mailto:` address, or empty. */
  contactUrl: string;
}

/**
 * What an organiser says about themself. It belongs to the person, not to
 * a Mission Day, so it is the same in every team they are part of.
 */
export interface OrganiserProfile {
  email: string;
  codename: string;
  faction: Faction | null;
}

/** An organiser as a member of one Mission Day's team. */
export interface Member extends OrganiserProfile {
  role: MembershipRole;
}

/**
 * A Mission Day as listed to an instance administrator, who may manage
 * the team of any of them. `role` is null where they are not a member.
 */
export interface InstanceMissionDay {
  slug: string;
  city: string;
  year: number;
  role: MembershipRole | null;
}

/** The signed-in organiser, as reported by the API. */
export interface CurrentUser extends OrganiserProfile {
  isInstanceAdmin: boolean;
}
