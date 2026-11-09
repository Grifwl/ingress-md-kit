/**
 * Private API, mounted at /api/admin and placed behind Cloudflare Access.
 *
 * Access decides who may enter the instance; these routes decide what
 * each person may touch. Every request under a Mission Day goes through
 * `requireMembership`, and a Mission Day the requester does not belong to
 * looks exactly like one that does not exist.
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { DOCUMENT_MAX_BYTES, IMAGE_MAX_BYTES, IMAGE_SIZE_PX } from '../../shared/rules';
import type { CurrentUser, MissionDay } from '../../shared/types';
import type { AppEnv } from '../env';
import { isInstanceAdmin, resolveEmail } from '../lib/access';
import {
  countOwnMissions,
  createMission,
  createMissionDay,
  deleteMission,
  deleteMissionDay,
  findMission,
  findMissionDayFile,
  findMissionDayForOrganiser,
  findPhotoKey,
  getLetterDefaults,
  listMissionDaysForOrganiser,
  listMissions,
  replaceWaypoints,
  saveLetterDefaults,
  saveMissionDayFile,
  savePhoto,
  saveSelection,
  slugExists,
  updateMission,
  updateMissionDay,
  type MissionDayFileKind,
} from '../lib/db';
import {
  parseCrop,
  parseLetterDefaults,
  parseMissionDayCreate,
  parseMissionDayPatch,
  parseMissionPatch,
  parseSelection,
  parseWaypoints,
} from '../lib/input';
import { detectFileType, readPngInfo, type FileType } from '../lib/png';
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
  type: FileType,
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
  const photoKey = await findPhotoKey(c.env.DB, mission.missionDayId, mission.id);
  await deleteMission(c.env.DB, mission.missionDayId, mission.id);
  if (photoKey !== null) {
    await c.env.BUCKET.delete(photoKey);
  }
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
  const previousKey = await findPhotoKey(c.env.DB, mission.missionDayId, mission.id);
  const version = mission.photoVersion + 1;
  const key = `${missionDayPrefix(mission.missionDayId)}missions/${mission.id}/photo-${version}.png`;
  await c.env.BUCKET.put(key, bytes, { httpMetadata: { contentType: 'image/png' } });
  await savePhoto(c.env.DB, mission, key, version, crop);
  if (previousKey !== null) {
    await c.env.BUCKET.delete(previousKey);
  }
  return c.json({ ...mission, hasPhoto: true, photoVersion: version, crop });
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

admin.get('/me', (c) => {
  const email = c.get('email');
  const user: CurrentUser = { email, isInstanceAdmin: isInstanceAdmin(email, c.env) };
  return c.json(user);
});

admin.get('/mission-days', async (c) =>
  c.json(await listMissionDaysForOrganiser(c.env.DB, c.get('email'))),
);

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

admin.route('/mission-days/:slug', scoped);

export default admin;
