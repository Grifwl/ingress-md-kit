/**
 * Public side of the application: the proposal page and the read-only data
 * it needs. There is no sign-in here, so the secret token in the address is
 * the only credential, and an unknown token reveals nothing.
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { PROPOSAL_WORDS, parseProposalSegment } from '../../shared/letter';
import type { MissionDay, Partner } from '../../shared/types';
import type { AppEnv } from '../env';
import {
  findMission,
  findMissionDayById,
  findMissionDayFile,
  findPhotoKey,
  listMissions,
} from '../lib/db';
import { findPartnerByToken, findPartnerFile } from '../lib/partners';
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
 * Keeps search engines away from everything these routes answer.
 *
 * @param c - Request context.
 * @param next - Next handler.
 */
const noIndex: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  c.header('X-Robots-Tag', 'noindex');
};

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
