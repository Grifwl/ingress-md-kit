/**
 * Mission Day Handbook rules: the single source of truth.
 *
 * The UI, the validation and the exports all import from here, so a change
 * in the handbook is a change in this one file. Everything is pure, which
 * lets the Worker and the browser share it.
 *
 * Validators report problems instead of throwing: the tool warns and lets
 * organisers keep working. Only exports for Niantic refuse to run, and
 * only when there are issues of severity `error`.
 */
import type { Mission, MissionDay, Partner } from './types';

/** Number of missions in the final set of each format. */
export const MISSION_FORMATS = {
  standard18: { missions: 18 },
  standard24: { missions: 24 },
  lite6: { missions: 6 },
} as const;

/** Identifier of a Mission Day format. */
export type MissionFormat = keyof typeof MISSION_FORMATS;

/** Maximum length of a full mission name, in characters. */
export const MISSION_NAME_MAX_LENGTH = 50;

/** Maximum length of a mission description, in characters. */
export const MISSION_DESCRIPTION_MAX_LENGTH = 200;

/** Minimum number of portals in a mission. */
export const WAYPOINTS_MIN = 6;

/** Maximum number of portals in a mission. */
export const WAYPOINTS_MAX = 10;

/** Width and height of every mission image, in pixels. */
export const IMAGE_SIZE_PX = 512;

/** Upper bound for an uploaded 512×512 PNG, which protects the free-tier storage. */
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/** Upper bound for a signed approval document or a map screenshot. */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Number of columns of the mosaic, matching the scanner's display. */
export const MOSAIC_COLUMNS = 6;

/** Path segments the application uses, at the root or under /admin, so a slug cannot take them. */
export const RESERVED_SLUGS: readonly string[] = [
  'admin',
  'api',
  'assets',
  'letter-defaults',
  'new',
];

/** Longest address a Mission Day can have. */
export const SLUG_MAX_LENGTH = 60;

/** Languages available in the interface and offered for content fields. */
export const LANGUAGES = ['ca', 'es', 'en'] as const;

/** A language of the interface. */
export type Language = (typeof LANGUAGES)[number];

/** Whether an issue stops a Niantic export (`error`) or is only advice (`warning`). */
export type IssueSeverity = 'error' | 'warning';

/** Stable identifiers of the problems the validators can report; the UI translates them. */
export type IssueCode =
  | 'mission.landmarkMissing'
  | 'mission.nameTooLong'
  | 'mission.descriptionMissing'
  | 'mission.descriptionTooLong'
  | 'mission.sequenceHint'
  | 'mission.tooFewWaypoints'
  | 'mission.tooManyWaypoints'
  | 'mission.duplicatePortal'
  | 'mission.photoMissing'
  | 'selection.wrongCount'
  | 'selection.orderInvalid'
  | 'selection.duplicateName'
  | 'selection.sharedPortal'
  | 'mission.portalWithoutGuid'
  | 'images.noOverlay'
  | 'partner.noApproval'
  | 'partner.notAccepted'
  | 'partner.noOverlay'
  | 'application.enlPocMissing'
  | 'application.resPocMissing'
  | 'application.mapLinkMissing'
  | 'application.themeMissing'
  | 'application.sampleMissing'
  | 'sample.firstPhotoMissing';

/** A problem found by a validator. */
export interface ValidationIssue {
  code: IssueCode;
  severity: IssueSeverity;
  missionId?: string;
  params?: Record<string, string | number>;
}

// Words that would chain one mission to another. The patterns stay narrow
// because a false alarm on an ordinary landmark name is worse than a miss:
// this is only a hint, and an organiser reviews the final set anyway.
const SEQUENCE_PATTERNS: readonly RegExp[] = [
  /\b\d{1,2}\s*(?:\/|of|de)\s*\d{1,2}\b/i,
  /#\s*\d{1,2}\b/,
  /\bnext mission\b/i,
  /\bmissi[oó]n? seg[uü]ent\b/i,
  /\bseg[uü]ent missi[oó](?!\p{L})/iu,
  /\bsiguiente misi[oó]n\b/i,
];

/**
 * Counts user-perceived characters more faithfully than `String.length`,
 * so that an accent or emoji outside the BMP is not counted twice.
 *
 * @param text - Text to measure.
 * @returns Number of Unicode code points.
 */
export function characterCount(text: string): number {
  return [...text].length;
}

/**
 * Builds the full name of a mission from the handbook pattern.
 *
 * @param missionDay - Provides the year and the city.
 * @param landmark - Landmark or theme of the mission.
 * @returns The name, such as `MD 2027: Example City, Old Bridge`.
 */
export function fullMissionName(
  missionDay: Pick<MissionDay, 'year' | 'city'>,
  landmark: string,
): string {
  return `MD ${missionDay.year}: ${missionDay.city}, ${landmark}`;
}

/**
 * Checks whether a slug can be used for a Mission Day.
 *
 * @param slug - Candidate, in lowercase `city-year` style.
 * @returns True when it is well formed and not a reserved path.
 */
export function isValidSlug(slug: string): boolean {
  return (
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
    slug.length >= 3 &&
    slug.length <= SLUG_MAX_LENGTH &&
    !RESERVED_SLUGS.includes(slug)
  );
}

/**
 * Proposes the address of a Mission Day from its city and year: lowercase,
 * without accents, and with hyphens in place of spaces and punctuation.
 *
 * @param city - Name of the city.
 * @param year - Year of the Mission Day; left out when it is not positive.
 * @returns The proposed slug, or an empty string when there is no city yet.
 */
export function suggestSlug(city: string, year: number): string {
  const name = city
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    // The Catalan interpunct joins two letters, so it must not split the word.
    .replace(/·/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (name === '') {
    return '';
  }
  const suffix = year > 0 ? `-${year}` : '';
  return `${name.slice(0, SLUG_MAX_LENGTH - suffix.length).replace(/-+$/, '')}${suffix}`;
}

/**
 * Tells whether a text seems to point at another mission of the set.
 *
 * @param text - Mission name or description.
 * @returns True when the text looks like a sequence marker.
 */
export function hasSequenceHint(text: string): boolean {
  return SEQUENCE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Returns a key identifying the physical portal of a waypoint. Waypoints
 * entered by hand have no GUID, so these fall back to their coordinates.
 *
 * @param waypoint - The waypoint to identify.
 * @returns A key that is equal for two stops at the same portal.
 */
function portalKey(waypoint: Mission['waypoints'][number]): string {
  return waypoint.portalGuid ?? `${waypoint.lat.toFixed(6)},${waypoint.lng.toFixed(6)}`;
}

/**
 * Validates one mission against the handbook.
 *
 * @param mission - The mission to check.
 * @param missionDay - Its Mission Day, which contributes to the full name.
 * @returns Every problem found; empty when the mission is compliant.
 */
export function validateMission(
  mission: Mission,
  missionDay: Pick<MissionDay, 'year' | 'city'>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const missionId = mission.id;

  if (mission.landmark.trim() === '') {
    issues.push({ code: 'mission.landmarkMissing', severity: 'error', missionId });
  }

  const nameLength = characterCount(fullMissionName(missionDay, mission.landmark));
  if (nameLength > MISSION_NAME_MAX_LENGTH) {
    issues.push({
      code: 'mission.nameTooLong',
      severity: 'error',
      missionId,
      params: { length: nameLength, max: MISSION_NAME_MAX_LENGTH },
    });
  }

  // A mission needs a description in at least one language, and every
  // language present has to fit, since any of them may reach the game.
  const descriptions = Object.entries(mission.description).filter(([, text]) => text.trim() !== '');
  if (descriptions.length === 0) {
    issues.push({ code: 'mission.descriptionMissing', severity: 'error', missionId });
  }
  for (const [language, text] of descriptions) {
    const length = characterCount(text);
    if (length > MISSION_DESCRIPTION_MAX_LENGTH) {
      issues.push({
        code: 'mission.descriptionTooLong',
        severity: 'error',
        missionId,
        params: { language, length, max: MISSION_DESCRIPTION_MAX_LENGTH },
      });
    }
  }

  // Missions are ANY ORDER and never a banner set, so a name or a
  // description must not read as one step of a sequence.
  if ([mission.landmark, ...descriptions.map(([, text]) => text)].some(hasSequenceHint)) {
    issues.push({ code: 'mission.sequenceHint', severity: 'warning', missionId });
  }

  const count = mission.waypoints.length;
  if (count < WAYPOINTS_MIN) {
    issues.push({
      code: 'mission.tooFewWaypoints',
      severity: 'error',
      missionId,
      params: { count, min: WAYPOINTS_MIN },
    });
  }
  if (count > WAYPOINTS_MAX) {
    issues.push({
      code: 'mission.tooManyWaypoints',
      severity: 'error',
      missionId,
      params: { count, max: WAYPOINTS_MAX },
    });
  }

  if (new Set(mission.waypoints.map(portalKey)).size !== count) {
    issues.push({ code: 'mission.duplicatePortal', severity: 'error', missionId });
  }

  if (!mission.hasPhoto) {
    issues.push({ code: 'mission.photoMissing', severity: 'error', missionId });
  }

  return issues;
}

/**
 * Validates the final selection of a Mission Day, including each selected
 * mission on its own. Candidates left out of the set are not checked.
 *
 * @param missionDay - The Mission Day that sets the format, year and city.
 * @param missions - All of its candidate missions.
 * @returns Every problem found; empty when the set is compliant.
 */
export function validateSelection(
  missionDay: Pick<MissionDay, 'year' | 'city' | 'format'>,
  missions: readonly Mission[],
): ValidationIssue[] {
  const selected = missions.filter((mission) => mission.selected);
  const expected = MISSION_FORMATS[missionDay.format].missions;
  const issues: ValidationIssue[] = [];

  if (selected.length !== expected) {
    issues.push({
      code: 'selection.wrongCount',
      severity: 'error',
      params: { count: selected.length, expected },
    });
  }

  // The recommended order must be exactly 1..N, with no gaps or repeats.
  const orders = selected.map((mission) => mission.recommendedOrder ?? 0).sort((a, b) => a - b);
  if (orders.some((order, index) => order !== index + 1)) {
    issues.push({ code: 'selection.orderInvalid', severity: 'error' });
  }

  const missionsByName = new Map<string, Mission[]>();
  const missionsByPortal = new Map<string, Mission[]>();
  for (const mission of selected) {
    issues.push(...validateMission(mission, missionDay));

    const name = fullMissionName(missionDay, mission.landmark);
    missionsByName.set(name, [...(missionsByName.get(name) ?? []), mission]);

    for (const key of new Set(mission.waypoints.map(portalKey))) {
      missionsByPortal.set(key, [...(missionsByPortal.get(key) ?? []), mission]);
    }
  }

  for (const [name, sameName] of missionsByName) {
    if (sameName.length > 1) {
      issues.push({ code: 'selection.duplicateName', severity: 'error', params: { name } });
    }
  }

  // Sharing a portal is legal but makes missions lead into each other, so
  // it is reported once per mission and only as advice.
  const sharing = new Set<string>();
  for (const sharedBy of missionsByPortal.values()) {
    if (sharedBy.length > 1) {
      sharedBy.forEach((mission) => sharing.add(mission.id));
    }
  }
  for (const missionId of sharing) {
    issues.push({ code: 'selection.sharedPortal', severity: 'warning', missionId });
  }

  return issues;
}

/** The exports that end up with Niantic, and so have to be complete. */
export type NianticExport = 'umm' | 'images' | 'sample' | 'application';

/**
 * Problems of the selection that also stop an application. Photos and
 * portals are not among them: the handbook asks for a single picture until
 * the overlay is approved, and portals are only needed to build the missions.
 */
const APPLICATION_BLOCKING_CODES: readonly IssueCode[] = [
  'selection.wrongCount',
  'selection.orderInvalid',
  'selection.duplicateName',
  'mission.landmarkMissing',
  'mission.nameTooLong',
];

/** What the checks of an export for Niantic look at, beyond the selection. */
export interface NianticContext {
  missionDay: Pick<
    MissionDay,
    'hasDefaultOverlay' | 'team' | 'myMapsUrl' | 'applicationTheme' | 'hasSample'
  >;
  selected: readonly Mission[];
  partner: Pick<Partner, 'hasApproval' | 'status' | 'hasOverlay'> | null;
}

/**
 * Checks what the images need: an overlay and, when they carry a partner's
 * logo, that partner's accepted and signed permission.
 *
 * @param context - Data to check.
 * @returns The problems found.
 */
function imageIssues({ missionDay, partner }: NianticContext): ValidationIssue[] {
  if (partner === null) {
    return missionDay.hasDefaultOverlay ? [] : [{ code: 'images.noOverlay', severity: 'error' }];
  }
  const issues: ValidationIssue[] = [];
  if (!partner.hasOverlay) issues.push({ code: 'partner.noOverlay', severity: 'error' });
  if (partner.status !== 'accepted')
    issues.push({ code: 'partner.notAccepted', severity: 'error' });
  if (!partner.hasApproval) issues.push({ code: 'partner.noApproval', severity: 'error' });
  return issues;
}

/**
 * Tells whether a Point of Contact has every answer the form asks for.
 *
 * @param person - The Point of Contact.
 * @returns True when all the fields are filled in.
 */
function isCompletePoc(person: NianticContext['missionDay']['team']['enlPoc']): boolean {
  return [person.codename, person.email, person.contact, person.backupContact].every(
    (value) => value.trim() !== '',
  );
}

/**
 * Keeps the problems of a selection that stop an application.
 *
 * @param issues - Result of `validateSelection`.
 * @returns The ones that matter at the application stage.
 */
export function applicationSelectionIssues(issues: readonly ValidationIssue[]): ValidationIssue[] {
  return issues.filter((issue) => APPLICATION_BLOCKING_CODES.includes(issue.code));
}

/**
 * Checks what an export for Niantic needs beyond a valid selection, which
 * `validateSelection` covers.
 *
 * @param kind - Which export.
 * @param context - Data to check.
 * @returns The problems found.
 */
export function nianticExportIssues(
  kind: NianticExport,
  context: NianticContext,
): ValidationIssue[] {
  if (kind === 'umm') {
    // The Mission Authoring Tool needs real portals, which only IITC can identify.
    return context.selected
      .filter((mission) => mission.waypoints.some((waypoint) => waypoint.portalGuid === null))
      .map((mission) => ({
        code: 'mission.portalWithoutGuid',
        severity: 'error',
        missionId: mission.id,
      }));
  }
  if (kind === 'images') {
    return imageIssues(context);
  }

  if (kind === 'sample') {
    const issues = imageIssues(context);
    if (context.selected[0]?.hasPhoto !== true) {
      issues.push({ code: 'sample.firstPhotoMissing', severity: 'error' });
    }
    return issues;
  }

  // The partner is not checked here: the application only mentions the one
  // shown in the sample picture, which already required its permission.
  const { missionDay } = context;
  const issues: ValidationIssue[] = [];
  if (!isCompletePoc(missionDay.team.enlPoc)) {
    issues.push({ code: 'application.enlPocMissing', severity: 'error' });
  }
  if (!isCompletePoc(missionDay.team.resPoc)) {
    issues.push({ code: 'application.resPocMissing', severity: 'error' });
  }
  if (missionDay.myMapsUrl === null) {
    issues.push({ code: 'application.mapLinkMissing', severity: 'error' });
  }
  if (missionDay.applicationTheme.trim() === '') {
    issues.push({ code: 'application.themeMissing', severity: 'error' });
  }
  if (!missionDay.hasSample) {
    issues.push({ code: 'application.sampleMissing', severity: 'error' });
  }
  return issues;
}

/**
 * Tells whether a set of issues allows an export for Niantic. Warnings are
 * allowed; errors are not.
 *
 * @param issues - Result of a validator.
 * @returns True when no issue has severity `error`.
 */
export function canExportForNiantic(issues: readonly ValidationIssue[]): boolean {
  return issues.every((issue) => issue.severity !== 'error');
}
