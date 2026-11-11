/**
 * Private API, mounted at /api/admin and placed behind Cloudflare Access.
 *
 * Access decides who may enter the instance; these routes decide what
 * each person may touch. Every request under a Mission Day goes through
 * `requireMembership`, and a Mission Day the requester does not belong to
 * looks exactly like one that does not exist. The only exception is the
 * team of a Mission Day (see `members.ts`), which instance administrators
 * may manage without belonging to it.
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { BIOCARD_FONT_MAX_BYTES, BIOCARD_TEMPLATE_MAX_PX } from '../../shared/biocard';
import { mayShowLogo } from '../../shared/partners';
import {
  DOCUMENT_MAX_BYTES,
  IMAGE_MAX_BYTES,
  IMAGE_SIZE_PX,
  PHOTO_FULL_MAX_PX,
} from '../../shared/rules';
import type { BiocardFileKind, CurrentUser, MissionDay } from '../../shared/types';
import type { AppEnv } from '../env';
import { isInstanceAdmin, resolveEmail } from '../lib/access';
import {
  clearMissionDayFile,
  countOwnMissions,
  createMission,
  createMissionDay,
  deleteMission,
  deleteMissionDay,
  findMission,
  findMissionDayFile,
  findMissionDayFileVersion,
  findMissionDayForOrganiser,
  findFullPhotoKey,
  findPhotoKey,
  getInstanceSettings,
  getLetterDefaults,
  getUmmManifest,
  listMissionDaysForOrganiser,
  listMissions,
  replaceWaypoints,
  saveBiocardSettings,
  saveInstanceSettings,
  saveLetterDefaults,
  saveMissionDayFile,
  saveParticipantView,
  saveFullPhoto,
  savePhoto,
  saveSamplePartner,
  saveSelection,
  saveUmmManifest,
  slugExists,
  updateMission,
  updateMissionDay,
  type MissionDayFileKind,
} from '../lib/db';
import {
  parseBiocardSettings,
  parseCrop,
  parseInstanceSettings,
  parseLetterDefaults,
  parseMissionDayCreate,
  parseMissionDayPatch,
  parseMissionPatch,
  parseParticipantView,
  parseProfile,
  parseSelection,
  parseWaypoints,
} from '../lib/input';
import { getProfile, listAllMissionDays, saveProfile } from '../lib/members';
import { findPartner } from '../lib/partners';
import {
  detectFileType,
  detectFontType,
  readJpegSize,
  readPngInfo,
  type FileType,
  type FontType,
} from '../lib/png';
import {
  PRIVATE_IMMUTABLE,
  assertOwner,
  deleteObjects,
  jsonBody,
  missionDayPrefix,
  readUpload,
  serveObject,
  type AppContext,
} from './helpers';
import members from './members';
import partners from './partners';

/**
 * Refuses writes coming from another site. The Access session is a cookie
 * the browser attaches by itself, so without this check a foreign page
 * could submit changes on behalf of a signed-in organiser.
 *
 * @param c - Request context.
 * @param next - Next handler.
 */
const requireSameOrigin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const origin = c.req.header('Origin');
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && origin !== undefined) {
    let host: string | null = null;
    try {
      host = new URL(origin).host;
    } catch {
      // An opaque origin such as "null" cannot be same-site.
    }
    if (host !== new URL(c.req.url).host) {
      throw new HTTPException(403, { message: 'forbidden_origin' });
    }
  }
  await next();
};

/**
 * Authenticates the request.
 *
 * @param c - Request context.
 * @param next - Next handler.
 */
const requireIdentity: MiddlewareHandler<AppEnv> = async (c, next) => {
  const email = await resolveEmail(c.req.raw.headers, c.env);
  if (email === null) {
    throw new HTTPException(401, { message: 'unauthenticated' });
  }
  c.set('email', email);
  await next();
};

/**
 * Loads the Mission Day named in the path and checks membership.
 *
 * @param c - Request context.
 * @param next - Next handler.
 */
const requireMembership: MiddlewareHandler<AppEnv> = async (c, next) => {
  const found = await findMissionDayForOrganiser(
    c.env.DB,
    c.req.param('slug') ?? '',
    c.get('email'),
  );
  if (found === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  const { role, ...missionDay } = found;
  c.set('missionDay', missionDay as MissionDay);
  c.set('role', role);
  await next();
};

/**
 * Stops the request unless the requester administers the instance.
 *
 * @param c - Request context.
 */
function assertInstanceAdmin(c: AppContext): void {
  if (!isInstanceAdmin(c.get('email'), c.env)) {
    throw new HTTPException(403, { message: 'instance_admin_required' });
  }
}

/**
 * Loads the mission named in the path, within the current Mission Day.
 *
 * @param c - Request context.
 * @returns The mission.
 */
async function requireMission(c: AppContext) {
  const mission = await findMission(
    c.env.DB,
    c.get('missionDay').id,
    c.req.param('missionId') ?? '',
  );
  if (mission === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return mission;
}

/**
 * Stores a new version of an image of the Mission Day, and answers with
 * the Mission Day after the change.
 *
 * @param c - Request context.
 * @param kind - Which image.
 * @param bytes - Contents of the file.
 * @param type - Its verified type.
 * @param currentVersion - Version being replaced.
 * @returns The response.
 */
async function storeMissionDayFile(
  c: AppContext,
  kind: MissionDayFileKind,
  bytes: ArrayBuffer,
  type: FileType | FontType,
  currentVersion: number,
): Promise<Response> {
  const { id } = c.get('missionDay');
  const previous = await findMissionDayFile(c.env.DB, id, kind);
  const version = currentVersion + 1;
  const key = `${missionDayPrefix(id)}${kind}-${version}`;
  await c.env.BUCKET.put(key, bytes, { httpMetadata: { contentType: type } });
  await saveMissionDayFile(c.env.DB, id, kind, key, type, version);
  if (previous !== null) {
    await c.env.BUCKET.delete(previous.key);
  }
  return c.json(
    await findMissionDayForOrganiser(c.env.DB, c.get('missionDay').slug, c.get('email')),
  );
}

/**
 * Answers with an image of the Mission Day.
 *
 * @param c - Request context.
 * @param kind - Which image.
 * @returns The response.
 */
async function serveMissionDayFile(c: AppContext, kind: MissionDayFileKind): Promise<Response> {
  const file = await findMissionDayFile(c.env.DB, c.get('missionDay').id, kind);
  if (file === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return serveObject(c, file.key, file.type, { 'Cache-Control': PRIVATE_IMMUTABLE });
}

/** Where each Biocard file is kept among the files of a Mission Day. */
const BIOCARD_FILES: Record<BiocardFileKind, MissionDayFileKind> = {
  front: 'biocard_front',
  back: 'biocard_back',
  photo: 'biocard_photo',
  font: 'biocard_font',
};

/**
 * Reads which Biocard file a path names.
 *
 * @param c - Request context.
 * @returns The kind of file.
 */
function requireBiocardFile(c: AppContext): BiocardFileKind {
  const file = c.req.param('file') ?? '';
  if (!Object.hasOwn(BIOCARD_FILES, file)) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return file as BiocardFileKind;
}

/**
 * Checks an uploaded Biocard file. The front must be a PNG with
 * transparency, since the photo shows through it; the back can be any
 * picture; templates have a bounded size so that composing them never
 * exhausts a browser. Proportions are only warned about, in the browser.
 *
 * @param kind - Which file.
 * @param bytes - Contents of the file.
 * @returns Its verified type.
 */
function checkBiocardFile(kind: BiocardFileKind, bytes: ArrayBuffer): FileType | FontType {
  if (kind === 'font') {
    const fontType = detectFontType(bytes);
    if (fontType === null || bytes.byteLength > BIOCARD_FONT_MAX_BYTES) {
      throw new HTTPException(415, { message: 'invalid_font' });
    }
    return fontType;
  }
  const type = detectFileType(bytes);
  const info = readPngInfo(bytes);
  const tooLarge =
    info !== null &&
    (info.width > BIOCARD_TEMPLATE_MAX_PX || info.height > BIOCARD_TEMPLATE_MAX_PX);
  if (kind === 'front' && (info === null || !info.hasAlpha || tooLarge)) {
    throw new HTTPException(415, { message: 'invalid_biocard_front' });
  }
  if (type === null || type === 'application/pdf' || tooLarge) {
    throw new HTTPException(415, { message: 'invalid_file' });
  }
  return type;
}

/**
 * Removes stored objects that are no longer referenced.
 *
 * @param c - Request context.
 * @param keys - Their R2 keys; null entries are skipped.
 */
async function removeStored(c: AppContext, keys: readonly (string | null)[]): Promise<void> {
  const present = keys.filter((key): key is string => key !== null);
  if (present.length > 0) {
    await c.env.BUCKET.delete(present);
  }
}

const scoped = new Hono<AppEnv>();
scoped.use('*', requireMembership);

scoped.route('/partners', partners);

scoped.put('/default-overlay', async (c) => {
  const bytes = await readUpload(c, IMAGE_MAX_BYTES);
  const info = readPngInfo(bytes);
  if (
    info === null ||
    info.width !== IMAGE_SIZE_PX ||
    info.height !== IMAGE_SIZE_PX ||
    !info.hasAlpha
  ) {
    throw new HTTPException(415, { message: 'invalid_overlay' });
  }
  const version = c.get('missionDay').defaultOverlayVersion;
  return storeMissionDayFile(c, 'default_overlay', bytes, 'image/png', version);
});

scoped.get('/default-overlay', (c) => serveMissionDayFile(c, 'default_overlay'));

scoped.put('/map-screenshot', async (c) => {
  const bytes = await readUpload(c, DOCUMENT_MAX_BYTES);
  const type = detectFileType(bytes);
  if (type === null || type === 'application/pdf') {
    throw new HTTPException(415, { message: 'invalid_file' });
  }
  const version = c.get('missionDay').mapScreenshotVersion;
  return storeMissionDayFile(c, 'map_screenshot', bytes, type, version);
});

scoped.get('/map-screenshot', (c) => serveMissionDayFile(c, 'map_screenshot'));

scoped.put('/biocard', async (c) => {
  const missionDay = c.get('missionDay');
  const settings = parseBiocardSettings(await jsonBody(c));
  await saveBiocardSettings(c.env.DB, missionDay.id, settings);
  return c.json({ ...missionDay, biocard: settings, role: c.get('role') });
});

scoped.put('/biocard/:file', async (c) => {
  const kind = requireBiocardFile(c);
  const bytes = await readUpload(c, kind === 'font' ? BIOCARD_FONT_MAX_BYTES : DOCUMENT_MAX_BYTES);
  const type = checkBiocardFile(kind, bytes);
  const column = BIOCARD_FILES[kind];
  const version = await findMissionDayFileVersion(c.env.DB, c.get('missionDay').id, column);
  return storeMissionDayFile(c, column, bytes, type, version);
});

scoped.get('/biocard/:file', (c) => serveMissionDayFile(c, BIOCARD_FILES[requireBiocardFile(c)]));

// Only the font can be removed, to go back to the default one; the other
// files are needed by every card and are replaced rather than removed.
scoped.delete('/biocard/font', async (c) => {
  const { id, slug } = c.get('missionDay');
  const file = await findMissionDayFile(c.env.DB, id, 'biocard_font');
  await clearMissionDayFile(c.env.DB, id, 'biocard_font');
  if (file !== null) {
    await c.env.BUCKET.delete(file.key);
  }
  return c.json(await findMissionDayForOrganiser(c.env.DB, slug, c.get('email')));
});

// The browser composes the picture, since the Worker never processes
// images; from here on it is an ordinary file served at a fixed address.
scoped.put('/sample', async (c) => {
  const missionDay = c.get('missionDay');
  const partnerId = c.req.query('partnerId') ?? '';
  if (partnerId !== '') {
    const partner = await findPartner(c.env.DB, missionDay.id, partnerId);
    if (partner === null) {
      throw new HTTPException(404, { message: 'not_found' });
    }
    if (!mayShowLogo(partner)) {
      throw new HTTPException(403, { message: 'partner_not_approved' });
    }
  }
  const bytes = await readUpload(c, IMAGE_MAX_BYTES);
  const info = readPngInfo(bytes);
  if (info === null || info.width !== IMAGE_SIZE_PX || info.height !== IMAGE_SIZE_PX) {
    throw new HTTPException(415, { message: 'invalid_photo' });
  }
  await saveSamplePartner(c.env.DB, missionDay.id, partnerId === '' ? null : partnerId);
  return storeMissionDayFile(c, 'sample', bytes, 'image/png', missionDay.sampleVersion);
});

// Publishing the participant view is an owner's decision, since it opens
// the Mission Day to anyone holding the address.
scoped.put('/participant-view', async (c) => {
  assertOwner(c);
  const missionDay = c.get('missionDay');
  const { enabled, partnerId } = parseParticipantView(await jsonBody(c));
  if (partnerId !== null) {
    const partner = await findPartner(c.env.DB, missionDay.id, partnerId);
    if (partner === null) {
      throw new HTTPException(404, { message: 'not_found' });
    }
    if (!mayShowLogo(partner)) {
      throw new HTTPException(403, { message: 'partner_not_approved' });
    }
    if (!partner.hasOverlay) {
      throw new HTTPException(409, { message: 'partner_without_overlay' });
    }
  }
  await saveParticipantView(c.env.DB, missionDay.id, enabled, partnerId);
  return c.json({
    ...missionDay,
    participantViewEnabled: enabled,
    participantPartnerId: partnerId,
    role: c.get('role'),
  });
});

scoped.get('/', (c) => c.json({ ...c.get('missionDay'), role: c.get('role') }));

scoped.patch('/', async (c) => {
  const patch = parseMissionDayPatch(await jsonBody(c));
  await updateMissionDay(c.env.DB, c.get('missionDay'), patch);
  return c.json({ ...c.get('missionDay'), ...patch, role: c.get('role') });
});

scoped.delete('/', async (c) => {
  assertOwner(c);
  const { id } = c.get('missionDay');
  await deleteMissionDay(c.env.DB, id);
  await deleteObjects(c.env.BUCKET, missionDayPrefix(id));
  return c.body(null, 204);
});

scoped.get('/missions', async (c) => c.json(await listMissions(c.env.DB, c.get('missionDay').id)));

scoped.post('/missions', async (c) => {
  const { id: missionDayId } = c.get('missionDay');
  const patch = parseMissionPatch(await jsonBody(c));
  const id = await createMission(c.env.DB, missionDayId, patch);
  return c.json(await findMission(c.env.DB, missionDayId, id), 201);
});

// The set is replaced as a whole because order and membership change
// together when a mission is dragged in, out or across the list.
scoped.put('/selection', async (c) => {
  const { id: missionDayId } = c.get('missionDay');
  const missionIds = parseSelection(await jsonBody(c));
  if ((await countOwnMissions(c.env.DB, missionDayId, missionIds)) !== missionIds.length) {
    throw new HTTPException(400, { message: 'invalid_selection' });
  }
  await saveSelection(c.env.DB, missionDayId, missionIds);
  return c.json(await listMissions(c.env.DB, missionDayId));
});

scoped.get('/umm-manifest', async (c) =>
  c.json({ missionIds: await getUmmManifest(c.env.DB, c.get('missionDay').id) }),
);

scoped.put('/umm-manifest', async (c) => {
  const { id: missionDayId } = c.get('missionDay');
  const missionIds = parseSelection(await jsonBody(c));
  if ((await countOwnMissions(c.env.DB, missionDayId, missionIds)) !== missionIds.length) {
    throw new HTTPException(400, { message: 'invalid_selection' });
  }
  await saveUmmManifest(c.env.DB, missionDayId, missionIds);
  return c.json({ missionIds });
});

scoped.get('/missions/:missionId', async (c) => c.json(await requireMission(c)));

scoped.patch('/missions/:missionId', async (c) => {
  const mission = await requireMission(c);
  const patch = parseMissionPatch(await jsonBody(c));
  await updateMission(c.env.DB, mission, patch);
  return c.json({ ...mission, ...patch });
});

scoped.delete('/missions/:missionId', async (c) => {
  assertOwner(c);
  const mission = await requireMission(c);
  const keys = await Promise.all([
    findPhotoKey(c.env.DB, mission.missionDayId, mission.id),
    findFullPhotoKey(c.env.DB, mission.missionDayId, mission.id),
  ]);
  await deleteMission(c.env.DB, mission.missionDayId, mission.id);
  await removeStored(c, keys);
  return c.body(null, 204);
});

scoped.put('/missions/:missionId/waypoints', async (c) => {
  const mission = await requireMission(c);
  const waypoints = parseWaypoints(await jsonBody(c));
  await replaceWaypoints(c.env.DB, mission.id, waypoints);
  return c.json({ ...mission, waypoints });
});

scoped.put('/missions/:missionId/photo', async (c) => {
  const mission = await requireMission(c);
  const crop = parseCrop(c.req.query());

  const bytes = await readUpload(c, IMAGE_MAX_BYTES);
  const info = readPngInfo(bytes);
  if (info === null || info.width !== IMAGE_SIZE_PX || info.height !== IMAGE_SIZE_PX) {
    throw new HTTPException(415, { message: 'invalid_photo' });
  }

  // A new key per version lets browsers cache photos for good, and the
  // old object is removed only once the database points at the new one.
  const previousKeys = await Promise.all([
    findPhotoKey(c.env.DB, mission.missionDayId, mission.id),
    findFullPhotoKey(c.env.DB, mission.missionDayId, mission.id),
  ]);
  const version = mission.photoVersion + 1;
  const key = `${missionDayPrefix(mission.missionDayId)}missions/${mission.id}/photo-${version}.png`;
  await c.env.BUCKET.put(key, bytes, { httpMetadata: { contentType: 'image/png' } });
  await savePhoto(c.env.DB, mission, key, version, crop);
  await removeStored(c, previousKeys);
  return c.json({ ...mission, hasPhoto: true, photoVersion: version, crop, photoFullSize: null });
});

// The full-quality copy of the photo, for printing Biocards. The browser
// sends it right after the 512 px PNG, naming the version it belongs to,
// so a copy can never end up next to a different photo. It must be a
// square JPEG larger than 512 px: anything smaller adds nothing.
scoped.put('/missions/:missionId/photo/full', async (c) => {
  const mission = await requireMission(c);
  if (!mission.hasPhoto || c.req.query('version') !== String(mission.photoVersion)) {
    throw new HTTPException(409, { message: 'photo_changed' });
  }
  const bytes = await readUpload(c, DOCUMENT_MAX_BYTES);
  const size = readJpegSize(bytes);
  if (
    size === null ||
    size.width !== size.height ||
    size.width <= IMAGE_SIZE_PX ||
    size.width > PHOTO_FULL_MAX_PX
  ) {
    throw new HTTPException(415, { message: 'invalid_photo' });
  }
  const previousKey = await findFullPhotoKey(c.env.DB, mission.missionDayId, mission.id);
  const prefix = `${missionDayPrefix(mission.missionDayId)}missions/${mission.id}`;
  const key = `${prefix}/photo-${mission.photoVersion}-full.jpg`;
  await c.env.BUCKET.put(key, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
  await saveFullPhoto(c.env.DB, mission, key, size.width);
  if (previousKey !== null && previousKey !== key) {
    await c.env.BUCKET.delete(previousKey);
  }
  return c.json({ ...mission, photoFullSize: size.width });
});

scoped.get('/missions/:missionId/photo/full', async (c) => {
  const mission = await requireMission(c);
  const key = await findFullPhotoKey(c.env.DB, mission.missionDayId, mission.id);
  if (key === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return serveObject(c, key, 'image/jpeg', { 'Cache-Control': PRIVATE_IMMUTABLE });
});

scoped.get('/missions/:missionId/photo', async (c) => {
  const mission = await requireMission(c);
  const key = await findPhotoKey(c.env.DB, mission.missionDayId, mission.id);
  const object = key === null ? null : await c.env.BUCKET.get(key);
  if (object === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return c.body(object.body, 200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'private, max-age=31536000, immutable',
  });
});

const admin = new Hono<AppEnv>();
admin.use('*', requireSameOrigin, requireIdentity);

/**
 * Builds the description of the signed-in organiser.
 *
 * @param c - Request context.
 * @returns Their profile and instance-wide rights.
 */
async function currentUser(c: AppContext): Promise<CurrentUser> {
  const email = c.get('email');
  return { ...(await getProfile(c.env.DB, email)), isInstanceAdmin: isInstanceAdmin(email, c.env) };
}

admin.get('/me', async (c) => c.json(await currentUser(c)));

// Anyone signed in may keep a profile, even before joining a team, so that
// owners see a codename rather than a bare email once they add them.
admin.patch('/me', async (c) => {
  const { codename, faction } = parseProfile(await jsonBody(c));
  await saveProfile(c.env.DB, c.get('email'), codename, faction);
  return c.json(await currentUser(c));
});

admin.get('/mission-days', async (c) =>
  c.json(await listMissionDaysForOrganiser(c.env.DB, c.get('email'))),
);

admin.get('/instance/mission-days', async (c) => {
  assertInstanceAdmin(c);
  return c.json(await listAllMissionDays(c.env.DB, c.get('email')));
});

admin.get('/instance/settings', async (c) => {
  assertInstanceAdmin(c);
  return c.json(await getInstanceSettings(c.env.DB));
});

admin.put('/instance/settings', async (c) => {
  assertInstanceAdmin(c);
  const settings = parseInstanceSettings(await jsonBody(c));
  await saveInstanceSettings(c.env.DB, settings);
  return c.json(settings);
});

admin.get('/letter-defaults', async (c) => {
  assertInstanceAdmin(c);
  return c.json(await getLetterDefaults(c.env.DB));
});

admin.put('/letter-defaults', async (c) => {
  assertInstanceAdmin(c);
  const letter = parseLetterDefaults(await jsonBody(c));
  await saveLetterDefaults(c.env.DB, letter);
  return c.json(letter);
});

admin.post('/mission-days', async (c) => {
  assertInstanceAdmin(c);
  const email = c.get('email');
  const input = parseMissionDayCreate(await jsonBody(c));
  if (await slugExists(c.env.DB, input.slug)) {
    throw new HTTPException(409, { message: 'slug_taken' });
  }
  const ownerEmail = input.ownerEmail ?? email;
  await createMissionDay(c.env.DB, input, ownerEmail);
  return c.json({ slug: input.slug }, 201);
});

// The team routes come first: they answer instance administrators who are
// not members, whom the membership check of the other routes would stop.
admin.route('/mission-days/:slug/members', members);
admin.route('/mission-days/:slug', scoped);

export default admin;
