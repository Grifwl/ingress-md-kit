/**
 * Domain types shared by the Worker and the frontend.
 *
 * These describe the JSON the API exchanges, not the database rows: the
 * Worker maps snake_case columns and JSON columns to these shapes.
 */
import type { BiocardGenericPhoto, BiocardSettings } from './biocard';
import type { BiocardAnswer, PartnerKind, PartnerStatus } from './partners';
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
  /** What a Biocard is; shown next to the Mission Day's own card. */
  whatIsBiocard: LocalizedText;
  /** Asks a partner whether it wants to appear on the cards. */
  biocardRequest: LocalizedText;
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
  /** Layout and texts of the Biocards. */
  biocard: BiocardSettings;
  /** Files of the Biocards; a version of 0 means the file was never uploaded. */
  biocardFiles: BiocardFileVersions;
}

/** The files of a Mission Day's Biocards. */
export type BiocardFileKind = 'front' | 'back' | 'photo' | 'font';

/**
 * Version of each Biocard file, or null when there is none. The version
 * goes in the address of the file, so that browsers never keep an old one.
 */
export type BiocardFileVersions = Record<BiocardFileKind, number | null>;

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
  /**
   * Side in pixels of the full-quality copy of the photo, used to print
   * Biocards; null when the photo was stored only at 512 px.
   */
  photoFullSize: number | null;
  selected: boolean;
  recommendedOrder: number | null;
  notes: string;
  colour: string;
  /** Shorter name for its Biocard; empty to use the landmark. */
  biocardName: string;
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
  /** Copied from the Mission Day on creation, like the logo request. */
  biocardRequest: LocalizedText;
  /** What the partner answered about appearing on the Biocards. */
  biocardAnswer: BiocardAnswer;
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
    whatIsBiocard: string;
    biocardRequest: string;
    closing: string;
  };
  missions: ProposalMission[];
  myMapsUrl: string | null;
  hasMapScreenshot: boolean;
  mapScreenshotVersion: number;
  /** The ticked Biocards, when the organisers show them on proposals. */
  biocards: PublicBiocards | null;
}

/**
 * The Biocards a public page shows, as it composes them. They are only
 * sent once both templates exist, and only cards that have a picture, so
 * every one of them can be drawn.
 */
export interface PublicBiocards {
  layout: BiocardSettings['layout'];
  frontVersion: number;
  backVersion: number;
  /** Version of the Mission Day's own font, or null for the default one. */
  fontVersion: number | null;
  /**
   * Whether the pictures carry the overlay of the page, which is then a
   * partner's: the default overlay is never used on Biocards.
   */
  overlay: boolean;
  /** The Mission Day's own card first, then missions in recommended order. */
  cards: PublicBiocardCard[];
}

/** One Biocard on a public page. */
export interface PublicBiocardCard {
  /** `generic` for the Mission Day's own card, otherwise the mission id. */
  key: string;
  name: string;
  /**
   * Where the picture comes from: the Mission Day card's own photo, a
   * collage of the photos of the missions on the page, or the photo of
   * the card's mission.
   */
  picture: BiocardGenericPhoto | 'mission';
  /** Version of that photo; unused for a collage. */
  photoVersion: number;
  /** Description per language; a proposal sends only its own language. */
  description: LocalizedText;
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
  /** The ticked Biocards, when the organisers show them to agents. */
  biocards: PublicBiocards | null;
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
