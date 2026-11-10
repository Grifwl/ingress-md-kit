import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { IMAGE_SIZE_PX } from '../../shared/rules';
import type { Mission, Partner, ProposalView } from '../../shared/types';
import app from '../app';
import type { Env } from '../env';

const ADMIN = 'admin@example.org';
const OWNER = 'owner@example.org';
const EDITOR = 'editor@example.org';
const STRANGER = 'stranger@example.org';
const SLUG = 'example-2027';

/** Options of a test request. */
interface CallOptions {
  method?: string;
  body?: unknown;
  rawBody?: BodyInit;
  as?: string;
}

/**
 * Builds the environment of a test request. The static files binding is
 * replaced so that the page handler can run without a build.
 *
 * @param email - Identity to use.
 * @returns The environment.
 */
function testEnv(email: string): Env {
  return {
    ...env,
    ENVIRONMENT: 'dev',
    DEV_USER_EMAIL: email,
    INSTANCE_ADMINS: ADMIN,
    ASSETS: { fetch: async () => new Response('<html>page</html>') },
  } as unknown as Env;
}

/**
 * Sends a request to any path of the application.
 *
 * @param path - Path to request.
 * @param options - Method, body and identity.
 * @returns The response.
 */
async function send(path: string, options: CallOptions = {}): Promise<Response> {
  const request = new Request(`https://md.example.org${path}`, {
    method: options.method ?? 'GET',
    body:
      options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    redirect: 'manual',
  });
  return app.fetch(request, testEnv(options.as ?? OWNER));
}

/**
 * Sends a request to the partners of the demo Mission Day.
 *
 * @param path - Path after `/partners`.
 * @param options - Method, body and identity.
 * @returns The response.
 */
function partnersApi(path: string, options: CallOptions = {}): Promise<Response> {
  return send(`/api/admin/mission-days/${SLUG}/partners${path}`, options);
}

/**
 * Creates a partner.
 *
 * @param overrides - Fields to set.
 * @returns The new partner.
 */
async function createPartner(overrides: Record<string, unknown> = {}): Promise<Partner> {
  const response = await partnersApi('', {
    method: 'POST',
    body: { name: 'The Museum', letterLanguage: 'ca', ...overrides },
  });
  expect(response.status).toBe(201);
  return response.json();
}

/**
 * Creates a Mission Day owned by `OWNER`, with `EDITOR` as a member.
 *
 * @param slug - Slug to use.
 */
async function createMissionDay(slug: string): Promise<void> {
  await send('/api/admin/mission-days', {
    method: 'POST',
    as: ADMIN,
    body: { slug, city: 'Example City', year: 2027, format: 'lite6', ownerEmail: OWNER },
  });
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO organisers (email) VALUES (?)').bind(EDITOR),
    env.DB.prepare(
      `INSERT INTO memberships (mission_day_id, organiser_email, role)
       SELECT id, ?, 'editor' FROM mission_days WHERE slug = ?`,
    ).bind(EDITOR, slug),
  ]);
}

/**
 * Builds the first bytes of a square PNG.
 *
 * @param size - Width and height.
 * @param colourType - PNG colour type; 6 has an alpha channel.
 * @returns The bytes.
 */
function pngHeader(size: number, colourType: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, size);
  view.setUint32(20, size);
  bytes[25] = colourType;
  return bytes;
}

/**
 * Adds a mission and optionally selects it.
 *
 * @param landmark - Landmark of the mission.
 * @param selected - Whether it joins the final set.
 * @returns The new mission.
 */
async function createMission(landmark: string, selected: boolean): Promise<Mission> {
  const base = `/api/admin/mission-days/${SLUG}`;
  const mission = (await (
    await send(`${base}/missions`, {
      method: 'POST',
      body: { landmark, description: { ca: 'Un passeig.' }, notes: 'secret note' },
    })
  ).json()) as Mission;
  if (selected) {
    await send(`${base}/selection`, { method: 'PUT', body: { missionIds: [mission.id] } });
  }
  return mission;
}

/**
 * Creates a partner that has given its signed permission.
 *
 * @returns The partner.
 */
async function approvedPartner(): Promise<Partner> {
  const partner = await createPartner();
  const pdf = new Uint8Array(40);
  pdf.set(new TextEncoder().encode('%PDF-1.7'));
  await partnersApi(`/${partner.id}/approval`, { method: 'PUT', rawBody: pdf });
  await partnersApi(`/${partner.id}/status`, { method: 'POST', body: { status: 'accepted' } });
  return partner;
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM mission_days'),
    env.DB.prepare('DELETE FROM organisers'),
    env.DB.prepare(`UPDATE instance_settings SET letter_defaults_json = '{}'`),
  ]);
  await createMissionDay(SLUG);
});

describe('partners', () => {
  it('creates a partner as a candidate, with a long random token', async () => {
    const partner = await createPartner();
    expect(partner.status).toBe('candidate');
    expect(partner.proposalToken.length).toBeGreaterThanOrEqual(16);
    expect(partner.proposalToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(partner.statusHistory).toEqual([
      expect.objectContaining({ status: 'candidate', changedBy: OWNER }),
    ]);
  });

  it('gives each partner a different token', async () => {
    const first = await createPartner();
    const second = await createPartner({ name: 'The University' });
    expect(first.proposalToken).not.toBe(second.proposalToken);
  });

  it('copies the logo request of the Mission Day, then keeps its own', async () => {
    const letter = {
      aboutUs: {},
      whatIsIngress: {},
      whatIsMissionDay: {},
      whyThisCity: {},
      whyYou: {},
      logoRequest: { ca: 'Ens deixeu el logotip, {partner}?' },
      closing: {},
    };
    const day = `/api/admin/mission-days/${SLUG}`;
    await send(day, { method: 'PATCH', body: { letter } });

    const partner = await createPartner();
    expect(partner.logoRequest).toEqual(letter.logoRequest);

    await partnersApi(`/${partner.id}`, {
      method: 'PATCH',
      body: { logoRequest: { ca: 'Text propi.' } },
    });
    await send(day, {
      method: 'PATCH',
      body: { letter: { ...letter, logoRequest: { ca: 'Un altre.' } } },
    });
    const read = (await (await partnersApi(`/${partner.id}`)).json()) as Partner;
    expect(read.logoRequest).toEqual({ ca: 'Text propi.' });
  });

  it('copies the "why you" text of the Mission Day, per language', async () => {
    const whyYou = { ca: 'Perquè sou {partner}.', es: 'Porque sois {partner}.' };
    const letter = {
      aboutUs: {},
      whatIsIngress: {},
      whatIsMissionDay: {},
      whyThisCity: {},
      whyYou,
      logoRequest: {},
      closing: {},
    };
    await send(`/api/admin/mission-days/${SLUG}`, { method: 'PATCH', body: { letter } });
    expect((await createPartner()).whyYou).toEqual(whyYou);
  });

  it('shows the "why you" text in the language of the letter', async () => {
    const partner = await createPartner({
      letterLanguage: 'es',
      whyYou: { ca: 'En català', es: 'Para {partner}' },
    });
    const response = await send(`/api/public/proposals/${partner.proposalToken}`);
    const view = (await response.json()) as ProposalView;
    expect(view.letter.whyYou).toBe('Para The Museum');
  });

  it('refuses invalid fields', async () => {
    const invalid = [
      { letterLanguage: 'ca' },
      { name: 'X' },
      { name: 'X', letterLanguage: 'fr' },
      { name: 'X', letterLanguage: 'ca', kind: 'bank' },
      { name: 'X', letterLanguage: 'ca', contactEmail: 'not-an-email' },
    ];
    for (const body of invalid) {
      expect((await partnersApi('', { method: 'POST', body })).status).toBe(400);
    }
  });

  it('records each change of status with its note and author', async () => {
    const partner = await createPartner();
    const response = await partnersApi(`/${partner.id}/status`, {
      method: 'POST',
      as: EDITOR,
      body: { status: 'contacted', note: 'Email sent.' },
    });
    const updated = (await response.json()) as Partner;
    expect(updated.status).toBe('contacted');
    expect(updated.statusHistory.at(-1)).toMatchObject({
      status: 'contacted',
      note: 'Email sent.',
      changedBy: EDITOR,
    });
    expect(updated.statusHistory).toHaveLength(2);
  });

  it('hides partners from non-members and across Mission Days', async () => {
    const partner = await createPartner();
    expect((await partnersApi('', { as: STRANGER })).status).toBe(404);

    await createMissionDay('other-2028');
    const crossed = await send(`/api/admin/mission-days/other-2028/partners/${partner.id}`);
    expect(crossed.status).toBe(404);
  });

  it('allows deletion to owners only, and removes the files', async () => {
    const partner = await createPartner();
    await partnersApi(`/${partner.id}/overlay`, {
      method: 'PUT',
      rawBody: pngHeader(IMAGE_SIZE_PX, 6),
    });
    expect((await partnersApi(`/${partner.id}`, { method: 'DELETE', as: EDITOR })).status).toBe(
      403,
    );
    expect((await partnersApi(`/${partner.id}`, { method: 'DELETE' })).status).toBe(204);

    const prefix = `mission-days/${partner.missionDayId}/partners/${partner.id}/`;
    expect((await env.BUCKET.list({ prefix })).objects).toHaveLength(0);
  });
});

describe('partner files', () => {
  it('accepts a 512×512 overlay with transparency and replaces the old one', async () => {
    const partner = await createPartner();
    const path = `/${partner.id}/overlay`;
    const body = pngHeader(IMAGE_SIZE_PX, 6);
    await partnersApi(path, { method: 'PUT', rawBody: body });
    const updated = (await (
      await partnersApi(path, { method: 'PUT', rawBody: body })
    ).json()) as Partner;
    expect(updated).toMatchObject({ hasOverlay: true, overlayVersion: 2 });

    const prefix = `mission-days/${partner.missionDayId}/partners/${partner.id}/`;
    const objects = await env.BUCKET.list({ prefix });
    expect(objects.objects.map((object) => object.key)).toEqual([`${prefix}overlay-2`]);

    const read = await partnersApi(path);
    expect(read.headers.get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(body);
  });

  it.each([
    ['no transparency', pngHeader(IMAGE_SIZE_PX, 2)],
    ['the wrong size', pngHeader(100, 6)],
    ['another format', new Uint8Array(40)],
  ])('refuses an overlay with %s', async (_name, rawBody) => {
    const partner = await createPartner();
    const response = await partnersApi(`/${partner.id}/overlay`, { method: 'PUT', rawBody });
    expect(response.status).toBe(415);
  });

  it('refuses a logo that is not an accepted image, even if it says so', async () => {
    const partner = await createPartner();
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const response = await partnersApi(`/${partner.id}/logo`, { method: 'PUT', rawBody: svg });
    expect(response.status).toBe(415);
  });

  it('stores an approval and offers it as a download with its name', async () => {
    const partner = await createPartner();
    const pdf = new Uint8Array(40);
    pdf.set(new TextEncoder().encode('%PDF-1.7'));
    const path = `/${partner.id}/approval`;
    const updated = (await (
      await partnersApi(`${path}?name=${encodeURIComponent('signat ñ.pdf')}`, {
        method: 'PUT',
        rawBody: pdf,
      })
    ).json()) as Partner;
    expect(updated).toMatchObject({ hasApproval: true, approvalName: 'signat ñ.pdf' });

    const read = await partnersApi(path);
    expect(read.headers.get('Content-Type')).toBe('application/pdf');
    expect(read.headers.get('Content-Disposition')).toContain('attachment');
    expect(read.headers.get('Content-Disposition')).toContain('signat%20%C3%B1.pdf');
    expect(read.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});

describe('sample picture', () => {
  const generate = `/api/admin/mission-days/${SLUG}/sample`;
  const image = pngHeader(IMAGE_SIZE_PX, 6);

  /**
   * Fetches the picture the way a program would: no session, in production.
   *
   * @returns The response.
   */
  async function fetchSample(): Promise<Response> {
    return app.fetch(new Request(`https://md.example.org/${SLUG}/sample`), {
      ...env,
      ENVIRONMENT: 'production',
      INSTANCE_ADMINS: '',
    } as unknown as Env);
  }

  it('is served as a finished PNG without any session', async () => {
    expect((await send(generate, { method: 'PUT', rawBody: image })).status).toBe(200);
    const response = await fetchSample();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(image);
  });

  it('does not exist until it has been generated', async () => {
    expect((await fetchSample()).status).toBe(404);
  });

  it('can only show a partner that has given its permission', async () => {
    const partner = await createPartner();
    const response = await send(`${generate}?partnerId=${partner.id}`, {
      method: 'PUT',
      rawBody: image,
    });
    expect(response.status).toBe(403);
    expect((await fetchSample()).status).toBe(404);
  });

  it('marks a single partner, and replaces the previous picture', async () => {
    const first = await approvedPartner();
    const second = await approvedPartner();
    await send(`${generate}?partnerId=${first.id}`, { method: 'PUT', rawBody: image });
    const response = await send(`${generate}?partnerId=${second.id}`, {
      method: 'PUT',
      rawBody: image,
    });
    const day = (await response.json()) as { samplePartnerId: string; id: string };
    expect(day.samplePartnerId).toBe(second.id);
    const objects = await env.BUCKET.list({ prefix: `mission-days/${day.id}/sample` });
    expect(objects.objects).toHaveLength(1);
  });

  it('stops being served if the partner withdraws its permission', async () => {
    const partner = await approvedPartner();
    await send(`${generate}?partnerId=${partner.id}`, { method: 'PUT', rawBody: image });
    expect((await fetchSample()).status).toBe(200);
    await partnersApi(`/${partner.id}/status`, { method: 'POST', body: { status: 'declined' } });
    expect((await fetchSample()).status).toBe(404);
  });

  it('stops being served if the partner is deleted', async () => {
    const partner = await approvedPartner();
    await send(`${generate}?partnerId=${partner.id}`, { method: 'PUT', rawBody: image });
    await partnersApi(`/${partner.id}`, { method: 'DELETE' });
    expect((await fetchSample()).status).toBe(404);
  });

  it('refuses anything but a 512×512 PNG', async () => {
    const response = await send(generate, { method: 'PUT', rawBody: pngHeader(100, 6) });
    expect(response.status).toBe(415);
  });

  it('is reserved to members of the Mission Day', async () => {
    const response = await send(generate, { method: 'PUT', rawBody: image, as: STRANGER });
    expect(response.status).toBe(404);
  });

  it('leaves the address of no Mission Day to the static files', async () => {
    expect(await (await send('/no-such-day/sample')).text()).toBe('<html>page</html>');
  });
});

describe('public proposal', () => {
  /**
   * Reads a proposal through the public API.
   *
   * @param token - Token of the proposal.
   * @returns The response.
   */
  function proposalApi(token: string): Promise<Response> {
    return send(`/api/public/proposals/${token}`, { as: STRANGER });
  }

  it('needs no sign-in outside the dev environment', async () => {
    const partner = await createPartner();
    const response = await app.fetch(
      new Request(`https://md.example.org/api/public/proposals/${partner.proposalToken}`),
      { ...env, ENVIRONMENT: 'production', INSTANCE_ADMINS: '' } as unknown as Env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
  });

  it('shows only the selected missions, in order', async () => {
    const partner = await createPartner();
    await createMission('Left Out', false);
    await createMission('Chosen', true);
    const view = (await (await proposalApi(partner.proposalToken)).json()) as ProposalView;
    expect(view.missions.map((mission) => mission.name)).toEqual(['MD 2027: Example City, Chosen']);
    expect(view.missions[0]!.description).toBe('Un passeig.');
  });

  it('fills the placeholders of the letter', async () => {
    const letter = {
      aboutUs: { ca: 'Som de {city}.' },
      whatIsIngress: {},
      whatIsMissionDay: {},
      whyThisCity: {},
      whyYou: {},
      logoRequest: { ca: 'Ens deixeu el logotip, {partner}?' },
      closing: {},
    };
    await send(`/api/admin/mission-days/${SLUG}`, { method: 'PATCH', body: { letter } });
    const partner = await createPartner();
    const view = (await (await proposalApi(partner.proposalToken)).json()) as ProposalView;
    expect(view.letter.aboutUs).toBe('Som de Example City.');
    expect(view.letter.logoRequest).toBe('Ens deixeu el logotip, The Museum?');
  });

  it('never exposes private data', async () => {
    const partner = await createPartner({
      contactEmail: 'private@example.org',
      contactPerson: 'Private Person',
    });
    await createMission('Chosen', true);
    const text = await (await proposalApi(partner.proposalToken)).text();
    for (const secret of ['private@example.org', 'Private Person', 'secret note', OWNER]) {
      expect(text).not.toContain(secret);
    }
  });

  it('answers the same for an unknown token', async () => {
    expect((await proposalApi('x'.repeat(24))).status).toBe(404);
  });

  it('stops working with the old token once regenerated', async () => {
    const partner = await createPartner();
    const updated = (await (
      await partnersApi(`/${partner.id}/token`, { method: 'POST' })
    ).json()) as Partner;
    expect(updated.proposalToken).not.toBe(partner.proposalToken);
    expect((await proposalApi(partner.proposalToken)).status).toBe(404);
    expect((await proposalApi(updated.proposalToken)).status).toBe(200);
  });

  it('serves photos of selected missions only', async () => {
    const partner = await createPartner();
    const left = await createMission('Left Out', false);
    const base = `/api/admin/mission-days/${SLUG}/missions`;
    await send(`${base}/${left.id}/photo?x=0&y=0&size=512`, {
      method: 'PUT',
      rawBody: pngHeader(IMAGE_SIZE_PX, 6),
    });
    const photo = `/api/public/proposals/${partner.proposalToken}/missions/${left.id}/photo`;
    expect((await send(photo)).status).toBe(404);
  });

  it('uses the default overlay when the partner has none', async () => {
    const partner = await createPartner();
    const body = pngHeader(IMAGE_SIZE_PX, 6);
    const upload = await send(`/api/admin/mission-days/${SLUG}/default-overlay`, {
      method: 'PUT',
      rawBody: body,
    });
    expect(upload.status).toBe(200);
    const view = (await (await proposalApi(partner.proposalToken)).json()) as ProposalView;
    expect(view).toMatchObject({ hasOverlay: true, overlayVersion: 1 });
    const read = await send(`/api/public/proposals/${partner.proposalToken}/overlay`);
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(body);
  });

  describe('page', () => {
    it('serves the word of the letter language, without indexing', async () => {
      const partner = await createPartner({ letterLanguage: 'es' });
      const response = await send(`/${SLUG}/propuesta-${partner.proposalToken}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it.each(['proposta', 'proposal'])('redirects the word %s to the right one', async (word) => {
      const partner = await createPartner({ letterLanguage: 'es' });
      const response = await send(`/${SLUG}/${word}-${partner.proposalToken}`);
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe(`/${SLUG}/propuesta-${partner.proposalToken}`);
    });

    it('does not answer a token under another Mission Day', async () => {
      const partner = await createPartner();
      await createMissionDay('other-2028');
      const response = await send(`/other-2028/proposta-${partner.proposalToken}`);
      expect(response.status).toBe(404);
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
    });

    it('leaves other two-segment paths to the static files', async () => {
      const response = await send('/assets/admin.js');
      expect(await response.text()).toBe('<html>page</html>');
    });
  });
});

describe('participant view', () => {
  const day = `/api/admin/mission-days/${SLUG}`;
  const api = `/api/public/mission-days/${SLUG}`;

  /**
   * Publishes or withdraws the participant view.
   *
   * @param enabled - Whether it is public.
   * @param partnerId - Partner whose overlay it uses.
   * @param as - Identity of the requester.
   * @returns The response.
   */
  function configure(enabled: boolean, partnerId: string | null = null, as = OWNER) {
    return send(`${day}/participant-view`, { method: 'PUT', body: { enabled, partnerId }, as });
  }

  /**
   * Fetches a public address the way a participant would: no session.
   *
   * @param path - Path to request.
   * @returns The response.
   */
  async function visit(path: string): Promise<Response> {
    return app.fetch(new Request(`https://md.example.org${path}`), {
      ...testEnv(STRANGER),
      ENVIRONMENT: 'production',
      INSTANCE_ADMINS: '',
    } as unknown as Env);
  }

  it('says it is not published until an owner publishes it', async () => {
    const page = await visit(`/${SLUG}`);
    expect(page.status).toBe(404);
    expect(page.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(await page.text()).toContain('not been published yet');
    expect((await visit(api)).status).toBe(404);
  });

  it('can only be published by an owner', async () => {
    expect((await configure(true, null, EDITOR)).status).toBe(403);
    const response = await configure(true);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      participantViewEnabled: true,
      participantPartnerId: null,
    });
  });

  it('serves the page and only public data of the selected missions', async () => {
    const chosen = await createMission('Old Bridge', true);
    const other = await createMission('Hidden Corner', false);
    await configure(true);

    const page = await visit(`/${SLUG}`);
    expect(page.status).toBe(200);
    expect(page.headers.get('X-Robots-Tag')).toBe('noindex');

    const body = await (await visit(api)).text();
    expect(body).not.toContain('secret note');
    expect(body).not.toContain(other.id);
    expect(JSON.parse(body)).toMatchObject({
      city: 'Example City',
      overlayTag: null,
      missions: [
        {
          id: chosen.id,
          name: 'MD 2027: Example City, Old Bridge',
          description: { ca: 'Un passeig.' },
          order: 1,
        },
      ],
    });
  });

  it('serves photos of selected missions only, and nothing once withdrawn', async () => {
    const chosen = await createMission('Old Bridge', true);
    const other = await createMission('Hidden Corner', false);
    for (const mission of [chosen, other]) {
      await send(`${day}/missions/${mission.id}/photo?x=0&y=0&size=10`, {
        method: 'PUT',
        rawBody: pngHeader(IMAGE_SIZE_PX, 2),
      });
    }
    await configure(true);
    expect((await visit(`${api}/missions/${chosen.id}/photo`)).status).toBe(200);
    expect((await visit(`${api}/missions/${other.id}/photo`)).status).toBe(404);

    await configure(false);
    expect((await visit(`${api}/missions/${chosen.id}/photo`)).status).toBe(404);
  });

  it('uses an approved partner overlay while the permission lasts', async () => {
    await send(`${day}/default-overlay`, { method: 'PUT', rawBody: pngHeader(IMAGE_SIZE_PX, 6) });
    const partner = await approvedPartner();
    expect((await configure(true, partner.id)).status).toBe(409);

    const overlay = pngHeader(IMAGE_SIZE_PX, 6);
    overlay[32] = 7;
    await partnersApi(`/${partner.id}/overlay`, { method: 'PUT', rawBody: overlay });
    expect((await configure(true, partner.id)).status).toBe(200);

    const view = (await (await visit(api)).json()) as { overlayTag: string };
    expect(view.overlayTag).toMatch(/^p1-/);
    const served = await visit(`${api}/overlay`);
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(overlay);

    // A withdrawn permission brings back the default overlay by itself.
    await partnersApi(`/${partner.id}/status`, { method: 'POST', body: { status: 'declined' } });
    const after = (await (await visit(api)).json()) as { overlayTag: string };
    expect(after.overlayTag).toBe('d1');
  });

  it('refuses a partner without signed permission', async () => {
    const partner = await createPartner();
    expect((await configure(true, partner.id)).status).toBe(403);
  });

  it('leaves other addresses to the static files', async () => {
    expect(await (await visit('/no-such-day')).text()).toBe('<html>page</html>');
    expect(await (await visit('/favicon.ico')).text()).toBe('<html>page</html>');
  });
});
