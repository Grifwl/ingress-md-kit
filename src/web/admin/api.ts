/**
 * Client of the private API.
 */
import type { PartnerStatus } from '../../shared/partners';
import type { Language, MissionFormat } from '../../shared/rules';
import type {
  CropRect,
  CurrentUser,
  Faction,
  InstanceMissionDay,
  LetterSections,
  Member,
  MembershipRole,
  Mission,
  MissionDay,
  MissionDayWithRole,
  Partner,
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
 * Saves the signed-in organiser's own profile.
 *
 * @param profile - Codename and faction; null faction means none.
 * @returns The current user after the change.
 */
export function saveProfile(profile: {
  codename: string;
  faction: Faction | null;
}): Promise<CurrentUser> {
  return request('/me', json('PATCH', profile));
}

/**
 * Lists every Mission Day of the instance; for instance administrators.
 *
 * @returns The Mission Days, with the requester's role in each.
 */
export function listInstanceMissionDays(): Promise<InstanceMissionDay[]> {
  return request('/instance/mission-days');
}

/**
 * Builds the API path of a team member.
 *
 * @param slug - Mission Day slug.
 * @param email - Member's email.
 * @returns The path.
 */
function memberPath(slug: string, email: string): string {
  return `${dayPath(slug)}/members/${encodeURIComponent(email)}`;
}

/**
 * Lists the team of a Mission Day.
 *
 * @param slug - Mission Day slug.
 * @returns The members, owners first.
 */
export function listMembers(slug: string): Promise<Member[]> {
  return request(`${dayPath(slug)}/members`);
}

/**
 * Adds someone to the team of a Mission Day.
 *
 * @param slug - Mission Day slug.
 * @param email - Email they sign in with.
 * @param role - Their role.
 * @returns The team after the change.
 */
export function addMember(slug: string, email: string, role: MembershipRole): Promise<Member[]> {
  return request(`${dayPath(slug)}/members`, json('POST', { email, role }));
}

/**
 * Changes the role of a team member.
 *
 * @param slug - Mission Day slug.
 * @param email - Member's email.
 * @param role - New role.
 * @returns The team after the change.
 */
export function setMemberRole(
  slug: string,
  email: string,
  role: MembershipRole,
): Promise<Member[]> {
  return request(memberPath(slug, email), json('PATCH', { role }));
}

/**
 * Removes someone from a team, or lets the requester leave it.
 *
 * @param slug - Mission Day slug.
 * @param email - Member's email.
 * @returns The team after the change.
 */
export function removeMember(slug: string, email: string): Promise<Member[]> {
  return request(memberPath(slug, email), { method: 'DELETE' });
}

/**
 * Reads the letter texts that new Mission Days start from.
 *
 * @returns The default sections.
 */
export function getLetterDefaults(): Promise<LetterSections> {
  return request('/letter-defaults');
}

/**
 * Saves the letter texts that new Mission Days start from.
 *
 * @param letter - The default sections.
 * @returns The saved sections.
 */
export function saveLetterDefaults(letter: LetterSections): Promise<LetterSections> {
  return request('/letter-defaults', json('PUT', letter));
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
 * Reads which mission occupied each position of the last UMM export.
 *
 * @param slug - Mission Day slug.
 * @returns The mission identifiers by position.
 */
export async function getUmmManifest(slug: string): Promise<string[]> {
  const body = await request<{ missionIds: string[] }>(`${dayPath(slug)}/umm-manifest`);
  return body.missionIds;
}

/**
 * Remembers the positions of an exported UMM file.
 *
 * @param slug - Mission Day slug.
 * @param missionIds - Mission identifiers by position.
 */
export async function saveUmmManifest(slug: string, missionIds: string[]): Promise<void> {
  await request(`${dayPath(slug)}/umm-manifest`, json('PUT', { missionIds }));
}

/**
 * Stores the picture sent with the application, already composed.
 *
 * @param slug - Mission Day slug.
 * @param image - The 512×512 PNG.
 * @param partnerId - Partner it shows, or null for the default overlay.
 * @returns The updated Mission Day.
 */
export function uploadSample(
  slug: string,
  image: Blob,
  partnerId: string | null,
): Promise<MissionDayWithRole> {
  const query = partnerId === null ? '' : `?partnerId=${encodeURIComponent(partnerId)}`;
  return request(`${dayPath(slug)}/sample${query}`, { method: 'PUT', body: image });
}

/**
 * Builds the API path of a partner.
 *
 * @param slug - Mission Day slug.
 * @param partnerId - Partner identifier.
 * @returns The path.
 */
function partnerPath(slug: string, partnerId: string): string {
  return `${dayPath(slug)}/partners/${encodeURIComponent(partnerId)}`;
}

/**
 * Lists the partners of a Mission Day.
 *
 * @param slug - Mission Day slug.
 * @returns The partners.
 */
export function listPartners(slug: string): Promise<Partner[]> {
  return request(`${dayPath(slug)}/partners`);
}

/**
 * Creates a partner.
 *
 * @param slug - Mission Day slug.
 * @param name - Name of the entity.
 * @param letterLanguage - Language of its letter.
 * @returns The new partner.
 */
export function createPartner(
  slug: string,
  name: string,
  letterLanguage: Language,
): Promise<Partner> {
  return request(`${dayPath(slug)}/partners`, json('POST', { name, letterLanguage }));
}

/**
 * Saves the fields of a partner.
 *
 * @param slug - Mission Day slug.
 * @param partnerId - Partner identifier.
 * @param patch - Fields to change.
 * @returns The updated partner.
 */
export function updatePartner(
  slug: string,
  partnerId: string,
  patch: Partial<
    Pick<
      Partner,
      | 'name'
      | 'kind'
      | 'contactPerson'
      | 'contactEmail'
      | 'whyYou'
      | 'logoRequest'
      | 'letterLanguage'
    >
  >,
): Promise<Partner> {
  return request(partnerPath(slug, partnerId), json('PATCH', patch));
}

/**
 * Deletes a partner.
 *
 * @param slug - Mission Day slug.
 * @param partnerId - Partner identifier.
 */
export function deletePartner(slug: string, partnerId: string): Promise<void> {
  return request(partnerPath(slug, partnerId), { method: 'DELETE' });
}

/**
 * Records a change in the conversation with a partner.
 *
 * @param slug - Mission Day slug.
 * @param partnerId - Partner identifier.
 * @param status - New status.
 * @param note - Free comment.
 * @returns The updated partner.
 */
export function changePartnerStatus(
  slug: string,
  partnerId: string,
  status: PartnerStatus,
  note: string,
): Promise<Partner> {
  return request(`${partnerPath(slug, partnerId)}/status`, json('POST', { status, note }));
}

/**
 * Replaces the secret link of a proposal, revoking the previous one.
 *
 * @param slug - Mission Day slug.
 * @param partnerId - Partner identifier.
 * @returns The updated partner.
 */
export function regenerateProposalToken(slug: string, partnerId: string): Promise<Partner> {
  return request(`${partnerPath(slug, partnerId)}/token`, { method: 'POST' });
}

/** The files a partner can have. */
export type PartnerFileKind = 'logo' | 'overlay' | 'approval';

/**
 * Uploads a file of a partner.
 *
 * @param slug - Mission Day slug.
 * @param partnerId - Partner identifier.
 * @param kind - Which file.
 * @param file - The file.
 * @returns The updated partner.
 */
export function uploadPartnerFile(
  slug: string,
  partnerId: string,
  kind: PartnerFileKind,
  file: File,
): Promise<Partner> {
  const query = kind === 'approval' ? `?name=${encodeURIComponent(file.name)}` : '';
  return request(`${partnerPath(slug, partnerId)}/${kind}${query}`, { method: 'PUT', body: file });
}

/**
 * Builds the address of a partner's file.
 *
 * @param slug - Mission Day slug.
 * @param partner - The partner.
 * @param kind - Which file.
 * @returns The address.
 */
export function partnerFileUrl(slug: string, partner: Partner, kind: PartnerFileKind): string {
  const version = {
    logo: partner.logoVersion,
    overlay: partner.overlayVersion,
    approval: partner.approvalVersion,
  }[kind];
  return `${BASE}${partnerPath(slug, partner.id)}/${kind}?v=${version}`;
}

/**
 * Uploads the default overlay of a Mission Day.
 *
 * @param slug - Mission Day slug.
 * @param file - The 512×512 PNG.
 * @returns The updated Mission Day.
 */
export function uploadDefaultOverlay(slug: string, file: File): Promise<MissionDayWithRole> {
  return request(`${dayPath(slug)}/default-overlay`, { method: 'PUT', body: file });
}

/**
 * Uploads the map screenshot of a Mission Day.
 *
 * @param slug - Mission Day slug.
 * @param file - The image.
 * @returns The updated Mission Day.
 */
export function uploadMapScreenshot(slug: string, file: File): Promise<MissionDayWithRole> {
  return request(`${dayPath(slug)}/map-screenshot`, { method: 'PUT', body: file });
}

/**
 * Builds the address of a Mission Day's default overlay.
 *
 * @param missionDay - The Mission Day.
 * @returns The address, or null when it has none.
 */
export function defaultOverlayUrl(missionDay: MissionDay): string | null {
  return missionDay.hasDefaultOverlay
    ? `${BASE}${dayPath(missionDay.slug)}/default-overlay?v=${missionDay.defaultOverlayVersion}`
    : null;
}

/**
 * Builds the address of a Mission Day's map screenshot.
 *
 * @param missionDay - The Mission Day.
 * @returns The address, or null when it has none.
 */
export function mapScreenshotUrl(missionDay: MissionDay): string | null {
  return missionDay.hasMapScreenshot
    ? `${BASE}${dayPath(missionDay.slug)}/map-screenshot?v=${missionDay.mapScreenshotVersion}`
    : null;
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
