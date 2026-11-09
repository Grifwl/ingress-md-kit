/**
 * Helpers shared by the route modules.
 */
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../env';

/** Context of a request handled by the Worker. */
export type AppContext = Context<AppEnv>;

/**
 * Stops the request unless the requester owns the Mission Day.
 *
 * @param c - Request context.
 */
export function assertOwner(c: AppContext): void {
  if (c.get('role') !== 'owner') {
    throw new HTTPException(403, { message: 'owner_required' });
  }
}

/**
 * Reads the JSON body, turning malformed JSON into a client error.
 *
 * @param c - Request context.
 * @returns The parsed body.
 */
export async function jsonBody(c: AppContext): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HTTPException(400, { message: 'invalid_body' });
  }
}

/**
 * Reads an uploaded file. The declared size is checked first to avoid
 * reading an oversized body into memory, then the real size, since the
 * header can lie.
 *
 * @param c - Request context.
 * @param maxBytes - Largest size allowed.
 * @returns The contents of the file.
 */
export async function readUpload(c: AppContext, maxBytes: number): Promise<ArrayBuffer> {
  if (Number(c.req.header('Content-Length') ?? 0) > maxBytes) {
    throw new HTTPException(413, { message: 'file_too_large' });
  }
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength > maxBytes) {
    throw new HTTPException(413, { message: 'file_too_large' });
  }
  return bytes;
}

/**
 * Builds the storage prefix of everything in a Mission Day.
 *
 * @param missionDayId - Mission Day identifier.
 * @returns The R2 key prefix.
 */
export function missionDayPrefix(missionDayId: string): string {
  return `mission-days/${missionDayId}/`;
}

/**
 * Deletes every stored object under a prefix.
 *
 * @param bucket - R2 binding.
 * @param prefix - Key prefix to remove.
 */
export async function deleteObjects(bucket: R2Bucket, prefix: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor });
    if (page.objects.length > 0) {
      await bucket.delete(page.objects.map((object) => object.key));
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor !== undefined);
}

/**
 * Answers with a stored object. `nosniff` makes browsers trust the type
 * recorded at upload rather than guessing from the content.
 *
 * @param c - Request context.
 * @param key - Storage key.
 * @param type - File type.
 * @param headers - Additional response headers.
 * @returns The response.
 */
export async function serveObject(
  c: AppContext,
  key: string,
  type: string,
  headers: Record<string, string>,
): Promise<Response> {
  const object = await c.env.BUCKET.get(key);
  if (object === null) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return c.body(object.body, 200, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
}

/** Cache header for images whose address changes with each new version. */
export const PRIVATE_IMMUTABLE = 'private, max-age=31536000, immutable';
