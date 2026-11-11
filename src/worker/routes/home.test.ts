import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { HomeView } from '../../shared/types';
import app from '../app';
import type { Env } from '../env';

const ADMIN = 'admin@example.org';
const OWNER = 'owner@example.org';

/** Options of a test request. */
interface CallOptions {
  method?: string;
  body?: unknown;
  as?: string;
}

/**
 * Sends a request as a signed-in person, in local development mode.
 *
 * @param path - Path to request.
 * @param options - Method, body and identity.
 * @returns The response.
 */
async function send(path: string, options: CallOptions = {}): Promise<Response> {
  const request = new Request(`https://md.example.org${path}`, {
    method: options.method ?? 'GET',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return app.fetch(request, {
    ...env,
    ENVIRONMENT: 'dev',
    DEV_USER_EMAIL: options.as ?? OWNER,
    INSTANCE_ADMINS: ADMIN,
  } as unknown as Env);
}

/**
 * Fetches a public address the way a visitor would: no session, and a
 * stand-in for the built static files.
 *
 * @param path - Path to request.
 * @returns The response.
 */
async function visit(path: string): Promise<Response> {
  return app.fetch(new Request(`https://md.example.org${path}`), {
    ...env,
    ENVIRONMENT: 'production',
    INSTANCE_ADMINS: '',
    ASSETS: {
      fetch: async (request: Request) => new Response(`asset ${new URL(request.url).pathname}`),
    },
  } as unknown as Env);
}

/**
 * Creates a Mission Day owned by OWNER and sets some of its fields.
 *
 * @param slug - Its slug.
 * @param patch - Fields to change after creating it.
 * @param published - Whether to publish its participant view.
 */
async function createMissionDay(
  slug: string,
  patch: Record<string, unknown>,
  published: boolean,
): Promise<void> {
  await send('/api/admin/mission-days', {
    method: 'POST',
    as: ADMIN,
    body: { slug, city: slug, year: 2027, format: 'standard18', ownerEmail: OWNER },
  });
  await send(`/api/admin/mission-days/${slug}`, { method: 'PATCH', body: patch });
  if (published) {
    await send(`/api/admin/mission-days/${slug}/participant-view`, {
      method: 'PUT',
      body: { enabled: true, partnerId: null },
    });
  }
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM mission_days'),
    env.DB.prepare('DELETE FROM organisers'),
    env.DB.prepare(`UPDATE instance_settings SET contact_label = '', contact_url = ''`),
  ]);
});

describe('home page', () => {
  it('is served at the root and may be indexed', async () => {
    const page = await visit('/');
    expect(await page.text()).toBe('asset /home/');
    expect(page.headers.get('X-Robots-Tag')).toBeNull();
  });

  it('lists only published Mission Days, upcoming first, and nothing private', async () => {
    await createMissionDay('upcoming', { date: '2999-05-01', myMapsUrl: null }, true);
    await createMissionDay('finished', { status: 'done' }, true);
    await createMissionDay('hidden', { date: '2999-06-01' }, false);

    const response = await visit('/api/public/home');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).not.toContain('hidden');
    expect(body).not.toContain(OWNER);
    expect(JSON.parse(body) as HomeView).toEqual({
      missionDays: [
        { slug: 'upcoming', city: 'upcoming', year: 2027, date: '2999-05-01', past: false },
        { slug: 'finished', city: 'finished', year: 2027, date: null, past: true },
      ],
      contact: null,
    });
  });
});

describe('instance settings', () => {
  it('can only be read and changed by instance administrators', async () => {
    expect((await send('/api/admin/instance/settings')).status).toBe(403);
    const refused = await send('/api/admin/instance/settings', {
      method: 'PUT',
      body: { contactLabel: '@someone', contactUrl: '' },
    });
    expect(refused.status).toBe(403);
  });

  it('saves a trimmed label and link that the home page then shows', async () => {
    const saved = await send('/api/admin/instance/settings', {
      method: 'PUT',
      as: ADMIN,
      body: { contactLabel: ' @someone ', contactUrl: '  https://t.me/someone  ' },
    });
    const expected = { contactLabel: '@someone', contactUrl: 'https://t.me/someone' };
    expect(await saved.json()).toEqual(expected);

    const read = await send('/api/admin/instance/settings', { as: ADMIN });
    expect(await read.json()).toEqual(expected);
    const home = (await (await visit('/api/public/home')).json()) as HomeView;
    expect(home.contact).toEqual({ label: '@someone', href: 'https://t.me/someone' });
  });

  it('refuses links that are not web or email addresses, and long labels', async () => {
    for (const body of [
      { contactLabel: '@someone', contactUrl: 'javascript:alert(1)' },
      { contactLabel: '@someone', contactUrl: 't.me/someone' },
      { contactLabel: 'x'.repeat(201), contactUrl: '' },
    ]) {
      const response = await send('/api/admin/instance/settings', {
        method: 'PUT',
        as: ADMIN,
        body,
      });
      expect(response.status).toBe(400);
    }
  });
});
