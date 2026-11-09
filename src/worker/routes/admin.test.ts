import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { IMAGE_MAX_BYTES, IMAGE_SIZE_PX } from '../../shared/rules';
import type { Mission } from '../../shared/types';
import app from '../app';
import type { Env } from '../env';

const ADMIN = 'admin@example.org';
const OWNER = 'owner@example.org';
const EDITOR = 'editor@example.org';
const STRANGER = 'stranger@example.org';

/** Options of a test request. */
interface CallOptions {
  method?: string;
  body?: unknown;
  rawBody?: BodyInit;
  headers?: Record<string, string>;
  as?: string;
}

/**
 * Sends a request to the admin API as a given organiser, using the
 * development bypass to pick the identity.
 *
 * @param path - Path under /api/admin.
 * @param options - Method, body, headers and identity.
 * @returns The response.
 */
async function call(path: string, options: CallOptions = {}): Promise<Response> {
  const testEnv = {
    ...env,
    ENVIRONMENT: 'dev',
    DEV_USER_EMAIL: options.as ?? OWNER,
    INSTANCE_ADMINS: ADMIN,
  } as Env;
  const request = new Request(`https://md.example.org/api/admin${path}`, {
    method: options.method ?? 'GET',
    headers: options.headers,
    body:
      options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
  return app.fetch(request, testEnv);
}

/**
 * Creates a Mission Day owned by `OWNER`, with `EDITOR` as a member.
 *
 * @param slug - Slug to use.
 */
async function createMissionDay(slug: string): Promise<void> {
  const response = await call('/mission-days', {
    method: 'POST',
    as: ADMIN,
    body: { slug, city: 'Example City', year: 2027, format: 'lite6', ownerEmail: OWNER },
  });
  expect(response.status).toBe(201);
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO organisers (email) VALUES (?)').bind(EDITOR),
    env.DB.prepare(
      `INSERT INTO memberships (mission_day_id, organiser_email, role)
       SELECT id, ?, 'editor' FROM mission_days WHERE slug = ?`,
    ).bind(EDITOR, slug),
  ]);
}

/**
 * Creates a mission.
 *
 * @param slug - Mission Day slug.
 * @param landmark - Landmark of the mission.
 * @returns The new mission.
 */
async function createMission(slug: string, landmark = 'Old Bridge'): Promise<Mission> {
  const response = await call(`/mission-days/${slug}/missions`, {
    method: 'POST',
    body: { landmark, description: { en: 'A walk.' } },
  });
  expect(response.status).toBe(201);
  return response.json();
}

/**
 * Builds the first bytes of a PNG with the given dimensions, which is all
 * the Worker inspects.
 *
 * @param size - Width and height.
 * @returns The bytes.
 */
function pngHeader(size: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, size);
  view.setUint32(20, size);
  return bytes;
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM mission_days'),
    env.DB.prepare('DELETE FROM organisers'),
    env.DB.prepare(`UPDATE instance_settings SET letter_defaults_json = '{}'`),
  ]);
  await createMissionDay('example-2027');
});

describe('authentication and authorisation', () => {
  it('rejects anonymous requests outside the dev environment', async () => {
    const response = await app.fetch(new Request('https://md.example.org/api/admin/me'), {
      ...env,
      ENVIRONMENT: 'production',
      INSTANCE_ADMINS: ADMIN,
    } as Env);
    expect(response.status).toBe(401);
  });

  it('reports who is signed in', async () => {
    expect(await (await call('/me', { as: ADMIN })).json()).toEqual({
      email: ADMIN,
      isInstanceAdmin: true,
    });
    expect(await (await call('/me', { as: OWNER })).json()).toEqual({
      email: OWNER,
      isInstanceAdmin: false,
    });
  });

  it('lets only instance admins create Mission Days', async () => {
    const response = await call('/mission-days', {
      method: 'POST',
      as: OWNER,
      body: { slug: 'other-2028', city: 'Other', year: 2028, format: 'lite6' },
    });
    expect(response.status).toBe(403);
  });

  it('hides a Mission Day from non-members exactly like a missing one', async () => {
    const hidden = await call('/mission-days/example-2027', { as: STRANGER });
    const missing = await call('/mission-days/no-such-day', { as: STRANGER });
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toEqual(await missing.json());
  });

  it('lists only the Mission Days of the requester', async () => {
    const mine = (await (await call('/mission-days')).json()) as unknown[];
    const theirs = (await (await call('/mission-days', { as: STRANGER })).json()) as unknown[];
    expect(mine).toHaveLength(1);
    expect(theirs).toHaveLength(0);
  });

  it('does not reach missions through another Mission Day', async () => {
    await createMissionDay('other-2028');
    const mission = await createMission('example-2027');
    const response = await call(`/mission-days/other-2028/missions/${mission.id}`);
    expect(response.status).toBe(404);

    const write = await call(`/mission-days/other-2028/missions/${mission.id}/waypoints`, {
      method: 'PUT',
      body: { waypoints: [] },
    });
    expect(write.status).toBe(404);
  });

  it('allows deletion to owners only', async () => {
    const mission = await createMission('example-2027');
    const path = `/mission-days/example-2027/missions/${mission.id}`;
    expect((await call(path, { method: 'DELETE', as: EDITOR })).status).toBe(403);
    expect((await call(path, { method: 'DELETE', as: OWNER })).status).toBe(204);
    expect(
      (await call('/mission-days/example-2027', { method: 'DELETE', as: EDITOR })).status,
    ).toBe(403);
  });

  it('refuses writes from another site but accepts same-origin ones', async () => {
    const options = { method: 'PATCH', body: { city: 'Changed' } };
    const foreign = await call('/mission-days/example-2027', {
      ...options,
      headers: { Origin: 'https://evil.example.com' },
    });
    expect(foreign.status).toBe(403);

    const local = await call('/mission-days/example-2027', {
      ...options,
      headers: { Origin: 'https://md.example.org' },
    });
    expect(local.status).toBe(200);
  });
});

describe('Mission Days', () => {
  it('refuses reserved and repeated slugs', async () => {
    const body = { city: 'X', year: 2027, format: 'lite6' };
    const reserved = await call('/mission-days', {
      method: 'POST',
      as: ADMIN,
      body: { ...body, slug: 'admin' },
    });
    expect(reserved.status).toBe(400);

    const repeated = await call('/mission-days', {
      method: 'POST',
      as: ADMIN,
      body: { ...body, slug: 'example-2027' },
    });
    expect(repeated.status).toBe(409);
  });

  it('saves settings and returns them on the next read', async () => {
    const team = {
      enlPoc: { codename: 'Green', contact: 'green@example.org' },
      resPoc: { codename: 'Blue', contact: 'blue@example.org' },
      others: [],
    };
    const response = await call('/mission-days/example-2027', {
      method: 'PATCH',
      body: { format: 'standard24', date: '2027-05-01', team },
    });
    expect(response.status).toBe(200);

    const saved = (await (await call('/mission-days/example-2027')).json()) as Record<
      string,
      unknown
    >;
    expect(saved).toMatchObject({ format: 'standard24', date: '2027-05-01', team, role: 'owner' });
  });

  it('refuses a My Maps link that is not a web address', async () => {
    const response = await call('/mission-days/example-2027', {
      method: 'PATCH',
      body: { myMapsUrl: 'javascript:alert(1)' },
    });
    expect(response.status).toBe(400);
  });
});

describe('default letter texts', () => {
  const defaults = {
    aboutUs: { ca: 'Som agents.' },
    whatIsIngress: { en: 'A game.' },
    whatIsMissionDay: {},
    whyThisCity: {},
    closing: {},
  };

  /**
   * Saves the default texts as an instance administrator.
   *
   * @param letter - Texts to save.
   * @returns The response.
   */
  function saveDefaults(letter: unknown): Promise<Response> {
    return call('/letter-defaults', { method: 'PUT', as: ADMIN, body: letter });
  }

  /**
   * Reads the letter of a Mission Day.
   *
   * @param slug - Mission Day slug.
   * @returns Its letter sections.
   */
  async function letterOf(slug: string): Promise<unknown> {
    const day = (await (await call(`/mission-days/${slug}`)).json()) as { letter: unknown };
    return day.letter;
  }

  it('are reserved to instance administrators', async () => {
    expect((await call('/letter-defaults', { as: OWNER })).status).toBe(403);
    const write = await call('/letter-defaults', { method: 'PUT', as: OWNER, body: defaults });
    expect(write.status).toBe(403);
  });

  it('start empty and return what was saved', async () => {
    const empty = (await (await call('/letter-defaults', { as: ADMIN })).json()) as {
      aboutUs: unknown;
    };
    expect(empty.aboutUs).toEqual({});

    expect((await saveDefaults(defaults)).status).toBe(200);
    expect(await (await call('/letter-defaults', { as: ADMIN })).json()).toEqual(defaults);
  });

  it('are copied into a new Mission Day', async () => {
    await saveDefaults(defaults);
    await createMissionDay('other-2028');
    expect(await letterOf('other-2028')).toEqual(defaults);
  });

  it('leave existing Mission Days alone when they change', async () => {
    const before = await letterOf('example-2027');
    await saveDefaults(defaults);
    expect(await letterOf('example-2027')).toEqual(before);
  });

  it('are not changed by editing a Mission Day', async () => {
    await saveDefaults(defaults);
    await createMissionDay('other-2028');
    const edited = { ...defaults, closing: { ca: 'Fins aviat.' } };
    await call('/mission-days/other-2028', { method: 'PATCH', body: { letter: edited } });

    expect(await letterOf('other-2028')).toEqual(edited);
    expect(await (await call('/letter-defaults', { as: ADMIN })).json()).toEqual(defaults);
  });

  it('refuse malformed texts', async () => {
    expect((await saveDefaults({ aboutUs: 'not a map' })).status).toBe(400);
  });
});

describe('missions', () => {
  it('saves a name over the handbook limit, since validation only warns', async () => {
    const mission = await createMission('example-2027', 'x'.repeat(120));
    expect(mission.landmark).toHaveLength(120);
  });

  it('assigns different colours to consecutive missions', async () => {
    const first = await createMission('example-2027', 'A');
    const second = await createMission('example-2027', 'B');
    expect(first.colour).not.toBe(second.colour);
  });

  it('replaces waypoints and numbers them in the order received', async () => {
    const mission = await createMission('example-2027');
    const path = `/mission-days/example-2027/missions/${mission.id}`;
    const portal = { portalGuid: null, imageUrl: null };
    await call(`${path}/waypoints`, {
      method: 'PUT',
      body: {
        waypoints: [
          { ...portal, title: 'First', lat: 1, lng: 2 },
          { ...portal, title: 'Second', lat: 3, lng: 4 },
        ],
      },
    });
    await call(`${path}/waypoints`, {
      method: 'PUT',
      body: { waypoints: [{ ...portal, title: 'Only', lat: 5, lng: 6 }] },
    });
    const saved = (await (await call(path)).json()) as Mission;
    expect(saved.waypoints).toEqual([{ ...portal, position: 0, title: 'Only', lat: 5, lng: 6 }]);
  });

  it('refuses impossible coordinates', async () => {
    const mission = await createMission('example-2027');
    const response = await call(`/mission-days/example-2027/missions/${mission.id}/waypoints`, {
      method: 'PUT',
      body: { waypoints: [{ title: 'Bad', lat: 91, lng: 0 }] },
    });
    expect(response.status).toBe(400);
  });
});

describe('selection', () => {
  it('stores order and membership, clearing what was selected before', async () => {
    const a = await createMission('example-2027', 'A');
    const b = await createMission('example-2027', 'B');
    const path = '/mission-days/example-2027/selection';

    await call(path, { method: 'PUT', body: { missionIds: [a.id, b.id] } });
    const response = await call(path, { method: 'PUT', body: { missionIds: [b.id] } });
    const missions = (await response.json()) as Mission[];

    expect(missions.find((m) => m.id === a.id)).toMatchObject({
      selected: false,
      recommendedOrder: null,
    });
    expect(missions.find((m) => m.id === b.id)).toMatchObject({
      selected: true,
      recommendedOrder: 1,
    });
  });

  it('refuses missions of another Mission Day', async () => {
    await createMissionDay('other-2028');
    const foreign = await createMission('other-2028');
    const response = await call('/mission-days/example-2027/selection', {
      method: 'PUT',
      body: { missionIds: [foreign.id] },
    });
    expect(response.status).toBe(400);
  });

  it('refuses repeated missions', async () => {
    const a = await createMission('example-2027');
    const response = await call('/mission-days/example-2027/selection', {
      method: 'PUT',
      body: { missionIds: [a.id, a.id] },
    });
    expect(response.status).toBe(400);
  });
});

describe('photos', () => {
  const crop = '?x=0&y=0&size=1000';

  it('stores a 512×512 PNG, bumps the version and removes the old object', async () => {
    const mission = await createMission('example-2027');
    const path = `/mission-days/example-2027/missions/${mission.id}/photo`;
    const body = pngHeader(IMAGE_SIZE_PX);

    const first = (await (
      await call(`${path}${crop}`, { method: 'PUT', rawBody: body })
    ).json()) as Mission;
    expect(first).toMatchObject({ hasPhoto: true, photoVersion: 1 });

    await call(`${path}${crop}`, { method: 'PUT', rawBody: body });
    const prefix = `mission-days/${mission.missionDayId}/missions/${mission.id}/`;
    const objects = await env.BUCKET.list({ prefix });
    expect(objects.objects.map((object) => object.key)).toEqual([`${prefix}photo-2.png`]);

    const read = await call(path);
    expect(read.status).toBe(200);
    expect(read.headers.get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(body);
  });

  it('refuses other sizes and other file types', async () => {
    const mission = await createMission('example-2027');
    const path = `/mission-days/example-2027/missions/${mission.id}/photo${crop}`;
    const wrongSize = await call(path, { method: 'PUT', rawBody: pngHeader(100) });
    expect(wrongSize.status).toBe(415);
    const notPng = await call(path, { method: 'PUT', rawBody: new Uint8Array(40) });
    expect(notPng.status).toBe(415);
  });

  it('refuses oversized uploads', async () => {
    const mission = await createMission('example-2027');
    const path = `/mission-days/example-2027/missions/${mission.id}/photo${crop}`;
    const body = new Uint8Array(IMAGE_MAX_BYTES + 1);
    body.set(pngHeader(IMAGE_SIZE_PX));
    expect((await call(path, { method: 'PUT', rawBody: body })).status).toBe(413);
  });

  it('removes stored objects when the Mission Day is deleted', async () => {
    const mission = await createMission('example-2027');
    await call(`/mission-days/example-2027/missions/${mission.id}/photo${crop}`, {
      method: 'PUT',
      rawBody: pngHeader(IMAGE_SIZE_PX),
    });
    const response = await call('/mission-days/example-2027', { method: 'DELETE' });
    expect(response.status).toBe(204);
    const objects = await env.BUCKET.list({ prefix: `mission-days/${mission.missionDayId}/` });
    expect(objects.objects).toHaveLength(0);
  });
});
