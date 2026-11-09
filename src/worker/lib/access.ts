/**
 * Cloudflare Access authentication.
 *
 * Access decides who can reach the instance at all; the Worker still
 * verifies the signed token on every request, so that a route exposed by
 * mistake outside Access does not become an open door. Verification uses
 * WebCrypto directly, which avoids shipping a JWT library.
 */
import type { Env } from '../env';

/** Finds the public key that signed a token. */
export type KeyLoader = (keyId: string) => Promise<CryptoKey | null>;

/** Expected origin of the tokens. */
export interface AccessConfig {
  teamDomain: string;
  audience: string;
}

/** Keys of one Access team, cached between requests. */
interface CertCache {
  keys: Map<string, CryptoKey>;
  fetchedAt: number;
}

const RSA_ALGORITHM = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;
const CERT_MAX_AGE_MS = 60 * 60 * 1000;

// An unknown key ID usually means Cloudflare rotated its keys, but anyone
// can send a made-up ID, so refreshes on that path are rate limited.
const CERT_MIN_REFRESH_MS = 60 * 1000;

const certCaches = new Map<string, CertCache>();

/**
 * Decodes base64url text.
 *
 * @param value - Encoded text, without padding.
 * @returns The decoded bytes.
 */
function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/**
 * Decodes one JSON segment of a token.
 *
 * @param segment - Base64url-encoded JSON.
 * @returns The parsed object.
 */
function decodeJsonSegment(segment: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment)));
}

/**
 * Verifies an Access token and extracts the identity it carries. Anything
 * unexpected, including a malformed token, counts as a failure.
 *
 * @param token - Value of the `Cf-Access-Jwt-Assertion` header.
 * @param config - Expected team domain and audience; empty values always fail.
 * @param loadKey - Provides the signing key.
 * @param now - Current time in milliseconds, replaceable in tests.
 * @returns The lowercase email, or null when the token is not valid.
 */
export async function verifyAccessJwt(
  token: string,
  config: AccessConfig,
  loadKey: KeyLoader,
  now: number = Date.now(),
): Promise<string | null> {
  if (config.teamDomain === '' || config.audience === '') {
    return null;
  }
  try {
    const [headerPart, payloadPart, signaturePart, ...rest] = token.split('.');
    if (!headerPart || !payloadPart || !signaturePart || rest.length > 0) {
      return null;
    }

    // The algorithm is pinned: a token must never choose how it is checked.
    const header = decodeJsonSegment(headerPart);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
      return null;
    }
    const key = await loadKey(header.kid);
    if (key === null) {
      return null;
    }
    const signedContent = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
    const validSignature = await crypto.subtle.verify(
      RSA_ALGORITHM,
      key,
      decodeBase64Url(signaturePart),
      signedContent,
    );
    if (!validSignature) {
      return null;
    }

    const claims = decodeJsonSegment(payloadPart);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const seconds = now / 1000;
    if (
      claims.iss !== `https://${config.teamDomain}` ||
      !audiences.includes(config.audience) ||
      typeof claims.exp !== 'number' ||
      claims.exp <= seconds ||
      (typeof claims.nbf === 'number' && claims.nbf > seconds) ||
      typeof claims.email !== 'string'
    ) {
      return null;
    }
    return claims.email.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Downloads the current public keys of an Access team.
 *
 * @param teamDomain - Team domain, such as `example.cloudflareaccess.com`.
 * @returns The keys by key ID.
 */
async function fetchCerts(teamDomain: string): Promise<Map<string, CryptoKey>> {
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) {
    throw new Error(`Could not load the Access certificates: ${response.status}`);
  }
  const body = (await response.json()) as { keys: (JsonWebKey & { kid: string })[] };
  const entries = await Promise.all(
    body.keys.map(
      async (jwk) =>
        [jwk.kid, await crypto.subtle.importKey('jwk', jwk, RSA_ALGORITHM, false, ['verify'])] as [
          string,
          CryptoKey,
        ],
    ),
  );
  return new Map(entries);
}

/**
 * Creates a key loader backed by the team's published certificates.
 *
 * @param teamDomain - Team domain to read the keys from.
 * @returns A loader that caches keys and handles rotation.
 */
export function createCertLoader(teamDomain: string): KeyLoader {
  return async (keyId) => {
    const now = Date.now();
    let cache = certCaches.get(teamDomain);
    const expired = cache === undefined || now - cache.fetchedAt > CERT_MAX_AGE_MS;
    const rotated =
      cache !== undefined && !cache.keys.has(keyId) && now - cache.fetchedAt > CERT_MIN_REFRESH_MS;
    if (expired || rotated) {
      cache = { keys: await fetchCerts(teamDomain), fetchedAt: now };
      certCaches.set(teamDomain, cache);
    }
    return cache?.keys.get(keyId) ?? null;
  };
}

/**
 * Determines who is making a request. The development bypass requires
 * `ENVIRONMENT=dev`, which only `.dev.vars` sets; the tracked configuration
 * declares `production`, so a deployment fails closed.
 *
 * @param headers - Headers of the request.
 * @param env - Worker environment.
 * @returns The lowercase email, or null when the request is anonymous.
 */
export async function resolveEmail(headers: Headers, env: Env): Promise<string | null> {
  if (env.ENVIRONMENT === 'dev' && env.DEV_USER_EMAIL) {
    return env.DEV_USER_EMAIL.toLowerCase();
  }
  const token = headers.get('Cf-Access-Jwt-Assertion');
  if (token === null) {
    return null;
  }
  return verifyAccessJwt(
    token,
    { teamDomain: env.ACCESS_TEAM_DOMAIN, audience: env.ACCESS_AUD },
    createCertLoader(env.ACCESS_TEAM_DOMAIN),
  );
}

/**
 * Tells whether an email belongs to an instance administrator.
 *
 * @param email - Lowercase email of the requester.
 * @param env - Worker environment, whose `INSTANCE_ADMINS` is comma separated.
 * @returns True for an instance administrator.
 */
export function isInstanceAdmin(email: string, env: Env): boolean {
  return env.INSTANCE_ADMINS.split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '')
    .includes(email);
}
