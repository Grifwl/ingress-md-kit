/**
 * Client of the private API.
 */
import type { MissionFormat } from '../../shared/rules';
import type {
  CropRect,
  CurrentUser,
  Mission,
  MissionDay,
  MissionDayWithRole,
  Waypoint,
} from '../../shared/types';

const BASE = '/api/admin';

/**
 * A failed API call. `code` is the machine-readable reason the Worker
 * sent, which the interface translates.
 */
export class ApiError extends Error {
  /**
   * @param status - HTTP status of the response.
   * @param code - Error code from the response body.
   */
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

/**
 * Performs a request and decodes its JSON answer.
 *
 * @param path - Path under the API root.
 * @param init - Fetch options.
 * @returns The decoded body; undefined for an empty response.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, body?.error ?? 'generic');
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

/**
 * Builds fetch options for a JSON request.
 *
 * @param method - HTTP method.
 * @param body - Value to serialise.
 * @returns The fetch options.
 */
function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * Builds the API path of a Mission Day.
 *
 * @param slug - Mission Day slug.
 * @returns The path.
 */
function dayPath(slug: string): string {
  return `/mission-days/${encodeURIComponent(slug)}`;
}

/**
 * Builds the API path of a mission.
 *
 * @param slug - Mission Day slug.
 * @param missionId - Mission identifier.
 * @returns The path.
 */
function missionPath(slug: string, missionId: string): string {
  return `${dayPath(slug)}/missions/${encodeURIComponent(missionId)}`;
}

/**
 * Reads the signed-in organiser.
 *
 * @returns The current user.
 */
export function getMe(): Promise<CurrentUser> {
  return request('/me');
}

/**
 * Lists the requester's Mission Days.
 *
 * @returns The Mission Days.
 */
export function listMissionDays(): Promise<MissionDayWithRole[]> {
  return request('/mission-days');
}

/**
 * Creates a Mission Day.
 *
 * @param input - Initial fields.
 * @returns The slug that was created.
 */
export function createMissionDay(input: {
  slug: string;
  city: string;
  year: number;
  format: MissionFormat;
  ownerEmail: string;
}): Promise<{ slug: string }> {
  return request('/mission-days', json('POST', input));
}

/**
 * Reads a Mission Day.
 *
 * @param slug - Mission Day slug.
 * @returns The Mission Day.
 */
export function getMissionDay(slug: string): Promise<MissionDayWithRole> {
  return request(dayPath(slug));
}

/**
 * Saves changes to a Mission Day.
 *
 * @param slug - Mission Day slug.
 * @param patch - Fields to change.
 * @returns The updated Mission Day.
 */
export function updateMissionDay(
  slug: string,
  patch: Partial<MissionDay>,
): Promise<MissionDayWithRole> {
  return request(dayPath(slug), json('PATCH', patch));
}

/**
 * Deletes a Mission Day.
 *
 * @param slug - Mission Day slug.
 */
export function deleteMissionDay(slug: string): Promise<void> {
  return request(dayPath(slug), { method: 'DELETE' });
}

/**
 * Lists the candidate missions of a Mission Day.
 *
 * @param slug - Mission Day slug.
 * @returns The missions.
 */
export function listMissions(slug: string): Promise<Mission[]> {
  return request(`${dayPath(slug)}/missions`);
}

/**
 * Creates a candidate mission.
 *
 * @param slug - Mission Day slug.
 * @param landmark - Landmark or theme.
 * @returns The new mission.
 */
export function createMission(slug: string, landmark: string): Promise<Mission> {
  return request(`${dayPath(slug)}/missions`, json('POST', { landmark }));
}

/**
 * Saves the text fields of a mission.
 *
 * @param slug - Mission Day slug.
 * @param missionId - Mission identifier.
 * @param patch - Fields to change.
 * @returns The updated mission.
 */
export function updateMission(
  slug: string,
  missionId: string,
  patch: Pick<Partial<Mission>, 'landmark' | 'description' | 'notes' | 'colour'>,
): Promise<Mission> {
  return request(missionPath(slug, missionId), json('PATCH', patch));
}

/**
 * Deletes a mission.
 *
 * @param slug - Mission Day slug.
 * @param missionId - Mission identifier.
 */
export function deleteMission(slug: string, missionId: string): Promise<void> {
  return request(missionPath(slug, missionId), { method: 'DELETE' });
}

/**
 * Replaces the portals of a mission.
 *
 * @param slug - Mission Day slug.
 * @param missionId - Mission identifier.
 * @param waypoints - New list, in order.
 * @returns The updated mission.
 */
export function saveWaypoints(
  slug: string,
  missionId: string,
  waypoints: Waypoint[],
): Promise<Mission> {
  return request(`${missionPath(slug, missionId)}/waypoints`, json('PUT', { waypoints }));
}

/**
 * Stores a mission photo that the browser has already cropped.
 *
 * @param slug - Mission Day slug.
 * @param missionId - Mission identifier.
 * @param image - The 512×512 PNG.
 * @param crop - Region of the original that was used.
 * @returns The updated mission.
 */
export function uploadPhoto(
  slug: string,
  missionId: string,
  image: Blob,
  crop: CropRect,
): Promise<Mission> {
  const query = new URLSearchParams({
    x: String(crop.x),
    y: String(crop.y),
    size: String(crop.size),
  });
  return request(`${missionPath(slug, missionId)}/photo?${query}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: image,
  });
}

/**
 * Stores the final selection.
 *
 * @param slug - Mission Day slug.
 * @param missionIds - Selected missions, in recommended order.
 * @returns All the missions after the change.
 */
export function saveSelection(slug: string, missionIds: string[]): Promise<Mission[]> {
  return request(`${dayPath(slug)}/selection`, json('PUT', { missionIds }));
}

/**
 * Builds the address of a mission's photo. The version in the query makes
 * a replaced photo show up despite the long browser cache.
 *
 * @param slug - Mission Day slug.
 * @param mission - The mission.
 * @returns The image address.
 */
export function photoUrl(slug: string, mission: Pick<Mission, 'id' | 'photoVersion'>): string {
  return `${BASE}${missionPath(slug, mission.id)}/photo?v=${mission.photoVersion}`;
}
