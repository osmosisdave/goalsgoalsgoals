#!/usr/bin/env node
// Diagnostic script to test MongoDB TLS/connect options from the running host.
// Usage (on Render shell):
//   node server/test_mongo_connect.js
// It will read MONGODB_URI from the environment and try a strict TLS connect,
// then (for diagnosis only) try with tlsAllowInvalidCertificates to determine
// whether the failure is certificate-validation related.

try { require('dotenv').config(); } catch (e) {}
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set in the environment.');
  process.exit(2);
}

async function tryConnect(opts) {
  const client = new MongoClient(uri, Object.assign({ useNewUrlParser: true, useUnifiedTopology: true }, opts));
  try {
    await client.connect();
    await client.db().command({ ping: 1 });
    console.log('SUCCESS: connected with options:', opts);
    await client.close();
    return true;
  } catch (err) {
    console.error('FAIL: connect with options:', opts);
    console.error(err && err.stack ? err.stack : err);
    try { await client.close(); } catch (e) {}
    return false;
  }
}

(async function main() {
  console.log('Attempting strict TLS connection...');
  let ok = await tryConnect({ tls: true });
  if (ok) return process.exit(0);

  console.log('\nStrict TLS failed. Trying with tlsAllowInvalidCertificates (diagnostic only)...');
  await tryConnect({ tls: true, tlsAllowInvalidCertificates: true, tlsAllowInvalidHostnames: true });
  process.exit(0);
})();
