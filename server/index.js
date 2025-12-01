const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');

// Load .env into process.env when present (for local development)
try {
  require('dotenv').config();
} catch (e) {
  // dotenv is optional at runtime; if it's not installed, environment variables
  // can still be provided by the host.
}

const USERS_FILE = path.join(__dirname, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// MongoDB support (optional). If MONGODB_URI is set, use MongoDB; otherwise fallback to file store.
const MONGODB_URI = process.env.MONGODB_URI || null;
let mongoClient = null;
let usersCollection = null;

async function connectMongo() {
  if (!MONGODB_URI) return;
  try {
    const { MongoClient } = require('mongodb');
    // Use modern topology and enable TLS to ensure Atlas connections
    // negotiate correctly on hosting platforms like Render.
    mongoClient = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true, tls: true });
    await mongoClient.connect();
    const db = mongoClient.db();
    usersCollection = db.collection('users');
    console.log('Connected to MongoDB');
  } catch (e) {
    console.error('Failed to connect to MongoDB — connection error details follow:');
    console.error(e && e.stack ? e.stack : e);
    // If the connection failed and the operator enabled the debug bypass
    // via env var, try again with invalid-certificate allowance to help
    // determine whether certificate validation is the root cause.
    if (process.env.DEBUG_ALLOW_TLS_BYPASS === 'true') {
      console.warn('DEBUG_ALLOW_TLS_BYPASS=true — attempting secondary connect with tlsAllowInvalidCertificates (diagnostic only)');
      try {
        const { MongoClient: MC2 } = require('mongodb');
        const fallbackClient = new MC2(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true, tls: true, tlsAllowInvalidCertificates: true, tlsAllowInvalidHostnames: true });
        await fallbackClient.connect();
        const db2 = fallbackClient.db();
        usersCollection = db2.collection('users');
        mongoClient = fallbackClient;
        console.warn('Secondary connect succeeded with tlsAllowInvalidCertificates=true — certificate validation appears to be the blocker.');
        return;
      } catch (err2) {
        console.error('Secondary diagnostic connect also failed:');
        console.error(err2 && err2.stack ? err2.stack : err2);
      }
    }
    mongoClient = null;
    usersCollection = null;
  }
}

async function ensureUsersFile() {
  const exists = await fs.pathExists(USERS_FILE);
  if (!exists) {
    // create an empty users file. Admins should be created explicitly
    // using the `create_admin.js` utility or via the admin UI.
    const initial = { users: [] };
    await fs.writeJson(USERS_FILE, initial, { spaces: 2 });
    console.log('Created empty users.json (no default admin). Use create_admin.js to add an admin.');
  }
}

async function readUsers() {
  if (usersCollection) {
    const docs = await usersCollection.find({}, { projection: { _id: 0, username: 1, role: 1, league: 1 } }).toArray();
    // return array of { username, role, league }
    return docs.map((d) => ({ username: d.username, role: d.role, league: d.league || null }));
  }
  await ensureUsersFile();
  const data = await fs.readJson(USERS_FILE);
  // Ensure each user has explicit league key (may be undefined)
  return (data.users || []).map((u) => ({ username: u.username, role: u.role, league: u.league || null, passwordHash: u.passwordHash }));
}

async function getUserForAuth(username) {
  if (usersCollection) {
    return await usersCollection.findOne({ username });
  }
  await ensureUsersFile();
  const data = await fs.readJson(USERS_FILE);
  return (data.users || []).find((u) => u.username === username);
}

async function writeUsers(users) {
  if (usersCollection) {
    // replace collection contents (used rarely)
    await usersCollection.deleteMany({});
    if (users.length) await usersCollection.insertMany(users.map((u) => ({ username: u.username, passwordHash: u.passwordHash, role: u.role, league: u.league || null })));
    return;
  }
  await fs.writeJson(USERS_FILE, { users }, { spaces: 2 });
}

async function createUserInStore({ username, passwordHash, role }) {
  if (usersCollection) {
    await usersCollection.insertOne({ username, passwordHash, role });
    return;
  }
  await ensureUsersFile();
  const data = await fs.readJson(USERS_FILE);
  data.users = data.users || [];
  data.users.push({ username, passwordHash, role });
  await fs.writeJson(USERS_FILE, data, { spaces: 2 });
}

// Leagues store (Mongo collection 'leagues' or file fallback)
const LEAGUES_FILE = path.join(__dirname, 'leagues.json');

async function ensureLeaguesFile() {
  const exists = await fs.pathExists(LEAGUES_FILE);
  if (!exists) {
    await fs.writeJson(LEAGUES_FILE, { leagues: [] }, { spaces: 2 });
  }
}

async function readLeagues() {
  if (mongoClient) {
    try {
      const db = mongoClient.db();
      const coll = db.collection('leagues');
      const docs = await coll.find({}, { projection: { _id: 0, name: 1 } }).toArray();
      return docs.map((d) => d.name);
    } catch (e) {
      console.error('Error reading leagues from MongoDB', e && e.stack ? e.stack : e);
    }
  }
  await ensureLeaguesFile();
  const data = await fs.readJson(LEAGUES_FILE);
  return data.leagues || [];
}

async function createLeagueInStore(name) {
  if (!name) throw new Error('Missing league name');
  if (mongoClient) {
    const db = mongoClient.db();
    const coll = db.collection('leagues');
    const existing = await coll.findOne({ name });
    if (existing) return false;
    await coll.insertOne({ name });
    return true;
  }
  await ensureLeaguesFile();
  const data = await fs.readJson(LEAGUES_FILE);
  data.leagues = data.leagues || [];
  if (data.leagues.includes(name)) return false;
  data.leagues.push(name);
  await fs.writeJson(LEAGUES_FILE, data, { spaces: 2 });
  return true;
}

async function deleteLeagueInStore(name) {
  if (!name) throw new Error('Missing league name');
  if (mongoClient) {
    const db = mongoClient.db();
    const coll = db.collection('leagues');
    await coll.deleteOne({ name });
    // unset league for users
    if (usersCollection) {
      await usersCollection.updateMany({ league: name }, { $unset: { league: '' } });
    } else {
      // file fallback: update users.json
      await ensureUsersFile();
      const data = await fs.readJson(USERS_FILE);
      data.users = (data.users || []).map((u) => (u.league === name ? Object.assign({}, u, { league: null }) : u));
      await fs.writeJson(USERS_FILE, data, { spaces: 2 });
    }
    return true;
  }
  await ensureLeaguesFile();
  const data = await fs.readJson(LEAGUES_FILE);
  data.leagues = (data.leagues || []).filter((l) => l !== name);
  await fs.writeJson(LEAGUES_FILE, data, { spaces: 2 });
  // update users file
  await ensureUsersFile();
  const udata = await fs.readJson(USERS_FILE);
  udata.users = (udata.users || []).map((u) => (u.league === name ? Object.assign({}, u, { league: null }) : u));
  await fs.writeJson(USERS_FILE, udata, { spaces: 2 });
  return true;
}



function createToken(user) {
  return jwt.sign({ sub: user.username, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

const app = express();
// Configure CORS to allow only the frontend origin. Use ALLOWED_ORIGIN env var
// in production; fallback to the deployed Pages origin for convenience.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://goalsgoalsgoals.onrender.com';
if (ALLOWED_ORIGIN) {
  app.use(cors({ origin: ALLOWED_ORIGIN }));
} else {
  app.use(cors());
}
app.use(bodyParser.json());

// Serve the static site from the parent folder for local development
const staticRoot = path.join(__dirname, '..');
app.use(express.static(staticRoot));

// Admin-only: update a user's league assignment
app.put('/api/users/:username/league', async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer /i, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const username = req.params.username;
  const { league } = req.body || {};
  if (!username) return res.status(400).json({ error: 'Missing username' });

  if (usersCollection) {
    const existing = await usersCollection.findOne({ username });
    if (!existing) return res.status(404).json({ error: 'User not found' });
    await usersCollection.updateOne({ username }, { $set: { league: league || null } });
    return res.json({ username, league: league || null });
  }

  // File store
  await ensureUsersFile();
  const data = await fs.readJson(USERS_FILE);
  data.users = data.users || [];
  const idx = data.users.findIndex((u) => u.username === username);
  if (idx < 0) return res.status(404).json({ error: 'User not found' });
  data.users[idx].league = league || null;
  await fs.writeJson(USERS_FILE, data, { spaces: 2 });
  return res.json({ username, league: league || null });
});

// Public: list leagues
app.get('/api/leagues', async (req, res) => {
  try {
    const leagues = await readLeagues();
    res.json(leagues);
  } catch (e) {
    console.error('Failed to list leagues', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'Failed to list leagues' });
  }
});

// Admin-only: create a league
app.post('/api/leagues', async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer /i, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Missing league name' });
  try {
    const created = await createLeagueInStore(name);
    if (!created) return res.status(409).json({ error: 'League exists' });
    res.status(201).json({ name });
  } catch (e) {
    console.error('Failed to create league', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'Failed to create league' });
  }
});

// Admin-only: delete a league
app.delete('/api/leagues/:name', async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer /i, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const name = req.params.name;
  if (!name) return res.status(400).json({ error: 'Missing league name' });
  try {
    await deleteLeagueInStore(name);
    res.json({ name });
  } catch (e) {
    console.error('Failed to delete league', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'Failed to delete league' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  const user = await getUserForAuth(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = createToken(user);
  res.json({ token });
});

// Return current user info
app.get('/api/me', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer /i, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ username: decoded.sub, role: decoded.role });
});

// Protected: list users (admin-only)
app.get('/api/users', async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer /i, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const users = await readUsers();
  res.json(users.map((u) => ({ username: u.username, role: u.role, league: u.league || null })));
});

// Protected: create user (admin-only)
app.post('/api/users', async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer /i, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { username, password, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  const existing = await getUserForAuth(username);
  if (existing) return res.status(409).json({ error: 'User exists' });
  const hash = await bcrypt.hash(password, 10);
  await createUserInStore({ username, passwordHash: hash, role: role || 'user' });
  res.status(201).json({ username, role: role || 'user' });
});

// Safe readonly alias for admin UI (returns username + role only)
app.get('/api/admin/users', async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer /i, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const users = await readUsers();
  res.json(users.map((u) => ({ username: u.username, role: u.role, league: u.league || null })));
});

const port = process.env.PORT || 4000;

(async function start() {
  try {
    await connectMongo();
  } catch (e) {
    console.error('Error during MongoDB connect attempt', e);
  }

  const server = app.listen(port, () => {
    console.log('Auth server listening on port', port);
    if (usersCollection) {
      console.log('Using MongoDB for user store');
    } else {
      console.log('Using file store for users');
    }
    ensureUsersFile().catch((e) => console.error('Failed to ensure users file', e));
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Another process is listening on this port.`);
      console.error('Tip: stop the other process or set a different PORT environment variable before restarting.');
      process.exit(1);
    }
    console.error('Server error:', err);
  });
})();
