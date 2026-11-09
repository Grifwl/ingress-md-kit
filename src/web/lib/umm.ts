/**
 * Everything about the file format of Ultimate Mission Maker (UMM), the
 * community plugin used to pick portals and to pre-fill the Mission
 * Authoring Tool. The plugin is only interoperated with through its files,
 * and all knowledge of them stays here, so that a future change of format
 * is a change in this one file.
 */
import { resolveLocalized } from '../../shared/letter';
import { WAYPOINTS_MAX, WAYPOINTS_MIN, fullMissionName, type Language } from '../../shared/rules';
import type { Mission, MissionDay, Waypoint } from '../../shared/types';

/** The only version of the format this application understands. */
const SUPPORTED_FORMAT_VERSION = 2;

/** The one objective a Mission Day allows. */
const HACK_OBJECTIVE = 'HACK_PORTAL';

/** MIME type of the file; the plugin rejects any other. */
export const UMM_MIME_TYPE = 'application/json';

/** One portal of a UMM mission. */
export interface UmmPortal {
  description: string;
  guid: string;
  imageUrl: string;
  isOrnamented: boolean;
  isStartPoint: boolean;
  location: { latitude: number; longitude: number };
  title: string;
  type: string;
  objective: {
    type: string;
    passphrase_params: { question: string; _single_passphrase: string };
  };
}

/** One mission of a UMM file. */
export interface UmmMission {
  missionTitle: string;
  missionDescription: string;
  portals: UmmPortal[];
}

/** A UMM file, format version 2. */
export interface UmmFile {
  missionSetName: string;
  missionSetDescription: string;
  currentMission: number;
  plannedBannerLength: number;
  titleFormat: string;
  fileFormatVersion: number;
  missions: UmmMission[];
}

/** Why a file could not be read. */
export type UmmParseError = 'invalid_file' | 'unsupported_version';

/** Result of reading a file. */
export type UmmParseResult =
  { ok: true; missions: UmmImportedMission[] } | { ok: false; error: UmmParseError };

/** The part of a mission in a file that this application takes. */
export interface UmmImportedMission {
  waypoints: Waypoint[];
  /** Portals whose objective is not a hack. */
  otherObjectives: number;
}

/** Changes that importing a file would make to one mission. */
export interface UmmMissionDiff {
  position: number;
  /** Mission it applies to; null for one that will be created. */
  missionId: string | null;
  waypoints: Waypoint[];
  added: number;
  removed: number;
  reordered: boolean;
  otherObjectives: number;
  outOfRange: boolean;
}

/**
 * Builds the name of an exported file.
 *
 * @param slug - Mission Day slug.
 * @returns The file name.
 */
export function ummFileName(slug: string): string {
  return `${slug}-umm.json`;
}

/**
 * Converts a waypoint to a portal of the file.
 *
 * @param waypoint - The waypoint.
 * @returns The portal.
 */
function toPortal(waypoint: Waypoint): UmmPortal {
  return {
    description: '',
    guid: waypoint.portalGuid ?? '',
    imageUrl: waypoint.imageUrl ?? '',
    isOrnamented: false,
    isStartPoint: false,
    location: { latitude: waypoint.lat, longitude: waypoint.lng },
    title: waypoint.title,
    type: 'PORTAL',
    objective: {
      type: HACK_OBJECTIVE,
      passphrase_params: { question: '', _single_passphrase: '' },
    },
  };
}

/**
 * Builds a UMM file.
 *
 * @param missionDay - Provides the names.
 * @param missions - Missions to include, in the order of the file.
 * @param language - Language of the descriptions.
 * @returns The file contents.
 */
export function buildUmmFile(
  missionDay: Pick<MissionDay, 'year' | 'city'>,
  missions: readonly Mission[],
  language: Language,
): UmmFile {
  return {
    missionSetName: `MD ${missionDay.year}: ${missionDay.city}`,
    missionSetDescription: '',
    currentMission: 0,
    plannedBannerLength: missions.length,
    titleFormat: 'T NN-M',
    fileFormatVersion: SUPPORTED_FORMAT_VERSION,
    missions: missions.map((mission) => ({
      missionTitle: fullMissionName(missionDay, mission.landmark),
      missionDescription: resolveLocalized(mission.description, language),
      portals: mission.waypoints.map(toPortal),
    })),
  };
}

/**
 * Tells whether a value has the shape of a portal.
 *
 * @param value - Parsed JSON.
 * @returns True when the fields this application reads are valid.
 */
function isPortal(value: unknown): value is UmmPortal {
  const portal = value as Partial<UmmPortal> | null;
  return (
    typeof portal === 'object' &&
    portal !== null &&
    typeof portal.guid === 'string' &&
    typeof portal.title === 'string' &&
    Number.isFinite(portal.location?.latitude) &&
    Number.isFinite(portal.location?.longitude)
  );
}

/**
 * Reads a file. Of each mission only the portals are taken: the names and
 * descriptions kept in this application always win.
 *
 * @param text - Contents of the file.
 * @returns The missions, or why the file cannot be used.
 */
export function parseUmmFile(text: string): UmmParseResult {
  let parsed: Partial<UmmFile> | null;
  try {
    parsed = JSON.parse(text) as Partial<UmmFile> | null;
  } catch {
    return { ok: false, error: 'invalid_file' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'invalid_file' };
  }
  if (parsed.fileFormatVersion !== SUPPORTED_FORMAT_VERSION) {
    return { ok: false, error: 'unsupported_version' };
  }
  const missions = parsed.missions;
  if (
    !Array.isArray(missions) ||
    !missions.every((mission) => Array.isArray(mission?.portals) && mission.portals.every(isPortal))
  ) {
    return { ok: false, error: 'invalid_file' };
  }
  return {
    ok: true,
    missions: missions.map((mission) => ({
      waypoints: mission.portals.map((portal, position) => ({
        position,
        portalGuid: portal.guid === '' ? null : portal.guid,
        title: portal.title,
        lat: portal.location.latitude,
        lng: portal.location.longitude,
        imageUrl: portal.imageUrl ? portal.imageUrl : null,
      })),
      otherObjectives: mission.portals.filter((portal) => portal.objective?.type !== HACK_OBJECTIVE)
        .length,
    })),
  };
}

/**
 * Identifies the portal of a waypoint.
 *
 * @param waypoint - The waypoint.
 * @returns A key equal for two stops at the same portal.
 */
function portalKey(waypoint: Waypoint): string {
  return waypoint.portalGuid ?? `${waypoint.lat},${waypoint.lng}`;
}

/**
 * Works out what importing a file would change. Missions are matched by
 * their position against the last export, because the plugin can rewrite
 * titles; missions beyond those positions become new candidates.
 *
 * @param imported - Missions read from the file.
 * @param manifest - Mission identifiers by position in the last export.
 * @param missions - Current missions.
 * @returns One entry per mission of the file.
 */
export function diffUmmImport(
  imported: readonly UmmImportedMission[],
  manifest: readonly string[],
  missions: readonly Mission[],
): UmmMissionDiff[] {
  return imported.map(({ waypoints, otherObjectives }, position) => {
    const current = missions.find((mission) => mission.id === manifest[position]);
    const before = (current?.waypoints ?? []).map(portalKey);
    const after = waypoints.map(portalKey);
    const kept = after.filter((key) => before.includes(key));
    return {
      position,
      missionId: current?.id ?? null,
      waypoints,
      added: after.filter((key) => !before.includes(key)).length,
      removed: before.filter((key) => !after.includes(key)).length,
      reordered: kept.join('|') !== before.filter((key) => after.includes(key)).join('|'),
      otherObjectives,
      outOfRange: waypoints.length < WAYPOINTS_MIN || waypoints.length > WAYPOINTS_MAX,
    };
  });
}

/**
 * Tells whether an entry of an import changes anything.
 *
 * @param diff - The entry.
 * @returns True when saving it would have an effect.
 */
export function hasChanges(diff: UmmMissionDiff): boolean {
  return diff.missionId === null || diff.added > 0 || diff.removed > 0 || diff.reordered;
}
