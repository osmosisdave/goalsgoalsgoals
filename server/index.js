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
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db();
    usersCollection = db.collection('users');
    console.log('Connected to MongoDB');
  } catch (e) {
    console.error('Failed to connect to MongoDB', e);
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
    const docs = await usersCollection.find({}, { projection: { _id: 0, username: 1, role: 1 } }).toArray();
    // return array of { username, role }
    return docs.map((d) => ({ username: d.username, role: d.role }));
  }
  await ensureUsersFile();
  const data = await fs.readJson(USERS_FILE);
  return data.users || [];
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
    if (users.length) await usersCollection.insertMany(users.map((u) => ({ username: u.username, passwordHash: u.passwordHash, role: u.role })));
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
app.use(cors());
app.use(bodyParser.json());

// Serve the static site from the parent folder for local development
const staticRoot = path.join(__dirname, '..');
app.use(express.static(staticRoot));

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
  res.json(users.map((u) => ({ username: u.username, role: u.role })));
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
  res.json(users.map((u) => ({ username: u.username, role: u.role })));
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
