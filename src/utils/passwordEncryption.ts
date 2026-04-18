const SUPPORTED_PASSWORD_TRANSFORMATION = 'RSA/ECB/OAEPWithSHA-256AndMGF1Padding';

const normalizePublicKeyPem = (publicKeyBase64OrPem: string): string => {
  const trimmed = publicKeyBase64OrPem.trim();

  if (trimmed.includes('BEGIN PUBLIC KEY')) {
    return trimmed;
  }

  const body = trimmed.replace(/\s+/g, '');
  const wrappedBody = body.match(/.{1,64}/g)?.join('\n') ?? body;

  return `-----BEGIN PUBLIC KEY-----\n${wrappedBody}\n-----END PUBLIC KEY-----`;
};

export const encryptPasswordWithPublicKey = async (
  plaintext: string,
  publicKeyBase64OrPem: string,
  transformation: string,
): Promise<string> => {
  if (typeof window === 'undefined') {
    throw new Error('CURRENT_BROWSER_DOES_NOT_SUPPORT_PASSWORD_ENCRYPTION');
  }

  if (transformation !== SUPPORTED_PASSWORD_TRANSFORMATION) {
    throw new Error(`UNSUPPORTED_PASSWORD_ENCRYPTION_TRANSFORMATION:${transformation}`);
  }

  const forgeModule = await import('node-forge');
  const forge = forgeModule.default ?? forgeModule;
  const publicKeyPem = normalizePublicKeyPem(publicKeyBase64OrPem);
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);

  return forge.util.encode64(
    publicKey.encrypt(forge.util.encodeUtf8(plaintext), 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: {
        md: forge.md.sha256.create(),
      },
    }),
  );
};