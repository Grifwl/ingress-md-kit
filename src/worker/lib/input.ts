/**
 * Structural validation of API input.
 *
 * This layer only rejects data the application cannot store safely, such
 * as a wrong type or an oversized text. Handbook limits are deliberately
 * not enforced here: a 60-character name can be saved, and the validators
 * in `shared/rules.ts` will warn about it.
 */
import { HTTPException } from 'hono/http-exception';
import { MISSION_FORMATS, isValidSlug, type MissionFormat } from '../../shared/rules';
import type {
  CropRect,
  LetterSections,
  LocalizedText,
  MissionDayStatus,
  Team,
  TeamContact,
  Waypoint,
} from '../../shared/types';

const MAX_SHORT_TEXT = 200;
const MAX_LONG_TEXT = 5000;
const MAX_URL_LENGTH = 2048;
const MAX_LANGUAGES = 20;
const MAX_TEAM_OTHERS = 50;

// Far above the handbook's limit, because exceeding the limit is a warning
// the organiser must be able to see, but still a bound on what is stored.
const MAX_STORED_WAYPOINTS = 100;

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

const STATUSES: readonly MissionDayStatus[] = ['draft', 'applied', 'approved', 'done'];

/** Fields needed to create a Mission Day. */
export interface MissionDayCreateInput {
  slug: string;
  city: string;
  year: number;
  format: MissionFormat;
  ownerEmail: string | null;
}

/** Fields of a Mission Day that can be edited. */
export interface MissionDayPatch {
  city?: string;
  year?: number;
  date?: string | null;
  format?: MissionFormat;
  status?: MissionDayStatus;
  team?: Team;
  letter?: LetterSections;
  myMapsUrl?: string | null;
}

/** Fields of a mission that can be edited. */
export interface MissionPatch {
  landmark?: string;
  description?: LocalizedText;
  notes?: string;
  colour?: string;
}

/**
 * Stops the request with a 400 response.
 *
 * @param code - Error code returned to the client.
 * @throws Always.
 */
function badRequest(code: string): never {
  throw new HTTPException(400, { message: code });
}

/**
 * Asserts that a value is a plain object.
 *
 * @param value - Parsed JSON.
 * @returns The same value, typed as an object.
 */
export function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    badRequest('invalid_body');
  }
  return value as Record<string, unknown>;
}

/**
 * Validates a string field.
 *
 * @param value - Candidate value.
 * @param field - Name used in the error code.
 * @param max - Maximum number of UTF-16 units.
 * @returns The string.
 */
function text(value: unknown, field: string, max: number = MAX_SHORT_TEXT): string {
  if (typeof value !== 'string' || value.length > max) {
    badRequest(`invalid_${field}`);
  }
  return value;
}

/**
 * Validates a string field that must not be blank.
 *
 * @param value - Candidate value.
 * @param field - Name used in the error code.
 * @returns The trimmed string.
 */
function requiredText(value: unknown, field: string): string {
  const result = text(value, field).trim();
  if (result === '') {
    badRequest(`invalid_${field}`);
  }
  return result;
}

/**
 * Validates a year.
 *
 * @param value - Candidate value.
 * @returns The year.
 */
function year(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < MIN_YEAR || (value as number) > MAX_YEAR) {
    badRequest('invalid_year');
  }
  return value as number;
}

/**
 * Validates a Mission Day format.
 *
 * @param value - Candidate value.
 * @returns The format.
 */
function format(value: unknown): MissionFormat {
  if (typeof value !== 'string' || !Object.hasOwn(MISSION_FORMATS, value)) {
    badRequest('invalid_format');
  }
  return value as MissionFormat;
}

/**
 * Validates a nullable date in `YYYY-MM-DD` form.
 *
 * @param value - Candidate value.
 * @returns The date, or null when it was cleared.
 */
function optionalDate(value: unknown): string | null {
  if (value === null || value === '') {
    return null;
  }
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    badRequest('invalid_date');
  }
  return value;
}

/**
 * Validates a nullable web address. Only http(s) is accepted, since these
 * values end up in links and image sources.
 *
 * @param value - Candidate value.
 * @param field - Name used in the error code.
 * @returns The address, or null when it was cleared.
 */
function optionalWebUrl(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) {
    badRequest(`invalid_${field}`);
  }
  let protocol: string;
  try {
    protocol = new URL(value).protocol;
  } catch {
    badRequest(`invalid_${field}`);
  }
  if (protocol !== 'https:' && protocol !== 'http:') {
    badRequest(`invalid_${field}`);
  }
  return value;
}

/**
 * Validates a per-language text map.
 *
 * @param value - Candidate value.
 * @param field - Name used in the error code.
 * @returns The map.
 */
function localizedText(value: unknown, field: string): LocalizedText {
  const entries = Object.entries(asObject(value));
  if (entries.length > MAX_LANGUAGES) {
    badRequest(`invalid_${field}`);
  }
  const result: LocalizedText = {};
  for (const [language, content] of entries) {
    if (!/^[a-z]{2,3}$/.test(language)) {
      badRequest(`invalid_${field}`);
    }
    result[language] = text(content, field, MAX_LONG_TEXT);
  }
  return result;
}

/**
 * Validates a team member.
 *
 * @param value - Candidate value.
 * @returns The contact.
 */
function teamContact(value: unknown): TeamContact {
  const object = asObject(value);
  return { codename: text(object.codename, 'team'), contact: text(object.contact, 'team') };
}

/**
 * Validates a whole team.
 *
 * @param value - Candidate value.
 * @returns The team.
 */
function team(value: unknown): Team {
  const object = asObject(value);
  if (!Array.isArray(object.others) || object.others.length > MAX_TEAM_OTHERS) {
    badRequest('invalid_team');
  }
  return {
    enlPoc: teamContact(object.enlPoc),
    resPoc: teamContact(object.resPoc),
    others: object.others.map(teamContact),
  };
}

/**
 * Validates the shared letter sections.
 *
 * @param value - Candidate value.
 * @returns The sections.
 */
function letter(value: unknown): LetterSections {
  const object = asObject(value);
  return {
    aboutUs: localizedText(object.aboutUs, 'letter'),
    whatIsIngress: localizedText(object.whatIsIngress, 'letter'),
    whatIsMissionDay: localizedText(object.whatIsMissionDay, 'letter'),
    whyThisCity: localizedText(object.whyThisCity, 'letter'),
    closing: localizedText(object.closing, 'letter'),
  };
}

/**
 * Validates a request to create a Mission Day.
 *
 * @param body - Parsed JSON.
 * @returns The validated fields.
 */
export function parseMissionDayCreate(body: unknown): MissionDayCreateInput {
  const object = asObject(body);
  if (typeof object.slug !== 'string' || !isValidSlug(object.slug)) {
    badRequest('invalid_slug');
  }
  let ownerEmail: string | null = null;
  if (object.ownerEmail !== undefined && object.ownerEmail !== null && object.ownerEmail !== '') {
    ownerEmail = text(object.ownerEmail, 'owner_email').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+$/.test(ownerEmail)) {
      badRequest('invalid_owner_email');
    }
  }
  return {
    slug: object.slug,
    city: requiredText(object.city, 'city'),
    year: year(object.year),
    format: format(object.format),
    ownerEmail,
  };
}

/**
 * Validates an edit of a Mission Day. Absent fields stay unchanged.
 *
 * @param body - Parsed JSON.
 * @returns Only the fields that were sent.
 */
export function parseMissionDayPatch(body: unknown): MissionDayPatch {
  const object = asObject(body);
  const patch: MissionDayPatch = {};
  if (object.city !== undefined) patch.city = requiredText(object.city, 'city');
  if (object.year !== undefined) patch.year = year(object.year);
  if (object.date !== undefined) patch.date = optionalDate(object.date);
  if (object.format !== undefined) patch.format = format(object.format);
  if (object.status !== undefined) {
    if (!STATUSES.includes(object.status as MissionDayStatus)) {
      badRequest('invalid_status');
    }
    patch.status = object.status as MissionDayStatus;
  }
  if (object.team !== undefined) patch.team = team(object.team);
  if (object.letter !== undefined) patch.letter = letter(object.letter);
  if (object.myMapsUrl !== undefined) {
    patch.myMapsUrl = optionalWebUrl(object.myMapsUrl, 'my_maps_url');
  }
  return patch;
}

/**
 * Validates an edit of a mission. Absent fields stay unchanged.
 *
 * @param body - Parsed JSON.
 * @returns Only the fields that were sent.
 */
export function parseMissionPatch(body: unknown): MissionPatch {
  const object = asObject(body);
  const patch: MissionPatch = {};
  if (object.landmark !== undefined) patch.landmark = text(object.landmark, 'landmark');
  if (object.description !== undefined) {
    patch.description = localizedText(object.description, 'description');
  }
  if (object.notes !== undefined) patch.notes = text(object.notes, 'notes', MAX_LONG_TEXT);
  if (object.colour !== undefined) {
    if (typeof object.colour !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(object.colour)) {
      badRequest('invalid_colour');
    }
    patch.colour = object.colour;
  }
  return patch;
}

/**
 * Validates a coordinate.
 *
 * @param value - Candidate value.
 * @param limit - Largest absolute value allowed.
 * @returns The coordinate.
 */
function coordinate(value: unknown, limit: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) {
    badRequest('invalid_waypoints');
  }
  return value;
}

/**
 * Validates the complete, ordered list of portals of a mission. Positions
 * are assigned from the order received, so they cannot have gaps.
 *
 * @param body - Parsed JSON with a `waypoints` array.
 * @returns The waypoints.
 */
export function parseWaypoints(body: unknown): Waypoint[] {
  const list = asObject(body).waypoints;
  if (!Array.isArray(list) || list.length > MAX_STORED_WAYPOINTS) {
    badRequest('invalid_waypoints');
  }
  return list.map((item, position) => {
    const object = asObject(item);
    return {
      position,
      portalGuid:
        object.portalGuid === null || object.portalGuid === undefined
          ? null
          : text(object.portalGuid, 'waypoints'),
      title: requiredText(object.title, 'waypoints'),
      lat: coordinate(object.lat, 90),
      lng: coordinate(object.lng, 180),
      imageUrl: optionalWebUrl(object.imageUrl, 'waypoints'),
    };
  });
}

/**
 * Validates the identifiers that make up the final selection.
 *
 * @param body - Parsed JSON with a `missionIds` array, in recommended order.
 * @returns The identifiers.
 */
export function parseSelection(body: unknown): string[] {
  const ids = asObject(body).missionIds;
  if (
    !Array.isArray(ids) ||
    ids.some((id) => typeof id !== 'string') ||
    new Set(ids).size !== ids.length
  ) {
    badRequest('invalid_selection');
  }
  return ids as string[];
}

/**
 * Reads a crop rectangle from query parameters.
 *
 * @param query - Parameters `x`, `y` and `size`.
 * @returns The rectangle.
 */
export function parseCrop(query: Record<string, string | undefined>): CropRect {
  const [x, y, size] = [query.x, query.y, query.size].map(Number) as [number, number, number];
  if (![x, y, size].every(Number.isFinite) || x < 0 || y < 0 || size <= 0) {
    badRequest('invalid_crop');
  }
  return { x, y, size };
}
