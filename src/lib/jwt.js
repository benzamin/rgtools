import { compactVerify, importPKCS8, importSPKI, SignJWT } from 'jose';

export const SUPPORTED_ALGORITHMS = [
  'HS256', 'HS384', 'HS512',
  'RS256', 'RS384', 'RS512',
  'PS256', 'PS384', 'PS512',
  'ES256', 'ES384', 'ES512',
  'EdDSA',
];

export const HMAC_ALGORITHMS = new Set(['HS256', 'HS384', 'HS512']);
const ASYMMETRIC_ALGORITHMS = new Set(SUPPORTED_ALGORITHMS.filter((algorithm) => !HMAC_ALGORITHMS.has(algorithm)));

function decodeBase64Url(segment, label) {
  if (!segment || !/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error(`Invalid JWT ${label}.`);
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (segment.length % 4)) % 4);
  try {
    const binary = atob(padded);
    return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  } catch {
    throw new Error(`Invalid JWT ${label}.`);
  }
}

export function decodeJwt(token) {
  const normalized = token.trim();
  const parts = normalized.split('.');
  if (parts.length !== 3) throw new Error('JWT must contain three segments.');

  let header;
  let payload;
  try {
    header = JSON.parse(decodeBase64Url(parts[0], 'header'));
  } catch (error) {
    if (error.message === 'Invalid JWT header.') throw error;
    throw new Error('JWT header is not valid JSON.');
  }
  if (!header || typeof header !== 'object' || Array.isArray(header)) throw new Error('JWT header must be a JSON object.');

  try {
    payload = JSON.parse(decodeBase64Url(parts[1], 'payload'));
  } catch (error) {
    if (error.message === 'Invalid JWT payload.') throw error;
    throw new Error('JWT payload is not valid JSON.');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('JWT payload must be a JSON object.');
  if (typeof header.alg !== 'string' || !header.alg) throw new Error('Missing "alg" header.');

  return {
    header,
    payload,
    signature: parts[2],
    encodedHeader: parts[0],
    encodedPayload: parts[1],
    token: normalized,
  };
}

function decodeSecret(secret) {
  const padded = secret.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (secret.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function signJwt(header, payload, signingKey, keyFormat = 'text') {
  const algorithm = header.alg;
  if (!SUPPORTED_ALGORITHMS.includes(algorithm)) throw new Error('Unsupported signing algorithm.');
  if (!signingKey.trim()) throw new Error('Enter a secret to sign this JWT.');

  let key;
  if (HMAC_ALGORITHMS.has(algorithm)) {
    try {
      key = keyFormat === 'base64url' ? decodeSecret(signingKey.trim()) : new TextEncoder().encode(signingKey);
    } catch {
      throw new Error('Invalid Base64URL secret.');
    }
  } else {
    try {
      key = await importPKCS8(signingKey, algorithm);
    } catch {
      throw new Error('Invalid private key.');
    }
  }

  return new SignJWT(payload).setProtectedHeader(header).sign(key);
}

export async function verifyJwt(decoded, verificationKey, keyFormat) {
  const algorithm = decoded.header.alg;
  if (!SUPPORTED_ALGORITHMS.includes(algorithm)) return { status: 'unsupported', error: `Unsupported signing algorithm: ${algorithm}` };

  try {
    let key;
    if (HMAC_ALGORITHMS.has(algorithm)) {
      key = keyFormat === 'base64url' ? decodeSecret(verificationKey) : new TextEncoder().encode(verificationKey);
    } else if (ASYMMETRIC_ALGORITHMS.has(algorithm)) {
      key = await importSPKI(verificationKey, algorithm);
    }
    await compactVerify(decoded.token, key, { algorithms: [algorithm] });
    return { status: 'verified' };
  } catch (error) {
    if (error?.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') return { status: 'invalid', error: 'Invalid Signature' };
    return { status: 'error', error: 'Invalid verification key' };
  }
}

export async function generateExampleJwt() {
  const secret = 'a-string-secret-at-least-256-bits-long';
  const token = await new SignJWT({ sub: '1234567890', name: 'John Doe', admin: true, iat: 1516239022 })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(new TextEncoder().encode(secret));
  return { token, secret };
}

export function formatClaimValue(key, value) {
  const rendered = typeof value === 'string' ? value : JSON.stringify(value);
  if (['exp', 'nbf', 'iat'].includes(key) && typeof value === 'number' && Number.isFinite(value)) {
    return `${rendered}\n${new Date(value * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC')}`;
  }
  return rendered;
}
