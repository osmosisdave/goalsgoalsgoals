#!/usr/bin/env node
/**
 * Imports fixtures from a Google Sheet into the MongoDB fixtures collection.
 *
 * Authentication (in priority order):
 *   1. GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON key
 *   2. oauth-client.json in this directory + a cached oauth-token.json
 *      (token is created automatically on first run via browser OAuth flow)
 *   3. Application Default Credentials (ADC) via gcloud auth application-default login
 *
 * Usage: node import-fixtures-from-sheets.js [--dry-run] [--season 2025]
 *
 * --dry-run   Print mapped fixtures to console without writing to MongoDB
 * --season    Override the season year (default: 2025)
 */

require('dotenv').config();
const { google } = require('googleapis');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const http   = require('http');
const { URL } = require('url');

// ── Config ────────────────────────────────────────────────────────────────────

const SPREADSHEET_ID = '1hzV50jfIzi7vhZNWMmOxAMAIMZISWMD-H21VLrnHc0M';
const SHEET_TAB      = 'Full Fixture API';
const MONGO_URI      = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME        = process.env.DB_NAME || 'goalsgoalsgoals';

const args       = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');
const seasonArg  = args.indexOf('--season');
const SEASON     = seasonArg !== -1 ? parseInt(args[seasonArg + 1], 10) : 2025;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generates a stable numeric fixture ID from date + home team + away team.
 * Uses the first 8 hex chars of an MD5 hash, parsed as a positive integer.
 */
function generateFixtureId(date, homeTeam, awayTeam) {
  const key  = `${date}|${homeTeam}|${awayTeam}`.toLowerCase();
  const hash = crypto.createHash('md5').update(key).digest('hex');
  return parseInt(hash.slice(0, 8), 16);
}

/**
 * Generates a stable numeric team ID from the team name.
 */
function generateTeamId(name) {
  const hash = crypto.createHash('md5').update(name.toLowerCase()).digest('hex');
  return parseInt(hash.slice(0, 6), 16);
}

/**
 * Derives the short status code from the long status string.
 * Covers the most common API-Football status values.
 */
function deriveStatusShort(long) {
  if (!long) return 'NS';
  const l = long.toLowerCase();
  if (l.includes('not started'))            return 'NS';
  if (l.includes('first half'))             return '1H';
  if (l.includes('halftime') || l === 'ht') return 'HT';
  if (l.includes('second half'))            return '2H';
  if (l.includes('extra time'))             return 'ET';
  if (l.includes('penalty'))                return 'P';
  if (l.includes('finished') || l === 'ft') return 'FT';
  if (l.includes('abandoned'))              return 'ABD';
  if (l.includes('postponed'))              return 'PST';
  if (l.includes('cancelled'))              return 'CANC';
  if (l.includes('suspended'))              return 'SUSP';
  return 'NS';
}

/** Parses a value as an integer, returning null if empty or not a number. */
function parseGoal(val) {
  if (val === '' || val === null || val === undefined) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function buildFixtureNaturalKeyFilter(fixture) {
  return {
    'league.season': fixture.league.season,
    'league.id': fixture.league.id,
    'league.round': fixture.league.round,
    'teams.home.name': fixture.teams.home.name,
    'teams.away.name': fixture.teams.away.name,
  };
}

// ── Sheet → Fixture mapping ───────────────────────────────────────────────────

/**
 * Maps a header row + data row from the sheet into a MongoDB Fixture document.
 * Column order follows the headers provided:
 *   fixture.date, fixture.venue.name, fixture.venue.city,
 *   fixture.status.long, league.id, league.name, league.country,
 *   league.logo, league.flag, league.round, league.standings,
 *   teams.home.name, teams.home.logo, teams.away.name, teams.away.logo,
 *   goals.home, goals.away,
 *   score.fulltime.home, score.fulltime.away,
 *   score.extratime.home, score.extratime.away,
 *   score.penalty.home, score.penalty.away
 */
function mapRowToFixture(headers, row) {
  // Build a simple key→value map, stripping newlines from header names
  const cell = {};
  headers.forEach((h, i) => {
    // Headers have newlines mid-word (e.g. "fixture.statu\ns.long") — remove all whitespace
    const key = h.replace(/\s+/g, '').trim();
    cell[key] = (row[i] || '').toString().trim();
  });

  const date       = cell['fixture.date'];
  const homeTeam   = cell['teams.home.name'];
  const awayTeam   = cell['teams.away.name'];
  const statusLong = cell['fixture.status.long'];

  if (!date || !homeTeam || !awayTeam) return null;

  const timestamp = date ? Math.floor(new Date(date).getTime() / 1000) : null;

  return {
    fixture: {
      id:        generateFixtureId(date, homeTeam, awayTeam),
      referee:   null,
      timezone:  'UTC',
      date,
      timestamp,
      periods:   { first: null, second: null },
      venue: {
        id:   null,
        name: cell['fixture.venue.name'] || null,
        city: cell['fixture.venue.city'] || null,
      },
      status: {
        long:    statusLong || 'Not Started',
        short:   deriveStatusShort(statusLong),
        elapsed: null,
      },
    },
    league: {
      id:        parseInt(cell['league.id'], 10) || 0,
      name:      cell['league.name']    || '',
      country:   cell['league.country'] || '',
      logo:      cell['league.logo']    || '',
      flag:      cell['league.flag']    || null,
      season:    SEASON,
      round:     cell['league.round']   || '',
      standings: cell['league.standings'] === 'TRUE' || cell['league.standings'] === '1',
    },
    teams: {
      home: {
        id:     generateTeamId(homeTeam),
        name:   homeTeam,
        logo:   cell['teams.home.logo'] || '',
        winner: null,
      },
      away: {
        id:     generateTeamId(awayTeam),
        name:   awayTeam,
        logo:   cell['teams.away.logo'] || '',
        winner: null,
      },
    },
    goals: {
      home: parseGoal(cell['goals.home']),
      away: parseGoal(cell['goals.away']),
    },
    score: {
      halftime:  { home: null, away: null },
      fulltime:  { home: parseGoal(cell['score.fulltime.home']),  away: parseGoal(cell['score.fulltime.away'])  },
      extratime: { home: parseGoal(cell['score.extratime.home']), away: parseGoal(cell['score.extratime.away']) },
      penalty:   { home: parseGoal(cell['score.penalty.home']),   away: parseGoal(cell['score.penalty.away'])   },
    },
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

const SCOPES          = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const OAUTH_CLIENT    = path.join(__dirname, 'oauth-client.json');
const OAUTH_TOKEN     = path.join(__dirname, 'oauth-token.json');

/**
 * Builds an authenticated Google auth client.
 * Priority: service account key → oauth-client.json → ADC.
 */
async function getAuthClient() {
  // 1. Service account key via env var
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
    return auth.getClient();
  }

  // 2. oauth-client.json + cached token
  if (fs.existsSync(OAUTH_CLIENT)) {
    const clientJson = JSON.parse(fs.readFileSync(OAUTH_CLIENT));
    const { client_id, client_secret, redirect_uris } = clientJson.installed || clientJson.web;
    const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (fs.existsSync(OAUTH_TOKEN)) {
      oauth2.setCredentials(JSON.parse(fs.readFileSync(OAUTH_TOKEN)));
      return oauth2;
    }

    // No cached token — do a local-server OAuth flow
    const tokenJson = await runOAuthFlow(oauth2);
    fs.writeFileSync(OAUTH_TOKEN, JSON.stringify(tokenJson, null, 2));
    console.log(`   ✅ Token saved to ${OAUTH_TOKEN}`);
    return oauth2;
  }

  // 3. Fall back to ADC
  const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
  return auth.getClient();
}

/**
 * Opens the browser for the user to approve access, then captures the
 * redirect on localhost:3939 and exchanges the code for a token.
 */
function runOAuthFlow(oauth2) {
  return new Promise((resolve, reject) => {
    const redirectUri = 'http://localhost:3939';
    oauth2.redirectUri = redirectUri;

    const authUrl = oauth2.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
    console.log('\n🔐 Authorization required.');
    console.log('   Open this URL in your browser:\n');
    console.log(`   ${authUrl}\n`);

    const server = http.createServer(async (req, res) => {
      try {
        const url  = new URL(req.url, redirectUri);
        const code = url.searchParams.get('code');
        if (!code) { res.end('No code found.'); return; }

        res.end('<h2>✅ Authorised! You can close this tab.</h2>');
        server.close();

        const { tokens } = await oauth2.getToken(code);
        oauth2.setCredentials(tokens);
        resolve(tokens);
      } catch (err) {
        reject(err);
      }
    });

    server.listen(3939, () => {
      console.log('   Waiting for browser redirect on http://localhost:3939 …\n');
    });

    server.on('error', reject);
  });
}

// ── Google Sheets fetch ───────────────────────────────────────────────────────

async function fetchSheetRows() {
  const authClient = await getAuthClient();
  const sheets     = google.sheets({ version: 'v4', auth: authClient });

  const range    = `'${SHEET_TAB}'`;
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });

  const rows = response.data.values;
  if (!rows || rows.length < 2) throw new Error('Sheet is empty or has no data rows.');

  return rows;
}

// ── MongoDB upsert ────────────────────────────────────────────────────────────

async function upsertFixtures(fixtures) {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db         = client.db(DB_NAME);
  const collection = db.collection('fixtures');

  let newCount     = 0;
  let updatedCount = 0;

  for (const fixture of fixtures) {
    const naturalKeyFilter = buildFixtureNaturalKeyFilter(fixture);
    const existing = await collection.findOne(
      {
        $or: [
          { 'fixture.id': fixture.fixture.id },
          naturalKeyFilter,
        ],
      },
      {
        projection: { _id: 0, 'fixture.id': 1 },
      }
    );

    const fixtureToPersist = existing && existing.fixture && existing.fixture.id
      ? {
          ...fixture,
          fixture: {
            ...fixture.fixture,
            id: existing.fixture.id,
          },
        }
      : fixture;

    const result = await collection.updateOne(
      { 'fixture.id': fixtureToPersist.fixture.id },
      { $set: fixtureToPersist },
      { upsert: true }
    );
    if (result.upsertedCount > 0) newCount++;
    else if (result.modifiedCount > 0) updatedCount++;
  }

  await client.close();
  return { newCount, updatedCount };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📋 Fetching sheet: "${SHEET_TAB}" …`);
  const rows    = await fetchSheetRows();
  const headers = rows[0];
  const dataRows = rows.slice(1);

  console.log(`   Found ${dataRows.length} data rows`);

  const fixtures = dataRows
    .map(row => mapRowToFixture(headers, row))
    .filter(Boolean);

  console.log(`   Mapped ${fixtures.length} valid fixtures (season ${SEASON})`);

  if (DRY_RUN) {
    console.log('\n🔍 Dry run — first 3 fixtures:');
    fixtures.slice(0, 3).forEach(f => console.log(JSON.stringify(f, null, 2)));
    console.log(`\n✅ Dry run complete. ${fixtures.length} fixtures would be upserted.`);
    return;
  }

  console.log(`\n💾 Upserting into MongoDB …`);
  const { newCount, updatedCount } = await upsertFixtures(fixtures);

  console.log(`\n✅ Done!`);
  console.log(`   ${newCount} new fixtures inserted`);
  console.log(`   ${updatedCount} existing fixtures updated`);
  console.log(`   ${fixtures.length - newCount - updatedCount} fixtures unchanged\n`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
