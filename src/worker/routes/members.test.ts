import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CurrentUser, InstanceMissionDay, Member } from '../../shared/types';
import app from '../app';
import type { Env } from '../env';

const ADMIN = 'admin@example.org';
const OWNER = 'owner@example.org';
const EDITOR = 'editor@example.org';
const NEWCOMER = 'new@example.org';
const STRANGER = 'stranger@example.org';

const TEAM = '/mission-days/example-2027/members';

/**
 * Sends a request to the admin API as a given person, using the
 * development bypass to pick the identity.
 *
 * @param path - Path under /api/admin.
 * @param as - Email of the requester.
 * @param method - HTTP method.
 * @param body - JSON body, if any.
 * @returns The response.
 */
async function call(path: string, as: string, method = 'GET', body?: unknown): Promise<Response> {
  const testEnv = { ...env, ENVIRONMENT: 'dev', DEV_USER_EMAIL: as, INSTANCE_ADMINS: ADMIN } as Env;
  const request = new Request(`https://md.example.org/api/admin${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return app.fetch(request, testEnv);
}

/**
 * Builds the address of one member.
 *
 * @param email - Member's email.
 * @returns The path under /api/admin.
 */
function memberPath(email: string): string {
  return `${TEAM}/${encodeURIComponent(email)}`;
}

/**
 * Reads the team as its owner.
 *
 * @returns Emails and roles, owners first.
 */
async function team(): Promise<Pick<Member, 'email' | 'role'>[]> {
  const members = (await (await call(TEAM, OWNER)).json()) as Member[];
  return members.map(({ email, role }) => ({ email, role }));
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM mission_days'),
    env.DB.prepare('DELETE FROM organisers'),
  ]);
  const created = await call('/mission-days', ADMIN, 'POST', {
    slug: 'example-2027',
    city: 'Example City',
    year: 2027,
    format: 'lite6',
    ownerEmail: OWNER,
  });
  expect(created.status).toBe(201);
  expect((await call(TEAM, OWNER, 'POST', { email: EDITOR, role: 'editor' })).status).toBe(201);
});

describe('team of a Mission Day', () => {
  it('lists owners first, to any member', async () => {
    const members = (await (await call(TEAM, EDITOR)).json()) as Member[];
    expect(members.map(({ email, role }) => ({ email, role }))).toEqual([
      { email: OWNER, role: 'owner' },
      { email: EDITOR, role: 'editor' },
    ]);
  });

  it('is hidden from strangers exactly like a missing Mission Day', async () => {
    const hidden = await call(TEAM, STRANGER);
    const missing = await call('/mission-days/no-such-day/members', STRANGER);
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toEqual(await missing.json());
  });

  it('gives access to the rest of the Mission Day once someone is added', async () => {
    expect((await call('/mission-days/example-2027', NEWCOMER)).status).toBe(404);
    await call(TEAM, OWNER, 'POST', { email: ' New@Example.org ', role: 'editor' });
    const response = await call('/mission-days/example-2027', NEWCOMER);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ role: 'editor' });
  });

  it('refuses to add someone twice or with an invalid email or role', async () => {
    expect((await call(TEAM, OWNER, 'POST', { email: EDITOR, role: 'owner' })).status).toBe(409);
    expect((await call(TEAM, OWNER, 'POST', { email: 'nobody', role: 'editor' })).status).toBe(400);
    expect((await call(TEAM, OWNER, 'POST', { email: NEWCOMER, role: 'boss' })).status).toBe(400);
  });

  it('lets only owners add, change or remove other members', async () => {
    const add = await call(TEAM, EDITOR, 'POST', { email: NEWCOMER, role: 'editor' });
    expect(add.status).toBe(403);
    const promote = await call(memberPath(EDITOR), EDITOR, 'PATCH', { role: 'owner' });
    expect(promote.status).toBe(403);
    expect((await call(memberPath(OWNER), EDITOR, 'DELETE')).status).toBe(403);
  });

  it('changes roles', async () => {
    await call(memberPath(EDITOR), OWNER, 'PATCH', { role: 'owner' });
    expect(await team()).toEqual([
      { email: EDITOR, role: 'owner' },
      { email: OWNER, role: 'owner' },
    ]);
  });

  it('never leaves a Mission Day without an owner', async () => {
    const demote = await call(memberPath(OWNER), OWNER, 'PATCH', { role: 'editor' });
    expect(demote.status).toBe(409);
    expect(await demote.json()).toEqual({ error: 'last_owner' });
    expect((await call(memberPath(OWNER), OWNER, 'DELETE')).status).toBe(409);

    await call(memberPath(EDITOR), OWNER, 'PATCH', { role: 'owner' });
    expect((await call(memberPath(OWNER), OWNER, 'DELETE')).status).toBe(200);
    expect(await call(TEAM, EDITOR).then((r) => r.json())).toMatchObject([
      { email: EDITOR, role: 'owner' },
    ]);
  });

  it('lets a member leave by themself', async () => {
    expect((await call(memberPath(EDITOR), EDITOR, 'DELETE')).status).toBe(200);
    expect((await call('/mission-days/example-2027', EDITOR)).status).toBe(404);
  });

  it('answers 404 for someone who is not on the team', async () => {
    const response = await call(memberPath(STRANGER), OWNER, 'PATCH', { role: 'owner' });
    expect(response.status).toBe(404);
  });

  it('lets an instance administrator manage a team they are not part of', async () => {
    expect((await call('/mission-days/example-2027', ADMIN)).status).toBe(404);
    expect((await call(TEAM, ADMIN, 'POST', { email: NEWCOMER, role: 'owner' })).status).toBe(201);
    expect((await call(memberPath(OWNER), ADMIN, 'DELETE')).status).toBe(200);
    expect((await call('/mission-days/example-2027', NEWCOMER)).status).toBe(200);
  });

  it('is removed with the Mission Day, but the organisers stay', async () => {
    await call('/mission-days/example-2027', OWNER, 'DELETE');
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM memberships').first('n');
    expect(count).toBe(0);
    const me = (await (await call('/me', EDITOR)).json()) as CurrentUser;
    expect(me.email).toBe(EDITOR);
  });
});

describe('organiser profile', () => {
  it('starts empty and keeps what the organiser saves', async () => {
    expect(await (await call('/me', NEWCOMER)).json()).toEqual({
      email: NEWCOMER,
      codename: '',
      faction: null,
      isInstanceAdmin: false,
    });
    const saved = await call('/me', NEWCOMER, 'PATCH', { codename: ' Agent ', faction: 'RES' });
    expect(await saved.json()).toMatchObject({ codename: 'Agent', faction: 'RES' });
  });

  it('is shown in the team list', async () => {
    await call('/me', EDITOR, 'PATCH', { codename: 'Green', faction: 'ENL' });
    const members = (await (await call(TEAM, OWNER)).json()) as Member[];
    expect(members.find((m) => m.email === EDITOR)).toEqual({
      email: EDITOR,
      codename: 'Green',
      faction: 'ENL',
      role: 'editor',
    });
  });

  it('survives being added to a team afterwards', async () => {
    await call('/me', NEWCOMER, 'PATCH', { codename: 'Early', faction: null });
    await call(TEAM, OWNER, 'POST', { email: NEWCOMER, role: 'editor' });
    const me = (await (await call('/me', NEWCOMER)).json()) as CurrentUser;
    expect(me.codename).toBe('Early');
  });

  it('refuses an unknown faction', async () => {
    const response = await call('/me', OWNER, 'PATCH', { codename: 'X', faction: 'NEUTRAL' });
    expect(response.status).toBe(400);
  });
});

describe('instance list of Mission Days', () => {
  it('is reserved to instance administrators', async () => {
    expect((await call('/instance/mission-days', OWNER)).status).toBe(403);
  });

  it('lists every Mission Day with the administrator role in each', async () => {
    const list = (await (
      await call('/instance/mission-days', ADMIN)
    ).json()) as InstanceMissionDay[];
    expect(list).toEqual([{ slug: 'example-2027', city: 'Example City', year: 2027, role: null }]);
  });
});
