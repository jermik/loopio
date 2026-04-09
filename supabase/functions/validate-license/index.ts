const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnAvLt5oq0LVeM0s7PhYr
LOc8Y7AT6o4EJcc+z8xECWjkgr9zYwHWbOx6Aiz69T2EH7BlkO3f6ffdogoaY7MF
uvO25jdwZbxym7PAD5aep7nTlz9Y/fHgAB+7pbcyj4voykMbdVn/bAGbo+O1C8uL
5OYMYtJ7OyDNR4MhPyvvOZ+UJZ+CG617I9IQYUTpp4n9UeAl8hWhyVceMi+SkFb8
A/xqzDvFmiK4VJ0v4NQvyRQfMd3Nd6eY5Vx58Kygivhmt2tKOyaPAc9zKitZdl3Q
QsR7I6kzIyeov8JTAA9dW1+yPAvZKq+Qht/tYEVw2bzekpxh5CvvvaZPGkDSf0sK
dwIDAQAB
-----END PUBLIC KEY-----`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

async function verifyLicense(key: string) {
  const parts = key.split('.');
  if (parts.length !== 3 || parts[0] !== 'ML1') {
    return { valid: false, message: 'Invalid license key format.' };
  }

  const [, payloadB64, signatureB64] = parts;

  try {
    const payloadBytes = new TextEncoder().encode(payloadB64);
    const signatureBytes = fromBase64Url(signatureB64);

    const keyBuffer = pemToArrayBuffer(PUBLIC_KEY_PEM);
    const cryptoKey = await crypto.subtle.importKey(
      'spki',
      keyBuffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signatureBytes,
      payloadBytes,
    );

    if (!valid) {
      return { valid: false, message: 'Invalid license key.' };
    }

    const payloadJson = new TextDecoder().decode(fromBase64Url(payloadB64));
    const payload = JSON.parse(payloadJson);

    if (payload.product !== 'myloopio-full') {
      return { valid: false, message: 'License is not valid for this product.' };
    }

    return {
      valid: true,
      licensee: payload.licensee,
      issuedAt: payload.issuedAt,
      message: 'License activated successfully.',
    };
  } catch {
    return { valid: false, message: 'Invalid license key.' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ valid: false, message: 'Method not allowed.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  let body: { key?: string; deviceId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ valid: false, message: 'Invalid request body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const key = typeof body?.key === 'string' ? body.key.trim() : '';
  if (!key) {
    return new Response(JSON.stringify({ valid: false, message: 'License key is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const result = await verifyLicense(key);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
});
