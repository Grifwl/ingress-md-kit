/**
 * Partners of a Mission Day, mounted under its private routes, which have
 * already checked that the requester belongs to it.
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { DOCUMENT_MAX_BYTES, IMAGE_MAX_BYTES, IMAGE_SIZE_PX } from '../../shared/rules';
import type { Partner } from '../../shared/types';
import type { AppEnv } from '../env';
import {
  parseFileName,
  parsePartnerCreate,
  parsePartnerPatch,
  parsePartnerStatus,
} from '../lib/input';
import {
  changePartnerStatus,
  createPartner,
  deletePartner,
  findPartner,
  findPartnerFile,
  listPartners,
  regenerateProposalToken,
  savePartnerFile,
  updatePartner,
  type PartnerFileKind,
} from '../lib/partners';
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

const LOGO_TYPES: readonly FileType[] = ['image/png', 'image/jpeg', 'image/webp'];
const APPROVAL_TYPES: readonly FileType[] = [...LOGO_TYPES, 'application/pdf'];

/**
 * Loads the partner named in the path, within the current Mission Day.
 *
 * @param c - Request context.
 * @returns The partner.
 */
async function requirePartner(c: AppContext): Promise<Partner> {
  const partner = await findPartner(
    c.env.DB,
    c.get('missionDay').id,
    c.req.param('partnerId') ?? '',
  );
  if (partner === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return partner;
}

/**
 * Builds the storage prefix of a partner's files.
 *
 * @param partner - The partner.
 * @returns The R2 key prefix.
 */
function partnerPrefix(partner: Partner): string {
  return `${missionDayPrefix(partner.missionDayId)}partners/${partner.id}/`;
}

/**
 * Tells the current version of one of a partner's files.
 *
 * @param partner - The partner.
 * @param kind - Which file.
 * @returns The version number.
 */
function fileVersion(partner: Partner, kind: PartnerFileKind): number {
  return {
    logo: partner.logoVersion,
    overlay: partner.overlayVersion,
    approval: partner.approvalVersion,
  }[kind];
}

/**
 * Stores a new version of a partner's file. The old object is removed only
 * once the database points at the new one, so a failure loses nothing.
 *
 * @param c - Request context.
 * @param partner - The partner.
 * @param kind - Which file.
 * @param bytes - Contents of the file.
 * @param type - Its verified type.
 * @param name - Original name, for documents.
 * @returns The partner after the change.
 */
async function storeFile(
  c: AppContext,
  partner: Partner,
  kind: PartnerFileKind,
  bytes: ArrayBuffer,
  type: FileType,
  name: string | null,
): Promise<Response> {
  const previous = await findPartnerFile(c.env.DB, partner.id, kind);
  const version = fileVersion(partner, kind) + 1;
  const key = `${partnerPrefix(partner)}${kind}-${version}`;
  await c.env.BUCKET.put(key, bytes, { httpMetadata: { contentType: type } });
  await savePartnerFile(c.env.DB, partner.id, kind, { key, type, name }, version);
  if (previous !== null) {
    await c.env.BUCKET.delete(previous.key);
  }
  return c.json(await findPartner(c.env.DB, partner.missionDayId, partner.id));
}

/**
 * Answers with one of a partner's images.
 *
 * @param c - Request context.
 * @param kind - Which image.
 * @returns The response.
 */
async function serveImage(c: AppContext, kind: 'logo' | 'overlay'): Promise<Response> {
  const partner = await requirePartner(c);
  const file = await findPartnerFile(c.env.DB, partner.id, kind);
  if (file === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return serveObject(c, file.key, file.type, { 'Cache-Control': PRIVATE_IMMUTABLE });
}

const partners = new Hono<AppEnv>();

partners.get('/', async (c) => c.json(await listPartners(c.env.DB, c.get('missionDay').id)));

partners.post('/', async (c) => {
  const missionDay = c.get('missionDay');
  const input = parsePartnerCreate(await jsonBody(c));
  const id = await createPartner(c.env.DB, missionDay, input, c.get('email'));
  return c.json(await findPartner(c.env.DB, missionDay.id, id), 201);
});

partners.get('/:partnerId', async (c) => c.json(await requirePartner(c)));

partners.patch('/:partnerId', async (c) => {
  const partner = await requirePartner(c);
  const patch = parsePartnerPatch(await jsonBody(c));
  await updatePartner(c.env.DB, partner, patch);
  return c.json({ ...partner, ...patch });
});

partners.delete('/:partnerId', async (c) => {
  assertOwner(c);
  const partner = await requirePartner(c);
  await deletePartner(c.env.DB, partner);
  await deleteObjects(c.env.BUCKET, partnerPrefix(partner));
  return c.body(null, 204);
});

partners.post('/:partnerId/status', async (c) => {
  const partner = await requirePartner(c);
  const { status, note } = parsePartnerStatus(await jsonBody(c));
  await changePartnerStatus(c.env.DB, partner, status, note, c.get('email'));
  return c.json(await findPartner(c.env.DB, partner.missionDayId, partner.id));
});

partners.post('/:partnerId/token', async (c) => {
  const partner = await requirePartner(c);
  await regenerateProposalToken(c.env.DB, partner);
  return c.json(await findPartner(c.env.DB, partner.missionDayId, partner.id));
});

partners.put('/:partnerId/logo', async (c) => {
  const partner = await requirePartner(c);
  const bytes = await readUpload(c, IMAGE_MAX_BYTES);
  const type = detectFileType(bytes);
  if (type === null || !LOGO_TYPES.includes(type)) {
    throw new HTTPException(415, { message: 'invalid_file' });
  }
  return storeFile(c, partner, 'logo', bytes, type, null);
});

partners.get('/:partnerId/logo', (c) => serveImage(c, 'logo'));

partners.put('/:partnerId/overlay', async (c) => {
  const partner = await requirePartner(c);
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
  return storeFile(c, partner, 'overlay', bytes, 'image/png', null);
});

partners.get('/:partnerId/overlay', (c) => serveImage(c, 'overlay'));

partners.put('/:partnerId/approval', async (c) => {
  const partner = await requirePartner(c);
  const bytes = await readUpload(c, DOCUMENT_MAX_BYTES);
  const type = detectFileType(bytes);
  if (type === null || !APPROVAL_TYPES.includes(type)) {
    throw new HTTPException(415, { message: 'invalid_file' });
  }
  return storeFile(c, partner, 'approval', bytes, type, parseFileName(c.req.query('name')));
});

partners.get('/:partnerId/approval', async (c) => {
  const partner = await requirePartner(c);
  const file = await findPartnerFile(c.env.DB, partner.id, 'approval');
  if (file === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return serveObject(c, file.key, file.type, {
    'Cache-Control': 'private, no-store',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name ?? 'document')}`,
  });
});

export default partners;
