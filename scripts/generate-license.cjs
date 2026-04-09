const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const privateKeyPath = path.join(__dirname, '..', 'private', 'license-private.pem');
const privateKey = fs.readFileSync(privateKeyPath, 'utf-8');

function toBase64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const licensee = process.argv[2] || 'Customer';
const orderId = process.argv[3] || `ORDER-${Date.now()}`;
const payload = {
  product: 'myloopio-full',
  licensee,
  orderId,
  issuedAt: new Date().toISOString(),
};

const payloadB64 = toBase64Url(JSON.stringify(payload));
const signer = crypto.createSign('RSA-SHA256');
signer.update(payloadB64);
signer.end();
const signatureB64 = signer
  .sign(privateKey)
  .toString('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');
const key = `ML1.${payloadB64}.${signatureB64}`;

console.log('\nMyLoopio full license generated:\n');
console.log(key);
console.log('\nLicensee:', licensee);
console.log('Order ID:', orderId);
