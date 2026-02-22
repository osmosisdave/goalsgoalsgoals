#!/usr/bin/env node
/**
 * Script to generate mock fixture data for 2025 season
 * Generates 38 fixtures per team (20 teams) for each league = 380 fixtures per league
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

// League configurations
const DEFAULT_LEAGUE_IDS = [
  39,  // Premier League
  40,  // Championship
  41,  // League One
  42,  // League Two
  43,  // National League
  179, // Premiership
  180, // Championship
  183, // League One
  184, // League Two
  45,  // FA Cup
  48,  // League Cup
  46,  // EFL Trophy
  181, // Scottish FA Cup
  185, // Scottish League Cup
  182, // Scottish Challenge Cup
  2,   // UEFA Champions League
  3,   // UEFA Europa League
  848, // UEFA Europa Conference League
];

const LEAGUE_NAMES = {
  39: 'Premier League',
  40: 'Championship',
  41: 'League One',
  42: 'League Two',
  43: 'National League',
  179: 'Premiership',
  180: 'Championship',
  183: 'League One',
  184: 'League Two',
  45: 'FA Cup',
  48: 'League Cup',
  46: 'EFL Trophy',
  181: 'Scottish FA Cup',
  185: 'Scottish League Cup',
  182: 'Scottish Challenge Cup',
  2: 'UEFA Champions League',
  3: 'UEFA Europa League',
  848: 'UEFA Europa Conference League',
};

const LEAGUE_COUNTRIES = {
  39: 'England',
  40: 'England',
  41: 'England',
  42: 'England',
  43: 'England',
  179: 'Scotland',
  180: 'Scotland',
  183: 'Scotland',
  184: 'Scotland',
  45: 'England',
  48: 'England',
  46: 'England',
  181: 'Scotland',
  185: 'Scotland',
  182: 'Scotland',
  2: 'World',
  3: 'World',
  848: 'World',
};

// Generate team names
function generateTeams(leagueId, count = 20) {
  const teams = [];
  const country = LEAGUE_COUNTRIES[leagueId];
  const leagueName = LEAGUE_NAMES[leagueId];
  
  for (let i = 1; i <= count; i++) {
    teams.push({
      id: leagueId * 1000 + i,
      name: `${country} Team ${i} (${leagueName})`,
      logo: `https://media.api-sports.io/football/teams/${leagueId * 1000 + i}.png`,
    });
  }
  
  return teams;
}

// Generate round-robin fixtures (each team plays every other team twice - home and away)
function generateFixtures(leagueId, teams, season = 2025) {
  const fixtures = [];
  const leagueName = LEAGUE_NAMES[leagueId];
  const country = LEAGUE_COUNTRIES[leagueId];
  
  // Start date: August 1, 2025
  let currentDate = new Date('2025-08-01T15:00:00Z');
  let fixtureId = leagueId * 100000 + 1;
  let round = 1;
  
  // Generate home and away fixtures for full season
  // Each team plays every other team twice (home and away)
  const numTeams = teams.length;
  
  // Round-robin algorithm: n-1 rounds for home, n-1 rounds for away
  for (let homeAway = 0; homeAway < 2; homeAway++) {
    for (let roundNum = 0; roundNum < numTeams - 1; roundNum++) {
      // Each round has numTeams/2 matches
      for (let matchNum = 0; matchNum < numTeams / 2; matchNum++) {
        let home, away;
        
        if (matchNum === 0) {
          home = 0;
          away = roundNum + 1;
        } else {
          home = ((roundNum - matchNum + numTeams) % (numTeams - 1)) + 1;
          away = ((roundNum + matchNum) % (numTeams - 1)) + 1;
        }
        
        // Swap for away fixtures
        if (homeAway === 1) {
          [home, away] = [away, home];
        }
        
        const homeTeam = teams[home];
        const awayTeam = teams[away];
        
        // Random score for completed matches
        const homeGoals = Math.floor(Math.random() * 4);
        const awayGoals = Math.floor(Math.random() * 4);
        
        const fixture = {
          fixture: {
            id: fixtureId++,
            referee: `Referee ${Math.floor(Math.random() * 20) + 1}`,
            timezone: 'UTC',
            date: currentDate.toISOString(),
            timestamp: Math.floor(currentDate.getTime() / 1000),
            periods: {
              first: Math.floor(currentDate.getTime() / 1000),
              second: Math.floor(currentDate.getTime() / 1000) + 2700,
            },
            venue: {
              id: homeTeam.id,
              name: `${homeTeam.name} Stadium`,
              city: country,
            },
            status: {
              long: 'Not Started',
              short: 'NS',
              elapsed: null,
              extra: null,
            },
          },
          league: {
            id: leagueId,
            name: leagueName,
            country: country,
            logo: `https://media.api-sports.io/football/leagues/${leagueId}.png`,
            flag: country === 'England' ? 'https://media.api-sports.io/flags/gb-eng.svg' : 
                  country === 'Scotland' ? 'https://media.api-sports.io/flags/gb-sct.svg' : 
                  'https://media.api-sports.io/flags/world.svg',
            season: season,
            round: `Regular Season - ${round}`,
            standings: true,
          },
          teams: {
            home: {
              id: homeTeam.id,
              name: homeTeam.name,
              logo: homeTeam.logo,
              winner: null,
            },
            away: {
              id: awayTeam.id,
              name: awayTeam.name,
              logo: awayTeam.logo,
              winner: null,
            },
          },
          goals: {
            home: null,
            away: null,
          },
          score: {
            halftime: {
              home: null,
              away: null,
            },
            fulltime: {
              home: null,
              away: null,
            },
            extratime: {
              home: null,
              away: null,
            },
            penalty: {
              home: null,
              away: null,
            },
          },
        };
        
        fixtures.push(fixture);
      }
      
      // Move to next match day (3-4 days apart)
      currentDate.setDate(currentDate.getDate() + (Math.random() > 0.5 ? 3 : 4));
      
      // Increment round every numTeams/2 matches
      if ((roundNum + 1) % 1 === 0) {
        round++;
      }
    }
  }
  
  return fixtures;
}

async function seedMockFixtures() {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('MONGODB_URI not found in environment variables');
    process.exit(1);
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('goalsgoalsgoals');
    const fixturesCollection = db.collection('fixtures');
    
    // Delete existing 2025 fixtures
    console.log('Deleting existing 2025 fixtures...');
    const deleteResult = await fixturesCollection.deleteMany({ 'league.season': 2025 });
    console.log(`Deleted ${deleteResult.deletedCount} existing 2025 fixtures`);
    
    let totalFixtures = 0;
    
    // Generate fixtures for each league
    for (const leagueId of DEFAULT_LEAGUE_IDS) {
      console.log(`\nGenerating fixtures for ${LEAGUE_NAMES[leagueId]} (ID: ${leagueId})...`);
      
      const teams = generateTeams(leagueId, 20);
      const fixtures = generateFixtures(leagueId, teams, 2025);
      
      console.log(`  Generated ${fixtures.length} fixtures`);
      
      // Insert fixtures
      const result = await fixturesCollection.insertMany(fixtures);
      console.log(`  Inserted ${result.insertedCount} fixtures into database`);
      
      totalFixtures += result.insertedCount;
    }
    
    console.log(`\n✓ Successfully seeded ${totalFixtures} total fixtures for ${DEFAULT_LEAGUE_IDS.length} leagues`);
    
    // Verify the count
    const count = await fixturesCollection.countDocuments({ 'league.season': 2025 });
    console.log(`✓ Verified: ${count} fixtures in database for 2025 season`);
    
  } catch (error) {
    console.error('Error seeding mock fixtures:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the script
seedMockFixtures();
