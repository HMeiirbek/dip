/**
 * Generate self-signed SSL certificate for backend HTTPS (LAN/mobile access).
 * Run once: node scripts/generate-certs.js
 * Certificates are saved to backend/certs/
 */
const fs = require('fs');
const path = require('path');

function generateCerts() {
  let selfsigned;
  try {
    selfsigned = require('selfsigned');
  } catch (e) {
    console.error('Install the selfsigned package first: npm install --save-dev selfsigned');
    process.exit(1);
  }

  const certsDir = path.join(__dirname, '..', 'certs');
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
  }

  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const options = { keySize: 2048, days: 365 };
  const pems = selfsigned.generate(attrs, options);

  const keyPath = path.join(certsDir, 'key.pem');
  const certPath = path.join(certsDir, 'cert.pem');
  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);

  console.log('Self-signed certificate generated:');
  console.log(' ', keyPath);
  console.log(' ', certPath);
  console.log('Restart the backend to use HTTPS.');
}

generateCerts();
