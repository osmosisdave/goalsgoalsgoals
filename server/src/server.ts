import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as fs from 'fs-extra';
import * as path from 'path';
import cors from 'cors';
import { MongoClient, Collection, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import apiRateLimiter from './api-rate-limiter';

// Load .env into process.env when present (for local development)
try {
  dotenv.config();
} catch (e) {
  // dotenv is optional at runtime
}

// Interfaces
interface User {
  username: string;
  passwordHash: string;
  role: string;
  league?: string | null;
}

interface JWTPayload {
  sub: string;
  role: string;
  iat?: number;
  exp?: number;
}

interface SyncFixturesRequest {
  season?: number;
  dateRange?: number;
}

interface MatchSelection {
  username: string;
  fixtureId: number;
  selectedAt: Date;
  homeTeam: string;
  awayTeam: string;
  date: string;
  leagueId: number;
  leagueName: string;
  round: string;
  season: number;
  status: string;
}

// Configuration
const USERS_FILE = path.join(__dirname, '..', 'users.json');
const LEAGUES_FILE = path.join(__dirname, '..', 'leagues.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const MONGODB_URI = process.env.MONGODB_URI || null;

// Global state
let mongoClient: MongoClient | null = null;
let usersCollection: Collection<User> | null = null;

// MongoDB connection
async function connectMongo(): Promise<void> {
  if (!MONGODB_URI) return;
  try {
    mongoClient = new MongoClient(MONGODB_URI, {
      tls: true,
    });
    await mongoClient.connect();
    const db = mongoClient.db();
    usersCollection = db.collection<User>('users');
    console.log('Connected to MongoDB');
  } catch (e: any) {
    console.error('Failed to connect to MongoDB — connection error details follow:');
    console.error(e && e.stack ? e.stack : e);
    
    if (process.env.DEBUG_ALLOW_TLS_BYPASS === 'true') {
      console.warn('DEBUG_ALLOW_TLS_BYPASS=true — attempting secondary connect with tlsAllowInvalidCertificates (diagnostic only)');
      try {
        const fallbackClient = new MongoClient(MONGODB_URI, {
          tls: true,
          tlsAllowInvalidCertificates: true,
          tlsAllowInvalidHostnames: true,
        });
        await fallbackClient.connect();
        const db2 = fallbackClient.db();
        usersCollection = db2.collection<User>('users');
        mongoClient = fallbackClient;
        console.warn('Secondary connect succeeded with tlsAllowInvalidCertificates=true — certificate validation appears to be the blocker.');
        return;
      } catch (err2: any) {
        console.error('Secondary diagnostic connect also failed:');
        console.error(err2 && err2.stack ? err2.stack : err2);
      }
    }
    mongoClient = null;
    usersCollection = null;
  }
}

// File operations
async function ensureUsersFile(): Promise<void> {
  const exists = await fs.pathExists(USERS_FILE);
  if (!exists) {
    const initial = { users: [] };
    await fs.writeJson(USERS_FILE, initial, { spaces: 2 });
    console.log('Created empty users.json (no default admin). Use create_admin.js to add an admin.');
  }
}

async function ensureLeaguesFile(): Promise<void> {
  const exists = await fs.pathExists(LEAGUES_FILE);
  if (!exists) {
    await fs.writeJson(LEAGUES_FILE, { leagues: [] }, { spaces: 2 });
  }
}

// User operations
async function readUsers(): Promise<User[]> {
  if (usersCollection) {
    const docs = await usersCollection
      .find({}, { projection: { _id: 0, username: 1, role: 1, league: 1, passwordHash: 1 } })
      .toArray();
    return docs.map(d => ({
      username: d.username,
      role: d.role,
      league: d.league || null,
      passwordHash: d.passwordHash || ''
    }));
  }
  await ensureUsersFile();
  const data = await fs.readJson(USERS_FILE);
  return ((data.users || []) as User[]).map(u => ({
    username: u.username,
    role: u.role,
    league: u.league || null,
    passwordHash: u.passwordHash
  }));
}

async function getUserForAuth(username: string): Promise<User | null> {
  if (usersCollection) {
    return await usersCollection.findOne({ username }) as User | null;
  }
  await ensureUsersFile();
  const data = await fs.readJson(USERS_FILE);
  return ((data.users || []) as User[]).find(u => u.username === username) || null;
}

async function writeUsers(users: User[]): Promise<void> {
  if (usersCollection) {
    await usersCollection.deleteMany({});
    if (users.length) {
      await usersCollection.insertMany(
        users.map(u => ({
          username: u.username,
          passwordHash: u.passwordHash,
          role: u.role,
          league: u.league || null
        }))
      );
    }
    return;
  }
  await fs.writeJson(USERS_FILE, { users }, { spaces: 2 });
}

async function createUserInStore(user: { username: string; passwordHash: string; role: string }): Promise<void> {
  if (usersCollection) {
    await usersCollection.insertOne({ ...user, league: null } as User);
    return;
  }
  await ensureUsersFile();
  const data = await fs.readJson(USERS_FILE);
  data.users = data.users || [];
  data.users.push({ ...user, league: null });
  await fs.writeJson(USERS_FILE, data, { spaces: 2 });
}

// League operations
async function readLeagues(): Promise<string[]> {
  if (mongoClient) {
    try {
      const db = mongoClient.db();
      const coll = db.collection('leagues');
      const docs = await coll.find({}, { projection: { _id: 0, name: 1 } }).toArray();
      return docs.map(d => d.name);
    } catch (e: any) {
      console.error('Error reading leagues from MongoDB', e && e.stack ? e.stack : e);
    }
  }
  await ensureLeaguesFile();
  const data = await fs.readJson(LEAGUES_FILE);
  return (data.leagues || []) as string[];
}

async function createLeagueInStore(name: string): Promise<boolean> {
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

async function deleteLeagueInStore(name: string): Promise<boolean> {
  if (!name) throw new Error('Missing league name');
  if (mongoClient) {
    const db = mongoClient.db();
    const coll = db.collection('leagues');
    await coll.deleteOne({ name });
    
    if (usersCollection) {
      await usersCollection.updateMany({ league: name }, { $unset: { league: '' } });
    } else {
      await ensureUsersFile();
      const data = await fs.readJson(USERS_FILE);
      data.users = (data.users || []).map((u: User) =>
        u.league === name ? { ...u, league: null } : u
      );
      await fs.writeJson(USERS_FILE, data, { spaces: 2 });
    }
    return true;
  }
  await ensureLeaguesFile();
  const data = await fs.readJson(LEAGUES_FILE);
  data.leagues = (data.leagues || []).filter((l: string) => l !== name);
  await fs.writeJson(LEAGUES_FILE, data, { spaces: 2 });
  
  await ensureUsersFile();
  const udata = await fs.readJson(USERS_FILE);
  udata.users = (udata.users || []).map((u: User) =>
    u.league === name ? { ...u, league: null } : u
  );
  await fs.writeJson(USERS_FILE, udata, { spaces: 2 });
  return true;
}

// JWT functions
function createToken(user: User): string {
  return jwt.sign({ sub: user.username, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
}

function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (e) {
    return null;
  }
}

// Express app setup
const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:8000', 'https://goalsgoalsgoals.onrender.com'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Log rejected origins for debugging
    console.warn(`CORS: Rejected origin "${origin}". Allowed origins:`, allowedOrigins);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(bodyParser.json());

// Security check
if (!process.env.JWT_SECRET || JWT_SECRET === 'dev_secret_change_me') {
  console.warn('Warning: JWT_SECRET is not set or using a weak default.');
  if (process.env.NODE_ENV === 'production') {
    console.error('In production, JWT_SECRET must be provided. Exiting.');
    process.exit(1);
  }
}

// Static files
const staticRoot = path.join(__dirname, '..', '..');
app.use('/server', (req, res) => res.status(404).send('Not found'));
app.get(['/admin.token', '/server/users.json', '/server/leagues.json'], (req, res) =>
  res.status(404).send('Not found')
);
app.use(express.static(staticRoot));

// Routes

// Update user's league assignment (admin only)
app.put('/api/users/:username/league', async (req: Request, res: Response) => {
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

  await ensureUsersFile();
  const data = await fs.readJson(USERS_FILE);
  data.users = data.users || [];
  const idx = data.users.findIndex((u: User) => u.username === username);
  if (idx < 0) return res.status(404).json({ error: 'User not found' });
  data.users[idx].league = league || null;
  await fs.writeJson(USERS_FILE, data, { spaces: 2 });
  return res.json({ username, league: league || null });
});

// List leagues (public)
app.get('/api/leagues', async (req: Request, res: Response) => {
  try {
    const leagues = await readLeagues();
    res.json(leagues);
  } catch (e: any) {
    console.error('Failed to list leagues', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'Failed to list leagues' });
  }
});

// Create league (admin only)
app.post('/api/leagues', async (req: Request, res: Response) => {
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
  } catch (e: any) {
    console.error('Failed to create league', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'Failed to create league' });
  }
});

// Delete league (admin only)
app.delete('/api/leagues/:name', async (req: Request, res: Response) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer /i, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const name = req.params.name as string;
  if (!name) return res.status(400).json({ error: 'Missing league name' });
  try {
    await deleteLeagueInStore(name);
    res.json({ name });
  } catch (e: any) {
    console.error('Failed to delete league', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'Failed to delete league' });
  }
});

// Login
app.post('/api/login', async (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  console.log(`[LOGIN] Attempt for username: "${username}"`);
  
  if (!username || !password) {
    console.log('[LOGIN] Missing credentials in request body');
    return res.status(400).json({ error: 'Missing credentials' });
  }
  
  const user = await getUserForAuth(username);
  if (!user) {
    console.log(`[LOGIN] User "${username}" not found in database`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  console.log(`[LOGIN] User "${username}" found, verifying password...`);
  const ok = await bcrypt.compare(password, user.passwordHash);
  
  if (!ok) {
    console.log(`[LOGIN] Password verification failed for "${username}"`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  console.log(`[LOGIN] Success for "${username}"`);
  const token = createToken(user);
  res.json({ token });
});

// Get current user info
app.get('/api/me', (req: Request, res: Response) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer /i, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ username: decoded.sub, role: decoded.role });
});

// List users (admin only)
app.get('/api/users', async (req: Request, res: Response) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer /i, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const users = await readUsers();
  res.json(users.map(u => ({ username: u.username, role: u.role, league: u.league || null })));
});

// Create user (admin only)
app.post('/api/users', async (req: Request, res: Response) => {
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

// Admin users endpoint (alias)
app.get('/api/admin/users', async (req: Request, res: Response) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer /i, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const users = await readUsers();
  res.json(users.map(u => ({ username: u.username, role: u.role, league: u.league || null })));
});

// Rate limiter status (public)
app.get('/api/rate-limit/status', async (req: Request, res: Response) => {
  try {
    const status = await apiRateLimiter.getStatus();
    res.json(status);
  } catch (error: any) {
    console.error('Error getting rate limit status:', error);
    res.status(500).json({ error: 'Failed to get rate limit status' });
  }
});

// Rate limiter analytics (admin only)
app.get('/api/rate-limit/analytics', async (req: Request, res: Response) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer /i, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  try {
    const analytics = await apiRateLimiter.getAnalytics();
    res.json(analytics);
  } catch (error: any) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Reset rate limiter (admin only)
app.post('/api/rate-limit/reset', async (req: Request, res: Response) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer /i, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  try {
    await apiRateLimiter.reset();
    res.json({ message: 'Rate limiter reset successfully' });
  } catch (error: any) {
    console.error('Error resetting rate limiter:', error);
    res.status(500).json({ error: 'Failed to reset rate limiter' });
  }
});

// Sync fixtures from API-Football (admin only)
app.post('/api/admin/sync-fixtures', async (req: Request<{}, {}, SyncFixturesRequest>, res: Response) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer /i, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  if (!mongoClient) {
    return res.status(500).json({ error: 'MongoDB not connected' });
  }

  const API_KEY = process.env.API_FOOTBALL_KEY;
  const API_HOST = process.env.API_FOOTBALL_HOST || 'v3.football.api-sports.io';

  if (!API_KEY) {
    return res.status(500).json({
      error: 'API_FOOTBALL_KEY not configured',
      details: 'Please add API_FOOTBALL_KEY to your .env file'
    });
  }

  try {
    const { season = 2025, dateRange = 20 } = req.body;

    console.log(`Starting fixture sync for season ${season}, dateRange ${dateRange} days`);

    const { FixtureFetcher } = require('../dist/fixture-fetcher');

    const fetcher = new FixtureFetcher(
      mongoClient,
      apiRateLimiter,
      API_KEY,
      API_HOST
    );

    const result = await fetcher.syncFixtures(season, dateRange);

    console.log('Sync completed:', result.summary);
    res.json(result);
  } catch (error: any) {
    console.error('Error syncing fixtures:', error);

    if (error.message && error.message.includes('Rate limit')) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        details: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to sync fixtures',
      details: error.message || 'Unknown error'
    });
  }
});

// Mock external API call endpoint (for testing rate limiting)
app.post('/api/football/fixtures', async (req: Request, res: Response) => {
  try {
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

    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer /i, '');
    const decoded = verifyToken(token);
    const user = decoded ? decoded.sub : 'anonymous';

    await apiRateLimiter.recordCall('/football/fixtures', user, req.body);

    res.json({
      message: 'API call successful (mocked)',
      data: {
        fixtures: [],
      },
      rateLimitStatus: await apiRateLimiter.getStatus()
    });
  } catch (error: any) {
    console.error('Error in mock API call:', error);
    res.status(500).json({ error: 'API call failed' });
  }
});

// Mock standings API endpoint
app.post('/api/football/standings', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error('Error in mock API call:', error);
    res.status(500).json({ error: 'API call failed' });
  }
});

// Get fixtures from database
app.get('/api/football/fixtures', async (req: Request, res: Response) => {
  try {
    if (!mongoClient) {
      return res.status(503).json({
        error: 'Database not connected',
        message: 'MongoDB is not available. Please check MONGODB_URI in .env'
      });
    }

    const db = mongoClient.db('goalsgoalsgoals');
    const query: any = {};

    if (req.query.league) {
      query['league.id'] = parseInt(req.query.league as string);
    }

    if (req.query.season) {
      query['league.season'] = parseInt(req.query.season as string);
    }

    if (req.query.status) {
      query['fixture.status.short'] = req.query.status;
    }

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
  } catch (error: any) {
    console.error('Error fetching fixtures:', error);
    res.status(500).json({ error: 'Failed to fetch fixtures', message: error.message });
  }
});

// Get standings from database
app.get('/api/football/standings', async (req: Request, res: Response) => {
  try {
    if (!mongoClient) {
      return res.status(503).json({
        error: 'Database not connected',
        message: 'MongoDB is not available. Please check MONGODB_URI in .env'
      });
    }

    const db = mongoClient.db('goalsgoalsgoals');
    const query: any = {};

    if (req.query.league) {
      query['league.id'] = parseInt(req.query.league as string);
    } else {
      return res.status(400).json({
        error: 'Missing parameter',
        message: 'league parameter is required'
      });
    }

    if (req.query.season) {
      query['league.season'] = parseInt(req.query.season as string);
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
  } catch (error: any) {
    console.error('Error fetching standings:', error);
    res.status(500).json({ error: 'Failed to fetch standings', message: error.message });
  }
});

// Get teams from database
app.get('/api/football/teams', async (req: Request, res: Response) => {
  try {
    if (!mongoClient) {
      return res.status(503).json({
        error: 'Database not connected',
        message: 'MongoDB is not available. Please check MONGODB_URI in .env'
      });
    }

    const db = mongoClient.db('goalsgoalsgoals');
    const query: any = {};

    if (req.query.id) {
      query.id = parseInt(req.query.id as string);
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
  } catch (error: any) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams', message: error.message });
  }
});

// Select a match
app.post('/api/matches/:fixtureId/select', async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer /i, '');
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Please log in to select a match'
      });
    }

    const username = decoded.sub;
    const fixtureId = parseInt(req.params.fixtureId as string);

    if (!mongoClient) {
      return res.status(503).json({
        error: 'Database not connected',
        message: 'MongoDB is not available'
      });
    }

    const db = mongoClient.db('goalsgoalsgoals');

    const fixture = await db.collection('fixtures').findOne({
      'fixture.id': fixtureId,
      'fixture.status.short': 'NS'
    });

    if (!fixture) {
      return res.status(404).json({
        error: 'Fixture not found',
        message: 'Fixture not found or not available for selection'
      });
    }

    const existing = await db.collection('match_selections').findOne({ fixtureId });

    if (existing && existing.username !== username) {
      return res.status(409).json({
        error: 'Match already selected',
        message: `This match has already been selected by ${existing.username}`,
        selectedBy: existing.username
      });
    }

    const userExistingSelection = await db.collection('match_selections').findOne({
      username,
      fixtureId: { $ne: fixtureId }
    });

    let replacedMatch = null;
    if (userExistingSelection) {
      await db.collection('match_selections').deleteOne({
        username,
        fixtureId: userExistingSelection.fixtureId
      });
      replacedMatch = {
        homeTeam: userExistingSelection.homeTeam,
        awayTeam: userExistingSelection.awayTeam
      };
    }

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
  } catch (error: any) {
    console.error('Error selecting match:', error);
    res.status(500).json({ error: 'Failed to select match', message: error.message });
  }
});

// Get all match selections
app.get('/api/matches/selections', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error('Error fetching selections:', error);
    res.status(500).json({ error: 'Failed to fetch selections', message: error.message });
  }
});

// Unselect a match
app.delete('/api/matches/:fixtureId/select', async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer /i, '');
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const username = decoded.sub;
    const fixtureId = parseInt(req.params.fixtureId as string);

    if (!mongoClient) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const db = mongoClient.db('goalsgoalsgoals');

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
  } catch (error: any) {
    console.error('Error removing selection:', error);
    res.status(500).json({ error: 'Failed to remove selection', message: error.message });
  }
});

// Archive finished match selections
app.post('/api/matches/archive-finished', async (req: Request, res: Response) => {
  try {
    if (!mongoClient) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const db = mongoClient.db('goalsgoalsgoals');

    const selections = await db.collection('match_selections').find({}).toArray();

    if (selections.length === 0) {
      return res.json({ success: true, archived: 0, message: 'No selections to check' });
    }

    const fixtureIds = selections.map(s => s.fixtureId);

    const fixtures = await db.collection('fixtures').find({
      'fixture.id': { $in: fixtureIds }
    }).toArray();

    const fixtureMap = new Map(fixtures.map(f => [f.fixture.id, f]));

    let archived = 0;
    const bulkArchive: any[] = [];
    const selectionsToRemove: number[] = [];

    for (const selection of selections) {
      const fixture = fixtureMap.get(selection.fixtureId);

      if (fixture && fixture.fixture.status.short === 'FT') {
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
        archived++;
      }
    }

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
  } catch (error: any) {
    console.error('Error archiving finished matches:', error);
    res.status(500).json({ error: 'Failed to archive finished matches', message: error.message });
  }
});

// Get match selection history
app.get('/api/matches/history', async (req: Request, res: Response) => {
  try {
    if (!mongoClient) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const db = mongoClient.db('goalsgoalsgoals');
    const username = req.query.username as string | undefined;

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
  } catch (error: any) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history', message: error.message });
  }
});

// Server startup
const port = process.env.PORT || 4000;

(async function start() {
  try {
    await connectMongo();
    await apiRateLimiter.initialize(mongoClient);
  } catch (e: any) {
    console.error('Error during MongoDB connect attempt', e);
  }

  const server = app.listen(port, () => {
    console.log('Auth server listening on port', port);
    if (usersCollection) {
      console.log('Using MongoDB for user store');
    } else {
      console.log('Using file store for users');
    }
    ensureUsersFile().catch(e => console.error('Failed to ensure users file', e));
  });

  server.on('error', (err: any) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Another process is listening on this port.`);
      console.error('Tip: stop the other process or set a different PORT environment variable before restarting.');
      process.exit(1);
    }
    console.error('Server error:', err);
  });
})();
