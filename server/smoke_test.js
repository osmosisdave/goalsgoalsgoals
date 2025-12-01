// Smoke test: log in as admin and call /api/me and /api/admin/users
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fetch = global.fetch || require('node-fetch');
const fs = require('fs');
(async function(){
  const env = process.env;
  const adminUser = 'admin';
  const adminPass = env.INIT_ADMIN_PASS || env.ADMIN_PASS;
  if (!adminPass) {
    console.error('No admin password found in server/.env (INIT_ADMIN_PASS or ADMIN_PASS). Aborting smoke test.');
    process.exit(1);
  }
  try {
    console.log('Attempting login as admin...');
    const loginRes = await fetch('http://localhost:4000/api/login', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: adminUser, password: adminPass })
    });
    if (!loginRes.ok) {
      const txt = await loginRes.text();
      console.error('Login failed:', txt);
      process.exit(1);
    }
    const { token } = await loginRes.json();
    if (!token) {
      console.error('Login did not return a token.');
      process.exit(1);
    }
    console.log('Login succeeded. Token acquired (not displayed).');

    // /api/me
    const meRes = await fetch('http://localhost:4000/api/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!meRes.ok) { console.error('/api/me failed', await meRes.text()); process.exit(1); }
    const me = await meRes.json();
    console.log('/api/me returned:', { username: me.username, role: me.role });

    // /api/admin/users
    const usersRes = await fetch('http://localhost:4000/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
    if (!usersRes.ok) { console.error('/api/admin/users failed', await usersRes.text()); process.exit(1); }
    const users = await usersRes.json();
    console.log('/api/admin/users returned', users.length, 'users');
    users.forEach(u => console.log(`- ${u.username} (${u.role})`));

    console.log('Smoke test passed.');
  } catch (e) {
    console.error('Smoke test error:', e.message || e);
    process.exit(1);
  }
})();
