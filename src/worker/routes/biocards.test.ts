import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BIOCARD_SETTINGS, type BiocardSettings } from '../../shared/biocard';
import type {
  Mission,
  MissionDay,
  Partner,
  ParticipantView,
  ProposalView,
} from '../../shared/types';
import app from '../app';
import type { Env } from '../env';

const ADMIN = 'admin@example.org';
const OWNER = 'owner@example.org';
const SLUG = 'example-2027';
const DAY = `/api/admin/mission-days/${SLUG}`;

/** Options of a test request. */
interface CallOptions {
  method?: string;
  body?: unknown;
  rawBody?: BodyInit;
  as?: string;
}

/**
 * Sends a request to any path of the application as a signed-in organiser.
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
  });
  return app.fetch(request, {
    ...env,
    ENVIRONMENT: 'dev',
    DEV_USER_EMAIL: options.as ?? OWNER,
    INSTANCE_ADMINS: ADMIN,
  } as unknown as Env);
}

/**
 * Fetches a public address without any session.
 *
 * @param path - Path to request.
 * @returns The response.
 */
async function visit(path: string): Promise<Response> {
  return app.fetch(new Request(`https://md.example.org${path}`), {
    ...env,
    ENVIRONMENT: 'production',
    INSTANCE_ADMINS: '',
  } as unknown as Env);
}

/**
 * Builds the first bytes of a PNG, which is all the Worker inspects.
 *
 * @param width - Width in pixels.
 * @param height - Height in pixels.
 * @param colourType - PNG colour type; 6 has an alpha channel.
 * @returns The bytes.
 */
function pngHeader(width: number, height: number, colourType = 6): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[25] = colourType;
  return bytes;
}

/**
 * Uploads a Biocard file.
 *
 * @param file - Which file.
 * @param body - Its contents.
 * @returns The response.
 */
function upload(file: string, body: Uint8Array<ArrayBuffer>): Promise<Response> {
  return send(`${DAY}/biocard/${file}`, { method: 'PUT', rawBody: body });
}

/**
 * Saves Biocard settings.
 *
 * @param changes - Fields to change from the defaults.
 * @returns The response.
 */
function saveSettings(changes: Partial<BiocardSettings>): Promise<Response> {
  return send(`${DAY}/biocard`, {
    method: 'PUT',
    body: { ...DEFAULT_BIOCARD_SETTINGS, ...changes },
  });
}

/** Uploads both templates and the photo of the Mission Day's own card. */
async function uploadCard(): Promise<void> {
  expect((await upload('front', pngHeader(744, 1039))).status).toBe(200);
  expect((await upload('back', pngHeader(744, 1039, 2))).status).toBe(200);
  expect((await upload('photo', pngHeader(1000, 1000, 2))).status).toBe(200);
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM mission_days'),
    env.DB.prepare('DELETE FROM organisers'),
  ]);
  await send('/api/admin/mission-days', {
    method: 'POST',
    as: ADMIN,
    body: { slug: SLUG, city: 'Example City', year: 2027, format: 'lite6', ownerEmail: OWNER },
  });
});

describe('Biocard files', () => {
  it('start missing and get a version once uploaded', async () => {
    const before = (await (await send(DAY)).json()) as MissionDay;
    expect(before.biocardFiles).toEqual({ front: null, back: null, photo: null, font: null });
    expect(before.biocard).toEqual(DEFAULT_BIOCARD_SETTINGS);

    await uploadCard();
    const after = (await (await send(DAY)).json()) as MissionDay;
    expect(after.biocardFiles).toEqual({ front: 1, back: 1, photo: 1, font: null });
    expect((await send(`${DAY}/biocard/front`)).status).toBe(200);
  });

  it('need transparency on the front template', async () => {
    const response = await upload('front', pngHeader(744, 1039, 2));
    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ error: 'invalid_biocard_front' });
  });

  it('refuse oversized templates and unknown files', async () => {
    expect((await upload('back', pngHeader(6000, 8000))).status).toBe(415);
    expect((await upload('back', new Uint8Array(40))).status).toBe(415);
    expect((await upload('other', pngHeader(744, 1039))).status).toBe(404);
  });

  it('accept a font that can be removed, and never reuse its version', async () => {
    const font = new Uint8Array(40);
    font.set([0, 1, 0, 0]);
    expect((await upload('font', font)).status).toBe(200);
    expect((await upload('font', pngHeader(10, 10))).status).toBe(415);

    const removed = await send(`${DAY}/biocard/font`, { method: 'DELETE' });
    expect(((await removed.json()) as MissionDay).biocardFiles.font).toBeNull();
    expect((await send(`${DAY}/biocard/font`)).status).toBe(404);

    const again = (await (await upload('font', font)).json()) as MissionDay;
    expect(again.biocardFiles.font).toBe(2);
  });
});

describe('Biocard settings', () => {
  it('are saved and read back', async () => {
    const response = await saveSettings({
      genericName: 'Mission Day',
      genericPhoto: 'collage',
      genericDescription: { ca: 'Hola' },
    });
    expect(response.status).toBe(200);
    const day = (await (await send(DAY)).json()) as MissionDay;
    expect(day.biocard).toMatchObject({ genericName: 'Mission Day', genericPhoto: 'collage' });
  });

  it('refuse malformed boxes', async () => {
    const layout = {
      ...DEFAULT_BIOCARD_SETTINGS.layout,
      name: { ...DEFAULT_BIOCARD_SETTINGS.layout.name, colour: 'red' },
    };
    expect((await saveSettings({ layout })).status).toBe(400);
    const tiny = {
      ...DEFAULT_BIOCARD_SETTINGS.layout,
      description: { ...DEFAULT_BIOCARD_SETTINGS.layout.description, width: 0 },
    };
    expect((await saveSettings({ layout: tiny })).status).toBe(400);
  });

  it('keep the name written for a mission card', async () => {
    const mission = (await (
      await send(`${DAY}/missions`, { method: 'POST', body: { landmark: 'Ajuntament' } })
    ).json()) as Mission;
    const response = await send(`${DAY}/missions/${mission.id}`, {
      method: 'PATCH',
      body: { biocardName: 'Ajt.' },
    });
    expect(((await response.json()) as Mission).biocardName).toBe('Ajt.');
  });
});

describe('Biocards on public pages', () => {
  /**
   * Creates a partner and returns it.
   *
   * @returns The partner.
   */
  async function createPartner(): Promise<Partner> {
    const response = await send(`${DAY}/partners`, {
      method: 'POST',
      body: { name: 'The Museum', letterLanguage: 'ca' },
    });
    return response.json();
  }

  it('stay out of proposals until the organisers show the card there', async () => {
    await uploadCard();
    const partner = await createPartner();
    const api = `/api/public/proposals/${partner.proposalToken}`;

    expect(((await (await visit(api)).json()) as ProposalView).biocards).toBeNull();
    expect((await visit(`${api}/biocard/front`)).status).toBe(404);

    await saveSettings({
      withPartnerLogo: true,
      genericName: 'MD',
      genericDescription: { ca: 'Hola', en: 'Hello' },
    });
    const view = (await (await visit(api)).json()) as ProposalView;
    // The partner has no overlay of its own, and the default one is never used.
    expect(view.biocards).toMatchObject({ frontVersion: 1, fontVersion: null, overlay: false });
    expect(view.biocards?.cards).toEqual([
      {
        key: 'generic',
        name: 'MD',
        picture: 'upload',
        photoVersion: 1,
        description: { ca: 'Hola' },
      },
    ]);
    expect((await visit(`${api}/biocard/front`)).status).toBe(200);
    expect((await visit(`${api}/biocard/font`)).status).toBe(404);

    // With an overlay of its own, the partner's cards carry it.
    await send(`${DAY}/partners/${partner.id}/overlay`, {
      method: 'PUT',
      rawBody: pngHeader(512, 512),
    });
    expect(((await (await visit(api)).json()) as ProposalView).biocards?.overlay).toBe(true);
  });

  it('need the photos of selected missions for a collage', async () => {
    await uploadCard();
    await send(`${DAY}/participant-view`, {
      method: 'PUT',
      body: { enabled: true, partnerId: null },
    });
    await saveSettings({ showOnParticipantView: true, genericPhoto: 'collage' });
    const api = `/api/public/mission-days/${SLUG}`;
    expect(((await (await visit(api)).json()) as ParticipantView).biocards).toBeNull();

    await saveSettings({ showOnParticipantView: true, genericPhoto: 'upload' });
    const view = (await (await visit(api)).json()) as ParticipantView;
    expect(view.biocards?.cards).toMatchObject([{ picture: 'upload', photoVersion: 1 }]);
    expect((await visit(`${api}/biocard/back`)).status).toBe(200);
  });

  it('show the ticked mission cards that are selected and have a photo', async () => {
    await uploadCard();
    const [first, second, unselected] = await Promise.all(
      ['Ajuntament', 'Pont', 'Catedral'].map(async (landmark) => {
        const response = await send(`${DAY}/missions`, { method: 'POST', body: { landmark } });
        return (await response.json()) as Mission;
      }),
    );
    for (const mission of [first!, second!, unselected!]) {
      await send(`${DAY}/missions/${mission.id}/photo?x=0&y=0&size=512`, {
        method: 'PUT',
        rawBody: pngHeader(512, 512, 2),
      });
    }
    await send(`${DAY}/missions/${first!.id}`, {
      method: 'PATCH',
      body: { biocardName: 'Ajt.', description: { ca: 'Plaça', en: 'Square' } },
    });
    await send(`${DAY}/selection`, {
      method: 'PUT',
      body: { missionIds: [second!.id, first!.id] },
    });
    await send(`${DAY}/participant-view`, {
      method: 'PUT',
      body: { enabled: true, partnerId: null },
    });
    const api = `/api/public/mission-days/${SLUG}`;

    // Until the ticks change: the Mission Day's card and every selected mission.
    const published = await send(`${DAY}/biocard-publication`, {
      method: 'PUT',
      body: { cards: null, withPartnerLogo: false, showOnParticipantView: true },
    });
    expect(((await published.json()) as MissionDay).biocard.showOnParticipantView).toBe(true);
    const byDefault = (await (await visit(api)).json()) as ParticipantView;
    expect(byDefault.biocards?.cards.map((card) => card.name)).toEqual(['', 'Pont', 'Ajt.']);
    expect(byDefault.biocards?.cards[2]).toMatchObject({
      key: first!.id,
      picture: 'mission',
      photoVersion: 1,
      description: { ca: 'Plaça', en: 'Square' },
    });

    // A ticked mission outside the selection is never shown.
    await send(`${DAY}/biocard-publication`, {
      method: 'PUT',
      body: {
        cards: [first!.id, unselected!.id],
        withPartnerLogo: false,
        showOnParticipantView: true,
      },
    });
    const ticked = (await (await visit(api)).json()) as ParticipantView;
    expect(ticked.biocards?.cards.map((card) => card.key)).toEqual([first!.id]);

    const wrong = await send(`${DAY}/biocard-publication`, {
      method: 'PUT',
      body: { cards: [1], withPartnerLogo: false, showOnParticipantView: true },
    });
    expect(wrong.status).toBe(400);
  });

  it('carry the partner request and the Biocard text in the letter', async () => {
    await send(DAY, {
      method: 'PATCH',
      body: {
        letter: {
          aboutUs: {},
          whatIsIngress: {},
          whatIsMissionDay: {},
          whyThisCity: {},
          whyYou: {},
          logoRequest: {},
          whatIsBiocard: { ca: 'Una targeta.' },
          biocardRequest: { ca: 'Voleu sortir a les cartes, {partner}?' },
          closing: {},
        },
      },
    });
    const partner = await createPartner();
    expect(partner.biocardAnswer).toBe('pending');
    const api = `/api/public/proposals/${partner.proposalToken}`;

    // Unless the cards carry the partner's logo, the letter says nothing about them.
    const silent = (await (await visit(api)).json()) as ProposalView;
    expect(silent.letter.whatIsBiocard).toBe('');
    expect(silent.letter.biocardRequest).toBe('');

    await saveSettings({ withPartnerLogo: true });
    const view = (await (await visit(api)).json()) as ProposalView;
    expect(view.letter.whatIsBiocard).toBe('Una targeta.');
    expect(view.letter.biocardRequest).toBe('Voleu sortir a les cartes, The Museum?');

    const answered = await send(`${DAY}/partners/${partner.id}`, {
      method: 'PATCH',
      body: { biocardAnswer: 'own' },
    });
    expect(((await answered.json()) as Partner).biocardAnswer).toBe('own');
    const wrong = await send(`${DAY}/partners/${partner.id}`, {
      method: 'PATCH',
      body: { biocardAnswer: 'maybe' },
    });
    expect(wrong.status).toBe(400);
  });
});
