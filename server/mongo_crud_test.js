// Mongo CRUD end-to-end test: users + leagues with MongoDB enabled
// Requires server running on http://localhost:4000 and server/.env set with MONGODB_URI and admin password.
// Steps:
// 1) Login as admin using INIT_ADMIN_PASS or ADMIN_PASS
// 2) Create a league
// 3) Create a user
// 4) Assign user to league
// 5) Verify user appears with league
// 6) Delete league and verify user's league is null

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fetch = global.fetch || require('node-fetch');

(async function main() {
  const base = 'http://localhost:4000';
  const adminUser = 'admin';
  const adminPass = process.env.INIT_ADMIN_PASS || process.env.ADMIN_PASS || 'admin123';
  const ts = Date.now();
  const leagueName = `test-league-${ts}`;
  const testUser = `testuser_${ts}`;
  const testPass = 'p@ssw0rd';

  function assert(cond, msg) {
    if (!cond) {
      console.error('ASSERTION FAILED:', msg);
      process.exit(1);
    }
  }

  try {
    console.log('Logging in as admin...');
    const loginRes = await fetch(base + '/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: adminUser, password: adminPass })
    });
    assert(loginRes.ok, 'Admin login failed');
    const { token } = await loginRes.json();
    assert(token, 'No token returned from login');

    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    console.log('Creating league:', leagueName);
    const createLeague = await fetch(base + '/api/leagues', { method: 'POST', headers: auth, body: JSON.stringify({ name: leagueName }) });
    assert(createLeague.ok || createLeague.status === 409, 'Create league failed');

    console.log('Creating user:', testUser);
    const createUser = await fetch(base + '/api/users', { method: 'POST', headers: auth, body: JSON.stringify({ username: testUser, password: testPass, role: 'user' }) });
    assert(createUser.ok || createUser.status === 409, 'Create user failed');

    console.log('Assigning user to league');
    const assign = await fetch(base + `/api/users/${encodeURIComponent(testUser)}/league`, { method: 'PUT', headers: auth, body: JSON.stringify({ league: leagueName }) });
    assert(assign.ok, 'Assign league failed');

    console.log('Listing users and verifying...');
    const list = await fetch(base + '/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
    assert(list.ok, 'List users failed');
    const users = await list.json();
    const found = users.find(u => u.username === testUser);
    assert(found, 'Created user not found in list');
    assert(found.league === leagueName, 'User league not set correctly');

    console.log('Deleting league:', leagueName);
    const del = await fetch(base + `/api/leagues/${encodeURIComponent(leagueName)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    assert(del.ok, 'Delete league failed');

    console.log('Verifying user league unset...');
    const list2 = await fetch(base + '/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
    assert(list2.ok, 'List users after delete failed');
    const users2 = await list2.json();
    const found2 = users2.find(u => u.username === testUser);
    assert(found2, 'User missing after league delete');
    assert(found2.league === null || found2.league === undefined, 'User league was not unset after league deletion');

    console.log('Mongo CRUD test passed.');
    process.exit(0);
  } catch (e) {
    console.error('Mongo CRUD test error:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
})();
