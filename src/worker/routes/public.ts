/**
 * Public side of the application: the proposal pages, the participant
 * view and the read-only data they need. There is no sign-in here. A
 * proposal's secret token is its only credential, and an unknown token
 * reveals nothing; the participant view answers only once an owner has
 * published it, and until then looks the same as no Mission Day at all.
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { PROPOSAL_WORDS, parseProposalSegment } from '../../shared/letter';
import { contactLink } from '../../shared/home';
import { mayShowLogo } from '../../shared/partners';
import type { BiocardFileKind, HomeView, MissionDay, Partner } from '../../shared/types';
import type { AppEnv } from '../env';
import {
  findMission,
  findMissionDayById,
  findMissionDayBySlug,
  findMissionDayFile,
  findPhotoKey,
  getInstanceSettings,
  listMissions,
  listPublishedMissionDays,
} from '../lib/db';
import { findPartner, findPartnerByToken, findPartnerFile } from '../lib/partners';
import { buildParticipantView, findParticipantOverlay } from '../lib/participant';
import { buildProposalView } from '../lib/proposal';
import { serveObject, type AppContext } from './helpers';

/** A proposal found through its token. */
interface FoundProposal {
  partner: Partner;
  missionDay: MissionDay;
}

// Revoking a link must take effect soon, so browsers may keep the images
// for an hour at most, even though their addresses are versioned.
const PUBLIC_IMAGE_CACHE = { 'Cache-Control': 'private, max-age=3600' };

const NOT_FOUND_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>404</title></head>
<body><h1>404</h1></body></html>`;

// Shown at the address of a Mission Day whose participant view is not
// public yet. The visitor's language is unknown, so it says it in all three.
const NOT_PUBLISHED_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Mission Day</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.6 system-ui,sans-serif;background:#eef0f3;color:#1c2128}main{padding:1.5rem;text-align:center}p{margin:.25rem 0}</style>
</head><body><main>
<p lang="ca">Aquest Mission Day encara no s'ha publicat.</p>
<p lang="es">Este Mission Day aún no se ha publicado.</p>
<p lang="en">This Mission Day has not been published yet.</p>
</main></body></html>`;

/**
 * Finds a proposal and its Mission Day.
 *
 * @param db - D1 binding.
 * @param token - Token from the address.
 * @returns The proposal, or null when the token is not valid.
 */
async function findProposal(db: D1Database, token: string): Promise<FoundProposal | null> {
  const partner = await findPartnerByToken(db, token);
  if (partner === null) {
    return null;
  }
  const missionDay = await findMissionDayById(db, partner.missionDayId);
  return missionDay === null ? null : { partner, missionDay };
}

/**
 * Loads the proposal named in the path.
 *
 * @param c - Request context.
 * @returns The proposal.
 */
async function requireProposal(c: AppContext): Promise<FoundProposal> {
  const found = await findProposal(c.env.DB, c.req.param('token') ?? '');
  if (found === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return found;
}

/**
 * Loads the Mission Day named in the path, provided its participant view
 * has been published.
 *
 * @param c - Request context.
 * @returns The Mission Day.
 */
async function requirePublished(c: AppContext): Promise<MissionDay> {
  const missionDay = await findMissionDayBySlug(c.env.DB, c.req.param('slug') ?? '');
  if (missionDay === null || !missionDay.participantViewEnabled) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return missionDay;
}

/**
 * Keeps search engines away from everything these routes answer.
 *
 * @param c - Request context.
 * @param next - Next handler.
 */
const noIndex: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  c.header('X-Robots-Tag', 'noindex');
};

/** Biocard files a public page may fetch. */
const BIOCARD_FILES: readonly BiocardFileKind[] = ['front', 'back', 'photo', 'font'];

/**
 * Answers with a file of the Mission Day's own Biocard, but only while
 * the organisers show the card on the page asking for it.
 *
 * @param c - Request context.
 * @param missionDay - The Mission Day.
 * @param shown - Whether the page shows the card.
 * @returns The response.
 */
async function serveBiocardFile(
  c: AppContext,
  missionDay: MissionDay,
  shown: boolean,
): Promise<Response> {
  const kind = c.req.param('file') as BiocardFileKind;
  const file =
    shown && BIOCARD_FILES.includes(kind)
      ? await findMissionDayFile(c.env.DB, missionDay.id, `biocard_${kind}`)
      : null;
  if (file === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return serveObject(c, file.key, file.type, PUBLIC_IMAGE_CACHE);
}

const publicApi = new Hono<AppEnv>();
publicApi.use('*', noIndex);

publicApi.get('/proposals/:token', async (c) => {
  const { partner, missionDay } = await requireProposal(c);
  const missions = await listMissions(c.env.DB, missionDay.id);
  c.header('Cache-Control', 'no-store');
  return c.json(buildProposalView(missionDay, partner, missions));
});

publicApi.get('/proposals/:token/missions/:missionId/photo', async (c) => {
  const { missionDay } = await requireProposal(c);
  const mission = await findMission(c.env.DB, missionDay.id, c.req.param('missionId'));
  const key =
    mission === null || !mission.selected
      ? null
      : await findPhotoKey(c.env.DB, missionDay.id, mission.id);
  if (key === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return serveObject(c, key, 'image/png', PUBLIC_IMAGE_CACHE);
});

publicApi.get('/proposals/:token/overlay', async (c) => {
  const { partner, missionDay } = await requireProposal(c);
  const file =
    (await findPartnerFile(c.env.DB, partner.id, 'overlay')) ??
    (await findMissionDayFile(c.env.DB, missionDay.id, 'default_overlay'));
  if (file === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return serveObject(c, file.key, file.type, PUBLIC_IMAGE_CACHE);
});

publicApi.get('/proposals/:token/logo', async (c) => {
  const { partner } = await requireProposal(c);
  const file = await findPartnerFile(c.env.DB, partner.id, 'logo');
  if (file === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return serveObject(c, file.key, file.type, PUBLIC_IMAGE_CACHE);
});

publicApi.get('/proposals/:token/map-screenshot', async (c) => {
  const { missionDay } = await requireProposal(c);
  const file = await findMissionDayFile(c.env.DB, missionDay.id, 'map_screenshot');
  if (file === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return serveObject(c, file.key, file.type, PUBLIC_IMAGE_CACHE);
});

publicApi.get('/proposals/:token/biocard/:file', async (c) => {
  const { missionDay } = await requireProposal(c);
  return serveBiocardFile(c, missionDay, missionDay.biocard.showOnProposals);
});

// The home page: what the instance is and which Mission Days it has
// published. Partners are never listed here; their logos appear only in
// the mission images of the participant views they gave permission for.
publicApi.get('/home', async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const [missionDays, settings] = await Promise.all([
    listPublishedMissionDays(c.env.DB, today),
    getInstanceSettings(c.env.DB),
  ]);
  const view: HomeView = {
    missionDays,
    contact: contactLink(settings.contactLabel, settings.contactUrl),
  };
  c.header('Cache-Control', 'no-cache');
  return c.json(view);
});

// The participant view: shared only through chosen channels, so it is kept
// out of search engines like everything else here.
publicApi.get('/mission-days/:slug', async (c) => {
  const missionDay = await requirePublished(c);
  const [missions, overlay] = await Promise.all([
    listMissions(c.env.DB, missionDay.id),
    findParticipantOverlay(c.env.DB, missionDay),
  ]);
  c.header('Cache-Control', 'no-cache');
  return c.json(buildParticipantView(missionDay, missions, overlay?.tag ?? null));
});

publicApi.get('/mission-days/:slug/missions/:missionId/photo', async (c) => {
  const missionDay = await requirePublished(c);
  const mission = await findMission(c.env.DB, missionDay.id, c.req.param('missionId'));
  const key =
    mission === null || !mission.selected
      ? null
      : await findPhotoKey(c.env.DB, missionDay.id, mission.id);
  if (key === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return serveObject(c, key, 'image/png', PUBLIC_IMAGE_CACHE);
});

publicApi.get('/mission-days/:slug/overlay', async (c) => {
  const overlay = await findParticipantOverlay(c.env.DB, await requirePublished(c));
  if (overlay === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return serveObject(c, overlay.key, overlay.type, PUBLIC_IMAGE_CACHE);
});

publicApi.get('/mission-days/:slug/biocard/:file', async (c) => {
  const missionDay = await requirePublished(c);
  return serveBiocardFile(c, missionDay, missionDay.biocard.showOnParticipantView);
});

/**
 * Answers `/`, the home page of the instance. Unlike every other public
 * page it may appear in search engines: it is the instance's front door
 * and shows nothing that its published participant views do not already.
 *
 * @param c - Request context.
 * @returns The page.
 */
export async function serveHomePage(c: AppContext): Promise<Response> {
  const url = new URL(c.req.url);
  url.pathname = '/home/';
  url.search = '';
  const asset = await c.env.ASSETS.fetch(new Request(url, c.req.raw));
  const page = new Response(asset.body, asset);
  page.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  page.headers.set('Cache-Control', 'no-cache');
  return page;
}

/**
 * Answers `/:slug`, the participant view. A Mission Day whose view is not
 * published gets a short notice; any other address carries on to the next
 * handler, which serves static files.
 *
 * @param c - Request context.
 * @param next - Next handler.
 * @returns The page, the notice, or the next handler's answer.
 */
export const serveParticipantPage: MiddlewareHandler<AppEnv> = async (c, next) => {
  const slug = c.req.param('slug') ?? '';
  // Slugs never contain a dot, so files at the root skip the lookup.
  const missionDay = slug.includes('.') ? null : await findMissionDayBySlug(c.env.DB, slug);
  if (missionDay === null) {
    return next();
  }
  if (!missionDay.participantViewEnabled) {
    return c.html(NOT_PUBLISHED_PAGE, 404, {
      'X-Robots-Tag': 'noindex',
      'Cache-Control': 'no-store',
    });
  }
  const url = new URL(c.req.url);
  url.pathname = '/participant/';
  url.search = '';
  const asset = await c.env.ASSETS.fetch(new Request(url, c.req.raw));
  const page = new Response(asset.body, asset);
  page.headers.set('X-Robots-Tag', 'noindex');
  page.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  page.headers.set('Cache-Control', 'no-cache');
  return page;
};

/**
 * Answers `/:slug/sample` with the picture sent with the application: a
 * plain PNG, so that it also works for a program that fetches the address.
 * If the partner it shows has withdrawn its permission or been removed,
 * the picture stops being served until a new one is generated.
 *
 * @param c - Request context.
 * @param next - Next handler, for addresses of no Mission Day.
 * @returns The image, or a 404 page.
 */
export const serveSample: MiddlewareHandler<AppEnv> = async (c, next) => {
  const missionDay = await findMissionDayBySlug(c.env.DB, c.req.param('slug') ?? '');
  if (missionDay === null) {
    return next();
  }
  const file = await findMissionDayFile(c.env.DB, missionDay.id, 'sample');
  let allowed = file !== null;
  if (allowed && missionDay.samplePartnerId !== null) {
    const partner = await findPartner(c.env.DB, missionDay.id, missionDay.samplePartnerId);
    allowed = partner !== null && mayShowLogo(partner);
  }
  if (file === null || !allowed) {
    return c.html(NOT_FOUND_PAGE, 404, { 'X-Robots-Tag': 'noindex' });
  }
  return serveObject(c, file.key, file.type, {
    'Cache-Control': 'public, max-age=300',
    'X-Robots-Tag': 'noindex',
  });
};

/**
 * Answers `/:slug/proposta-:token`. Any of the three words is accepted and
 * redirected to the one of the partner's letter language. Other paths with
 * two segments, such as static files, carry on to the next handler.
 *
 * @param c - Request context.
 * @param next - Next handler.
 * @returns The page, a redirect or a 404 page.
 */
export const serveProposalPage: MiddlewareHandler<AppEnv> = async (c, next) => {
  const parsed = parseProposalSegment(c.req.param('segment') ?? '');
  if (parsed === null) {
    return next();
  }
  const slug = c.req.param('slug');
  const found = await findProposal(c.env.DB, parsed.token);
  if (found === null || found.missionDay.slug !== slug) {
    return c.html(NOT_FOUND_PAGE, 404, { 'X-Robots-Tag': 'noindex' });
  }

  const word = PROPOSAL_WORDS[found.partner.letterLanguage];
  if (parsed.word !== word) {
    return c.redirect(`/${slug}/${word}-${parsed.token}`, 302);
  }

  const url = new URL(c.req.url);
  url.pathname = '/public/';
  url.search = '';
  const asset = await c.env.ASSETS.fetch(new Request(url, c.req.raw));
  const page = new Response(asset.body, asset);
  page.headers.set('X-Robots-Tag', 'noindex');
  // Map tiles are loaded from another site: it must receive the origin at
  // most, never the full address, which contains the secret token.
  page.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  page.headers.set('Cache-Control', 'no-store');
  return page;
};

export default publicApi;
