import { beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../env';
import { isInstanceAdmin, resolveEmail, verifyAccessJwt, type KeyLoader } from './access';

const ALGORITHM = {
  name: 'RSASSA-PKCS1-v1_5',
  hash: 'SHA-256',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
} as const;
const CONFIG = { teamDomain: 'team.example.org', audience: 'aud-1' };
const NOW = 1_800_000_000_000;

let keys: CryptoKeyPair;
let otherKeys: CryptoKeyPair;
let loadKey: KeyLoader;

/**
 * Encodes bytes as base64url.
 *
 * @param bytes - Bytes to encode.
 * @returns The encoded text.
 */
function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Creates a signed token.
 *
 * @param claims - Claims to override.
 * @param privateKey - Signing key; defaults to the trusted one.
 * @param header - Header fields to override.
 * @returns The token.
 */
async function sign(
  claims: Record<string, unknown> = {},
  privateKey: CryptoKey = keys.privateKey,
  header: Record<string, unknown> = {},
): Promise<string> {
  const encoder = new TextEncoder();
  const head = base64Url(encoder.encode(JSON.stringify({ alg: 'RS256', kid: 'k1', ...header })));
  const body = base64Url(
    encoder.encode(
      JSON.stringify({
        iss: 'https://team.example.org',
        aud: ['aud-1'],
        exp: NOW / 1000 + 60,
        email: 'Agent@Example.org',
        ...claims,
      }),
    ),
  );
  const signature = await crypto.subtle.sign(
    ALGORITHM.name,
    privateKey,
    encoder.encode(`${head}.${body}`),
  );
  return `${head}.${body}.${base64Url(signature)}`;
}

beforeAll(async () => {
  keys = (await crypto.subtle.generateKey(ALGORITHM, true, ['sign', 'verify'])) as CryptoKeyPair;
  otherKeys = (await crypto.subtle.generateKey(ALGORITHM, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  loadKey = async (keyId) => (keyId === 'k1' ? keys.publicKey : null);
});

describe('verifyAccessJwt', () => {
  it('returns the lowercase email of a valid token', async () => {
    expect(await verifyAccessJwt(await sign(), CONFIG, loadKey, NOW)).toBe('agent@example.org');
  });

  it('rejects a signature from another key', async () => {
    const token = await sign({}, otherKeys.privateKey);
    expect(await verifyAccessJwt(token, CONFIG, loadKey, NOW)).toBeNull();
  });

  it('rejects a tampered payload', async () => {
    const [head, , signature] = (await sign()).split('.');
    const forged = base64Url(
      new TextEncoder().encode(JSON.stringify({ email: 'evil@example.org' })),
    );
    expect(
      await verifyAccessJwt(`${head}.${forged}.${signature}`, CONFIG, loadKey, NOW),
    ).toBeNull();
  });

  it.each([
    ['expired', { exp: NOW / 1000 - 1 }],
    ['not yet valid', { nbf: NOW / 1000 + 60 }],
    ['wrong audience', { aud: ['other'] }],
    ['wrong issuer', { iss: 'https://evil.example.org' }],
    ['no email', { email: undefined }],
  ])('rejects a token that is %s', async (_name, claims) => {
    expect(await verifyAccessJwt(await sign(claims), CONFIG, loadKey, NOW)).toBeNull();
  });

  it('rejects an algorithm other than RS256', async () => {
    const token = await sign({}, keys.privateKey, { alg: 'none' });
    expect(await verifyAccessJwt(token, CONFIG, loadKey, NOW)).toBeNull();
  });

  it('rejects an unknown key', async () => {
    const token = await sign({}, keys.privateKey, { kid: 'unknown' });
    expect(await verifyAccessJwt(token, CONFIG, loadKey, NOW)).toBeNull();
  });

  it('rejects malformed tokens', async () => {
    expect(await verifyAccessJwt('not-a-token', CONFIG, loadKey, NOW)).toBeNull();
    expect(await verifyAccessJwt('a.b.c', CONFIG, loadKey, NOW)).toBeNull();
  });

  it('fails closed when the audience is not configured', async () => {
    const config = { ...CONFIG, audience: '' };
    expect(await verifyAccessJwt(await sign(), config, loadKey, NOW)).toBeNull();
  });
});

describe('resolveEmail', () => {
  const baseEnv = { ACCESS_TEAM_DOMAIN: '', ACCESS_AUD: '', INSTANCE_ADMINS: '' };

  it('allows the bypass only in the dev environment', async () => {
    const devEnv = { ...baseEnv, ENVIRONMENT: 'dev', DEV_USER_EMAIL: 'Dev@Example.org' } as Env;
    expect(await resolveEmail(new Headers(), devEnv)).toBe('dev@example.org');

    const production = { ...devEnv, ENVIRONMENT: 'production' } as Env;
    expect(await resolveEmail(new Headers(), production)).toBeNull();
  });

  it('lets a cookie pick another identity in the dev environment only', async () => {
    const devEnv = { ...baseEnv, ENVIRONMENT: 'dev', DEV_USER_EMAIL: 'dev@example.org' } as Env;
    const headers = new Headers({ Cookie: 'other=1; dev_user=Editor%40Example.org' });
    expect(await resolveEmail(headers, devEnv)).toBe('editor@example.org');

    const malformed = new Headers({ Cookie: 'dev_user=nobody' });
    expect(await resolveEmail(malformed, devEnv)).toBe('dev@example.org');

    const production = { ...devEnv, ENVIRONMENT: 'production' } as Env;
    expect(await resolveEmail(headers, production)).toBeNull();
  });
});

describe('isInstanceAdmin', () => {
  it('matches entries of the list regardless of spacing and case', () => {
    const env = { INSTANCE_ADMINS: 'a@example.org, B@Example.org' } as Env;
    expect(isInstanceAdmin('b@example.org', env)).toBe(true);
    expect(isInstanceAdmin('c@example.org', env)).toBe(false);
  });

  it('matches nobody when the list is empty', () => {
    expect(isInstanceAdmin('', { INSTANCE_ADMINS: '' } as Env)).toBe(false);
  });
});
