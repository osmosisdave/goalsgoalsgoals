const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');
const apiRateLimiter = require('./api-rate-limiter');

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
// Configure CORS to allow both local development and production origins
// Set ALLOWED_ORIGIN env var to override (can be comma-separated list)
const allowedOrigins = process.env.ALLOWED_ORIGIN 
  ? process.env.ALLOWED_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:8000', 'https://goalsgoalsgoals.onrender.com'];

app.use(cors({ 
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true 
}));
app.use(bodyParser.json());

// Refuse to start in production without a strong JWT secret
if (!process.env.JWT_SECRET || JWT_SECRET === 'dev_secret_change_me') {
  console.warn('Warning: JWT_SECRET is not set or using a weak default.');
  if (process.env.NODE_ENV === 'production') {
    console.error('In production, JWT_SECRET must be provided. Exiting.');
    process.exit(1);
  }
}

// Serve the static site from the parent folder for local development
const staticRoot = path.join(__dirname, '..');
// Explicitly block access to the server/ folder and sensitive files when using static serving
app.use('/server', (req, res) => res.status(404).send('Not found'));
app.get(['/admin.token', '/server/users.json', '/server/leagues.json'], (req, res) => res.status(404).send('Not found'));
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
  const hash = await bcrypt.hash(password, 12);
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

// ===== API Rate Limiter Endpoints =====

// Get current API usage status (public)
app.get('/api/rate-limit/status', async (req, res) => {
  try {
    const status = await apiRateLimiter.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    res.status(500).json({ error: 'Failed to get rate limit status' });
  }
});

// Get detailed analytics (admin only)
app.get('/api/rate-limit/analytics', async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer /i, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  try {
    const analytics = await apiRateLimiter.getAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Reset rate limiter (admin only, for testing)
app.post('/api/rate-limit/reset', async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer /i, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  try {
    await apiRateLimiter.reset();
    res.json({ message: 'Rate limiter reset successfully' });
  } catch (error) {
    console.error('Error resetting rate limiter:', error);
    res.status(500).json({ error: 'Failed to reset rate limiter' });
  }
});

// Mock external API call endpoint (for testing rate limiting)
app.post('/api/football/fixtures', async (req, res) => {
  try {
    // Check rate limit
    const canProceed = await apiRateLimiter.canMakeCall();
    
    if (!canProceed) {
      const status = await apiRateLimiter.getStatus();
      return res.status(429).json({
        error: 'API rate limit reached',
        message: `You have reached the weekly limit of ${status.softLimit} API calls. The limit will reset when the oldest call expires.`,
        status: {
          count: status.count,
          limit: status.softLimit,
          oldestCallExpiry: status.oldestCallExpiry
        }
      });
    }

    // Get user from token (optional)
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer /i, '');
    const decoded = verifyToken(token);
    const user = decoded ? decoded.sub : 'anonymous';

    // Record the API call
    await apiRateLimiter.recordCall('/football/fixtures', user, req.body);

    // Simulate API response (in production, this would call the real API)
    res.json({
      message: 'API call successful (mocked)',
      data: {
        fixtures: [],
        // Mock response data would go here
      },
      rateLimitStatus: await apiRateLimiter.getStatus()
    });
  } catch (error) {
    console.error('Error in mock API call:', error);
    res.status(500).json({ error: 'API call failed' });
  }
});

// Mock standings API endpoint
app.post('/api/football/standings', async (req, res) => {
  try {
    const canProceed = await apiRateLimiter.canMakeCall();
    
    if (!canProceed) {
      const status = await apiRateLimiter.getStatus();
      return res.status(429).json({
        error: 'API rate limit reached',
        message: `You have reached the weekly limit of ${status.softLimit} API calls.`,
        status
      });
    }

    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer /i, '');
    const decoded = verifyToken(token);
    const user = decoded ? decoded.sub : 'anonymous';

    await apiRateLimiter.recordCall('/football/standings', user, req.body);

    res.json({
      message: 'API call successful (mocked)',
      data: { standings: [] },
      rateLimitStatus: await apiRateLimiter.getStatus()
    });
  } catch (error) {
    console.error('Error in mock API call:', error);
    res.status(500).json({ error: 'API call failed' });
  }
});

// Get fixtures from database (supports filtering by league, season, date, status)
app.get('/api/football/fixtures', async (req, res) => {
  try {
    if (!mongoClient) {
      return res.status(503).json({ error: 'Database not connected', message: 'MongoDB is not available. Please check MONGODB_URI in .env' });
    }

    const db = mongoClient.db('goalsgoalsgoals');
    const query = {};
    
    // Filter by league
    if (req.query.league) {
      query['league.id'] = parseInt(req.query.league);
    }
    
    // Filter by season
    if (req.query.season) {
      query['league.season'] = parseInt(req.query.season);
    }
    
    // Filter by status (NS, 1H, 2H, FT, etc.)
    if (req.query.status) {
      query['fixture.status.short'] = req.query.status;
    }
    
    // Filter by date range
    if (req.query.from || req.query.to) {
      query['fixture.date'] = {};
      if (req.query.from) query['fixture.date'].$gte = req.query.from;
      if (req.query.to) query['fixture.date'].$lte = req.query.to;
    }
    
    const fixtures = await db.collection('fixtures')
      .find(query)
      .sort({ 'fixture.date': 1 })
      .limit(100)
      .toArray();
    
    res.json({
      get: 'fixtures',
      parameters: req.query,
      errors: [],
      results: fixtures.length,
      response: fixtures
    });
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    res.status(500).json({ error: 'Failed to fetch fixtures', message: error.message });
  }
});

// Get standings from database
app.get('/api/football/standings', async (req, res) => {
  try {
    if (!mongoClient) {
      return res.status(503).json({ error: 'Database not connected', message: 'MongoDB is not available. Please check MONGODB_URI in .env' });
    }

    const db = mongoClient.db('goalsgoalsgoals');
    const query = {};
    
    // Filter by league (required for standings)
    if (req.query.league) {
      query['league.id'] = parseInt(req.query.league);
    } else {
      return res.status(400).json({ error: 'Missing parameter', message: 'league parameter is required' });
    }
    
    // Filter by season
    if (req.query.season) {
      query['league.season'] = parseInt(req.query.season);
    }
    
    const standingsDoc = await db.collection('standings').findOne(query);
    
    if (!standingsDoc) {
      return res.json({
        get: 'standings',
        parameters: req.query,
        errors: [],
        results: 0,
        response: []
      });
    }
    
    res.json({
      get: 'standings',
      parameters: req.query,
      errors: [],
      results: 1,
      response: [{
        league: standingsDoc.league,
        standings: standingsDoc.standings
      }]
    });
  } catch (error) {
    console.error('Error fetching standings:', error);
    res.status(500).json({ error: 'Failed to fetch standings', message: error.message });
  }
});

// Get teams from database
app.get('/api/football/teams', async (req, res) => {
  try {
    if (!mongoClient) {
      return res.status(503).json({ error: 'Database not connected', message: 'MongoDB is not available. Please check MONGODB_URI in .env' });
    }

    const db = mongoClient.db('goalsgoalsgoals');
    const query = {};
    
    // Filter by team ID
    if (req.query.id) {
      query.id = parseInt(req.query.id);
    }
    
    // Filter by league (would need to add league association to teams)
    if (req.query.league) {
      // For now, just return all teams since our seed data is Premier League only
    }
    
    const teams = await db.collection('teams')
      .find(query)
      .sort({ name: 1 })
      .toArray();
    
    res.json({
      get: 'teams',
      parameters: req.query,
      errors: [],
      results: teams.length,
      response: teams.map(t => ({ team: t }))
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams', message: error.message });
  }
});

// Select a match (user claims a match)
app.post('/api/matches/:fixtureId/select', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer /i, '');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in to select a match' });
    }
    
    const username = decoded.sub || decoded.username;
    const fixtureId = parseInt(req.params.fixtureId);
    
    if (!mongoClient) {
      return res.status(503).json({ error: 'Database not connected', message: 'MongoDB is not available' });
    }
    
    const db = mongoClient.db('goalsgoalsgoals');
    
    // Check if fixture exists and is upcoming (NS status)
    const fixture = await db.collection('fixtures').findOne({
      'fixture.id': fixtureId,
      'fixture.status.short': 'NS'
    });
    
    if (!fixture) {
      return res.status(404).json({ error: 'Fixture not found', message: 'Fixture not found or not available for selection' });
    }
    
    // Check if match is already selected by someone else
    const existing = await db.collection('match_selections').findOne({ fixtureId });
    
    if (existing && existing.username !== username) {
      return res.status(409).json({ 
        error: 'Match already selected', 
        message: `This match has already been selected by ${existing.username}`,
        selectedBy: existing.username
      });
    }
    
    // Check if user already has a selection for a different upcoming match
    const userExistingSelection = await db.collection('match_selections').findOne({ 
      username,
      fixtureId: { $ne: fixtureId } // Different match
    });
    
    let replacedMatch = null;
    if (userExistingSelection) {
      // Remove the old selection
      await db.collection('match_selections').deleteOne({ 
        username,
        fixtureId: userExistingSelection.fixtureId
      });
      replacedMatch = {
        homeTeam: userExistingSelection.homeTeam,
        awayTeam: userExistingSelection.awayTeam
      };
    }
    
    // Save or update selection with additional metadata for future archival
    await db.collection('match_selections').updateOne(
      { fixtureId },
      { 
        $set: { 
          username, 
          fixtureId,
          selectedAt: new Date(),
          homeTeam: fixture.teams.home.name,
          awayTeam: fixture.teams.away.name,
          date: fixture.fixture.date,
          leagueId: fixture.league.id,
          leagueName: fixture.league.name,
          round: fixture.league.round,
          season: fixture.league.season,
          status: fixture.fixture.status.short
        } 
      },
      { upsert: true }
    );
    
    res.json({
      success: true,
      message: replacedMatch 
        ? `Match selection updated. Previous selection (${replacedMatch.homeTeam} vs ${replacedMatch.awayTeam}) removed.`
        : 'Match selected successfully',
      replaced: !!replacedMatch,
      selection: {
        fixtureId,
        username,
        homeTeam: fixture.teams.home.name,
        awayTeam: fixture.teams.away.name
      }
    });
  } catch (error) {
    console.error('Error selecting match:', error);
    res.status(500).json({ error: 'Failed to select match', message: error.message });
  }
});

// Get all match selections
app.get('/api/matches/selections', async (req, res) => {
  try {
    if (!mongoClient) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const db = mongoClient.db('goalsgoalsgoals');
    const selections = await db.collection('match_selections').find({}).toArray();
    
    res.json({
      success: true,
      selections
    });
  } catch (error) {
    console.error('Error fetching selections:', error);
    res.status(500).json({ error: 'Failed to fetch selections', message: error.message });
  }
});

// Unselect a match (user removes their selection)
app.delete('/api/matches/:fixtureId/select', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer /i, '');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const username = decoded.sub || decoded.username;
    const fixtureId = parseInt(req.params.fixtureId);
    
    if (!mongoClient) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const db = mongoClient.db('goalsgoalsgoals');
    
    // Only allow users to remove their own selection
    const result = await db.collection('match_selections').deleteOne({ 
      fixtureId, 
      username 
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Selection not found or not yours to remove' });
    }
    
    res.json({
      success: true,
      message: 'Match selection removed'
    });
  } catch (error) {
    console.error('Error removing selection:', error);
    res.status(500).json({ error: 'Failed to remove selection', message: error.message });
  }
});

// Archive finished match selections
app.post('/api/matches/archive-finished', async (req, res) => {
  try {
    if (!mongoClient) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const db = mongoClient.db('goalsgoalsgoals');
    
    // Get all current selections
    const selections = await db.collection('match_selections').find({}).toArray();
    
    if (selections.length === 0) {
      return res.json({ success: true, archived: 0, message: 'No selections to check' });
    }

    // Get all fixture IDs from selections
    const fixtureIds = selections.map(s => s.fixtureId);
    
    // Get fixtures from database
    const fixtures = await db.collection('fixtures').find({
      'fixture.id': { $in: fixtureIds }
    }).toArray();

    // Create a map of fixture statuses
    const fixtureMap = new Map(fixtures.map(f => [f.fixture.id, f]));

    let archived = 0;
    const bulkArchive = [];
    const selectionsToRemove = [];

    // Check each selection
    for (const selection of selections) {
      const fixture = fixtureMap.get(selection.fixtureId);
      
      if (fixture && fixture.fixture.status.short === 'FT') {
        // Match is finished - archive it
        const archiveRecord = {
          ...selection,
          archivedAt: new Date(),
          finalScore: {
            home: fixture.goals.home,
            away: fixture.goals.away
          },
          matchStatus: fixture.fixture.status.long,
          // Ensure we have round/league info (might be missing in old records)
          round: selection.round || fixture.league.round,
          leagueName: selection.leagueName || fixture.league.name,
          season: selection.season || fixture.league.season
        };
        
        bulkArchive.push(archiveRecord);
        selectionsToRemove.push(selection.fixtureId);
        archived++;
      }
    }

    // Perform bulk operations
    if (bulkArchive.length > 0) {
      await db.collection('match_selection_history').insertMany(bulkArchive);
      await db.collection('match_selections').deleteMany({
        fixtureId: { $in: selectionsToRemove }
      });
    }

    res.json({
      success: true,
      archived,
      message: `Archived ${archived} finished match selection${archived !== 1 ? 's' : ''}`
    });
  } catch (error) {
    console.error('Error archiving finished matches:', error);
    res.status(500).json({ error: 'Failed to archive finished matches', message: error.message });
  }
});

// Get match selection history
app.get('/api/matches/history', async (req, res) => {
  try {
    if (!mongoClient) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const db = mongoClient.db('goalsgoalsgoals');
    const username = req.query.username;
    
    const query = username ? { username } : {};
    const history = await db.collection('match_selection_history')
      .find(query)
      .sort({ archivedAt: -1 })
      .toArray();

    res.json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history', message: error.message });
  }
});

// Function to automatically archive finished matches
async function archiveFinishedMatches() {
  if (!mongoClient) return;
  
  try {
    const db = mongoClient.db('goalsgoalsgoals');
    
    // Get all current selections
    const selections = await db.collection('match_selections').find({}).toArray();
    
    if (selections.length === 0) return;

    // Get all fixture IDs from selections
    const fixtureIds = selections.map(s => s.fixtureId);
    
    // Get fixtures from database
    const fixtures = await db.collection('fixtures').find({
      'fixture.id': { $in: fixtureIds }
    }).toArray();

    // Create a map of fixture statuses
    const fixtureMap = new Map(fixtures.map(f => [f.fixture.id, f]));

    const bulkArchive = [];
    const selectionsToRemove = [];

    // Check each selection
    for (const selection of selections) {
      const fixture = fixtureMap.get(selection.fixtureId);
      
      if (fixture && fixture.fixture.status.short === 'FT') {
        // Match is finished - archive it
        const archiveRecord = {
          ...selection,
          archivedAt: new Date(),
          finalScore: {
            home: fixture.goals.home,
            away: fixture.goals.away
          },
          matchStatus: fixture.fixture.status.long,
          round: selection.round || fixture.league.round,
          leagueName: selection.leagueName || fixture.league.name,
          season: selection.season || fixture.league.season
        };
        
        bulkArchive.push(archiveRecord);
        selectionsToRemove.push(selection.fixtureId);
      }
    }

    // Perform bulk operations
    if (bulkArchive.length > 0) {
      await db.collection('match_selection_history').insertMany(bulkArchive);
      await db.collection('match_selections').deleteMany({
        fixtureId: { $in: selectionsToRemove }
      });
      console.log(`✓ Auto-archived ${bulkArchive.length} finished match selection(s)`);
    }
  } catch (error) {
    console.error('Error in auto-archive:', error);
  }
}

const port = process.env.PORT || 4000;

(async function start() {
  try {
    await connectMongo();
    // Initialize API rate limiter with optional MongoDB support
    await apiRateLimiter.initialize(mongoClient);
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
