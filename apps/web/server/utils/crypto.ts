export async function verifyGitHubSignature(rawBody: Uint8Array, signatureHeader: string | undefined, secret: string) {
  if (!signatureHeader || !secret) return false;
  const expectedPrefix = 'sha256=';
  if (!signatureHeader.startsWith(expectedPrefix)) return false;
  const provided = signatureHeader.slice(expectedPrefix.length).trim().toLowerCase();

  const cryptoSubtle = (globalThis.crypto?.subtle as SubtleCrypto | undefined);
  if (!cryptoSubtle) return false;

  const key = await cryptoSubtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuf = await cryptoSubtle.sign('HMAC', key, rawBody as unknown as BufferSource);
  const computed = [...new Uint8Array(sigBuf)].map(b => b.toString(16).padStart(2, '0')).join('');

  return timingSafeEqualStr(provided, computed);
}

function timingSafeEqualStr(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
