/**
 * Seed Football Data
 * Populates MongoDB with mock fixtures, standings, and teams from multiple leagues
 * Based on API-Football v3 response structure
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env file');
  console.log('Please uncomment MONGODB_URI in server/.env to use MongoDB');
  process.exit(1);
}

// Define leagues
const leagues = [
  { id: 39, name: 'Premier League', country: 'England', logo: 'https://media.api-sports.io/football/leagues/39.png', flag: 'https://media.api-sports.io/flags/gb.svg' },
  { id: 140, name: 'La Liga', country: 'Spain', logo: 'https://media.api-sports.io/football/leagues/140.png', flag: 'https://media.api-sports.io/flags/es.svg' },
  { id: 78, name: 'Bundesliga', country: 'Germany', logo: 'https://media.api-sports.io/football/leagues/78.png', flag: 'https://media.api-sports.io/flags/de.svg' },
  { id: 135, name: 'Serie A', country: 'Italy', logo: 'https://media.api-sports.io/football/leagues/135.png', flag: 'https://media.api-sports.io/flags/it.svg' },
  { id: 61, name: 'Ligue 1', country: 'France', logo: 'https://media.api-sports.io/football/leagues/61.png', flag: 'https://media.api-sports.io/flags/fr.svg' },
  { id: 88, name: 'Eredivisie', country: 'Netherlands', logo: 'https://media.api-sports.io/football/leagues/88.png', flag: 'https://media.api-sports.io/flags/nl.svg' }
];

// Mock Teams Data
const teamsByLeague = {
  39: [ // Premier League
    { id: 33, name: 'Manchester United', code: 'MUN', logo: 'https://media.api-sports.io/football/teams/33.png' },
    { id: 40, name: 'Liverpool', code: 'LIV', logo: 'https://media.api-sports.io/football/teams/40.png' },
    { id: 42, name: 'Arsenal', code: 'ARS', logo: 'https://media.api-sports.io/football/teams/42.png' },
    { id: 47, name: 'Tottenham', code: 'TOT', logo: 'https://media.api-sports.io/football/teams/47.png' },
    { id: 50, name: 'Manchester City', code: 'MCI', logo: 'https://media.api-sports.io/football/teams/50.png' },
    { id: 49, name: 'Chelsea', code: 'CHE', logo: 'https://media.api-sports.io/football/teams/49.png' },
    { id: 34, name: 'Newcastle', code: 'NEW', logo: 'https://media.api-sports.io/football/teams/34.png' },
    { id: 66, name: 'Aston Villa', code: 'AVL', logo: 'https://media.api-sports.io/football/teams/66.png' },
    { id: 51, name: 'Brighton', code: 'BHA', logo: 'https://media.api-sports.io/football/teams/51.png' },
    { id: 48, name: 'West Ham', code: 'WHU', logo: 'https://media.api-sports.io/football/teams/48.png' }
  ],
  140: [ // La Liga
    { id: 529, name: 'Barcelona', code: 'BAR', logo: 'https://media.api-sports.io/football/teams/529.png' },
    { id: 541, name: 'Real Madrid', code: 'RMA', logo: 'https://media.api-sports.io/football/teams/541.png' },
    { id: 530, name: 'Atletico Madrid', code: 'ATM', logo: 'https://media.api-sports.io/football/teams/530.png' },
    { id: 532, name: 'Valencia', code: 'VAL', logo: 'https://media.api-sports.io/football/teams/532.png' },
    { id: 536, name: 'Sevilla', code: 'SEV', logo: 'https://media.api-sports.io/football/teams/536.png' },
    { id: 548, name: 'Real Sociedad', code: 'RSO', logo: 'https://media.api-sports.io/football/teams/548.png' },
    { id: 531, name: 'Athletic Club', code: 'ATH', logo: 'https://media.api-sports.io/football/teams/531.png' },
    { id: 728, name: 'Villarreal', code: 'VIL', logo: 'https://media.api-sports.io/football/teams/728.png' },
    { id: 533, name: 'Betis', code: 'BET', logo: 'https://media.api-sports.io/football/teams/533.png' },
    { id: 727, name: 'Osasuna', code: 'OSA', logo: 'https://media.api-sports.io/football/teams/727.png' }
  ],
  78: [ // Bundesliga
    { id: 157, name: 'Bayern Munich', code: 'BAY', logo: 'https://media.api-sports.io/football/teams/157.png' },
    { id: 165, name: 'Borussia Dortmund', code: 'DOR', logo: 'https://media.api-sports.io/football/teams/165.png' },
    { id: 173, name: 'RB Leipzig', code: 'RBL', logo: 'https://media.api-sports.io/football/teams/173.png' },
    { id: 168, name: 'Bayer Leverkusen', code: 'LEV', logo: 'https://media.api-sports.io/football/teams/168.png' },
    { id: 172, name: 'VfB Stuttgart', code: 'STU', logo: 'https://media.api-sports.io/football/teams/172.png' },
    { id: 169, name: 'Eintracht Frankfurt', code: 'FRA', logo: 'https://media.api-sports.io/football/teams/169.png' },
    { id: 167, name: 'Borussia M.Gladbach', code: 'BMG', logo: 'https://media.api-sports.io/football/teams/167.png' },
    { id: 164, name: 'Wolfsburg', code: 'WOL', logo: 'https://media.api-sports.io/football/teams/164.png' },
    { id: 170, name: 'FC Koln', code: 'KOL', logo: 'https://media.api-sports.io/football/teams/170.png' },
    { id: 159, name: 'Hertha Berlin', code: 'HER', logo: 'https://media.api-sports.io/football/teams/159.png' }
  ],
  135: [ // Serie A
    { id: 489, name: 'AC Milan', code: 'MIL', logo: 'https://media.api-sports.io/football/teams/489.png' },
    { id: 496, name: 'Juventus', code: 'JUV', logo: 'https://media.api-sports.io/football/teams/496.png' },
    { id: 487, name: 'Inter', code: 'INT', logo: 'https://media.api-sports.io/football/teams/487.png' },
    { id: 492, name: 'Napoli', code: 'NAP', logo: 'https://media.api-sports.io/football/teams/492.png' },
    { id: 497, name: 'AS Roma', code: 'ROM', logo: 'https://media.api-sports.io/football/teams/497.png' },
    { id: 499, name: 'Atalanta', code: 'ATA', logo: 'https://media.api-sports.io/football/teams/499.png' },
    { id: 488, name: 'Fiorentina', code: 'FIO', logo: 'https://media.api-sports.io/football/teams/488.png' },
    { id: 500, name: 'Bologna', code: 'BOL', logo: 'https://media.api-sports.io/football/teams/500.png' },
    { id: 490, name: 'Cagliari', code: 'CAG', logo: 'https://media.api-sports.io/football/teams/490.png' },
    { id: 502, name: 'Genoa', code: 'GEN', logo: 'https://media.api-sports.io/football/teams/502.png' }
  ],
  61: [ // Ligue 1
    { id: 85, name: 'Paris Saint Germain', code: 'PSG', logo: 'https://media.api-sports.io/football/teams/85.png' },
    { id: 81, name: 'Marseille', code: 'MAR', logo: 'https://media.api-sports.io/football/teams/81.png' },
    { id: 91, name: 'Monaco', code: 'MON', logo: 'https://media.api-sports.io/football/teams/91.png' },
    { id: 80, name: 'Lyon', code: 'LYO', logo: 'https://media.api-sports.io/football/teams/80.png' },
    { id: 106, name: 'Lille', code: 'LIL', logo: 'https://media.api-sports.io/football/teams/106.png' },
    { id: 116, name: 'Lens', code: 'LEN', logo: 'https://media.api-sports.io/football/teams/116.png' },
    { id: 79, name: 'Nantes', code: 'NAN', logo: 'https://media.api-sports.io/football/teams/79.png' },
    { id: 82, name: 'Montpellier', code: 'MON', logo: 'https://media.api-sports.io/football/teams/82.png' },
    { id: 84, name: 'Nice', code: 'NIC', logo: 'https://media.api-sports.io/football/teams/84.png' },
    { id: 96, name: 'Rennes', code: 'REN', logo: 'https://media.api-sports.io/football/teams/96.png' }
  ],
  88: [ // Eredivisie
    { id: 194, name: 'Ajax', code: 'AJA', logo: 'https://media.api-sports.io/football/teams/194.png' },
    { id: 202, name: 'Feyenoord', code: 'FEY', logo: 'https://media.api-sports.io/football/teams/202.png' },
    { id: 203, name: 'PSV Eindhoven', code: 'PSV', logo: 'https://media.api-sports.io/football/teams/203.png' },
    { id: 207, name: 'AZ Alkmaar', code: 'AZA', logo: 'https://media.api-sports.io/football/teams/207.png' },
    { id: 205, name: 'FC Utrecht', code: 'UTR', logo: 'https://media.api-sports.io/football/teams/205.png' },
    { id: 206, name: 'FC Twente', code: 'TWE', logo: 'https://media.api-sports.io/football/teams/206.png' },
    { id: 200, name: 'Go Ahead Eagles', code: 'GOA', logo: 'https://media.api-sports.io/football/teams/200.png' },
    { id: 201, name: 'Heerenveen', code: 'HEE', logo: 'https://media.api-sports.io/football/teams/201.png' },
    { id: 666, name: 'Fortuna Sittard', code: 'FOR', logo: 'https://media.api-sports.io/football/teams/666.png' },
    { id: 198, name: 'Groningen', code: 'GRO', logo: 'https://media.api-sports.io/football/teams/198.png' }
  ]
};

// Flatten all teams
const allTeams = Object.values(teamsByLeague).flat();

// Mock Fixtures Data - generate fixtures for each league
function generateFixtures() {
  const fixtures = [];
  const today = new Date();
  let fixtureIdCounter = 1000000;
  
  // Generate fixtures for each league
  leagues.forEach((league) => {
    const leagueTeams = teamsByLeague[league.id];
    
    // Generate 15 fixtures per league (mix of past, and upcoming)
    const fixtureTemplates = [
      // Finished matches (past week)
      { homeIdx: 0, awayIdx: 1, homeScore: 2, awayScore: 1, status: 'FT', daysOffset: -5 },
      { homeIdx: 2, awayIdx: 3, homeScore: 1, awayScore: 1, status: 'FT', daysOffset: -5 },
      { homeIdx: 4, awayIdx: 5, homeScore: 3, awayScore: 0, status: 'FT', daysOffset: -4 },
      { homeIdx: 6, awayIdx: 7, homeScore: 0, awayScore: 2, status: 'FT', daysOffset: -4 },
      { homeIdx: 8, awayIdx: 9, homeScore: 2, awayScore: 2, status: 'FT', daysOffset: -3 },
      
      // Upcoming matches
      { homeIdx: 1, awayIdx: 0, homeScore: null, awayScore: null, status: 'NS', daysOffset: 2 },
      { homeIdx: 3, awayIdx: 2, homeScore: null, awayScore: null, status: 'NS', daysOffset: 2 },
      { homeIdx: 5, awayIdx: 4, homeScore: null, awayScore: null, status: 'NS', daysOffset: 3 },
      { homeIdx: 7, awayIdx: 6, homeScore: null, awayScore: null, status: 'NS', daysOffset: 3 },
      { homeIdx: 9, awayIdx: 8, homeScore: null, awayScore: null, status: 'NS', daysOffset: 4 },
      { homeIdx: 0, awayIdx: 5, homeScore: null, awayScore: null, status: 'NS', daysOffset: 5 },
      { homeIdx: 2, awayIdx: 7, homeScore: null, awayScore: null, status: 'NS', daysOffset: 5 },
      { homeIdx: 4, awayIdx: 9, homeScore: null, awayScore: null, status: 'NS', daysOffset: 6 },
      { homeIdx: 6, awayIdx: 1, homeScore: null, awayScore: null, status: 'NS', daysOffset: 6 },
      { homeIdx: 8, awayIdx: 3, homeScore: null, awayScore: null, status: 'NS', daysOffset: 7 }
    ];

    fixtureTemplates.forEach((fd) => {
      const fixtureDate = new Date(today);
      fixtureDate.setDate(today.getDate() + fd.daysOffset);
      fixtureDate.setHours(15, 0, 0, 0);
      
      const homeTeam = leagueTeams[fd.homeIdx];
      const awayTeam = leagueTeams[fd.awayIdx];
      
      fixtures.push({
        fixture: {
          id: fixtureIdCounter++,
          referee: 'M. Oliver',
          timezone: 'UTC',
          date: fixtureDate.toISOString(),
          timestamp: Math.floor(fixtureDate.getTime() / 1000),
          venue: {
            id: 500 + homeTeam.id,
            name: `${homeTeam.name} Stadium`,
            city: league.country
          },
          status: {
            long: fd.status === 'FT' ? 'Match Finished' : 'Not Started',
            short: fd.status,
            elapsed: null
          }
        },
        league: {
          id: league.id,
          name: league.name,
          country: league.country,
          logo: league.logo,
          flag: league.flag,
          season: 2025,
          round: 'Regular Season - 23'
        },
        teams: {
          home: {
            id: homeTeam.id,
            name: homeTeam.name,
            logo: homeTeam.logo,
            winner: fd.status === 'FT' && fd.homeScore > fd.awayScore ? true : fd.status === 'FT' ? false : null
          },
          away: {
            id: awayTeam.id,
            name: awayTeam.name,
            logo: awayTeam.logo,
            winner: fd.status === 'FT' && fd.awayScore > fd.homeScore ? true : fd.status === 'FT' ? false : null
          }
        },
        goals: {
          home: fd.homeScore,
          away: fd.awayScore
        },
        score: {
          halftime: {
            home: fd.status !== 'NS' && fd.homeScore !== null ? Math.max(0, fd.homeScore - 1) : null,
            away: fd.status !== 'NS' && fd.awayScore !== null ? Math.max(0, fd.awayScore - 1) : null
          },
          fulltime: {
            home: fd.status === 'FT' ? fd.homeScore : null,
            away: fd.status === 'FT' ? fd.awayScore : null
          },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null }
        }
      });
    });
  });
  
  return fixtures;
}

// Mock Standings Data
function generateStandings() {
  // Based on realistic Premier League standings
  const premierLeagueTeams = teamsByLeague[39];
  const standingsData = [
    { teamIdx: 4, rank: 1, points: 60, played: 23, win: 18, draw: 6, lose: 1, goalsFor: 54, goalsAgainst: 20 },
    { teamIdx: 1, rank: 2, points: 57, played: 23, win: 17, draw: 6, lose: 0, goalsFor: 52, goalsAgainst: 18 },
    { teamIdx: 2, rank: 3, points: 53, played: 23, win: 16, draw: 5, lose: 2, goalsFor: 48, goalsAgainst: 22 },
    { teamIdx: 7, rank: 4, points: 47, played: 23, win: 14, draw: 5, lose: 4, goalsFor: 45, goalsAgainst: 28 },
    { teamIdx: 3, rank: 5, points: 44, played: 23, win: 13, draw: 5, lose: 5, goalsFor: 43, goalsAgainst: 30 },
    { teamIdx: 6, rank: 6, points: 41, played: 23, win: 12, draw: 5, lose: 6, goalsFor: 40, goalsAgainst: 28 },
    { teamIdx: 5, rank: 7, points: 38, played: 23, win: 11, draw: 5, lose: 7, goalsFor: 38, goalsAgainst: 31 },
    { teamIdx: 0, rank: 8, points: 35, played: 23, win: 10, draw: 5, lose: 8, goalsFor: 35, goalsAgainst: 32 },
    { teamIdx: 8, rank: 9, points: 32, played: 23, win: 9, draw: 5, lose: 9, goalsFor: 33, goalsAgainst: 35 },
    { teamIdx: 9, rank: 10, points: 30, played: 23, win: 8, draw: 6, lose: 9, goalsFor: 30, goalsAgainst: 35 }
  ];

  return standingsData.map(sd => {
    const team = premierLeagueTeams[sd.teamIdx];
    return {
      rank: sd.rank,
      team: {
        id: team.id,
        name: team.name,
        logo: team.logo
      },
      points: sd.points,
      goalsDiff: sd.goalsFor - sd.goalsAgainst,
      group: 'Premier League',
      form: generateForm(sd.win, sd.draw, sd.lose),
      status: sd.rank <= 4 ? 'Champions League' : sd.rank === 5 ? 'Europa League' : sd.rank >= 18 ? 'Relegation' : null,
      description: sd.rank <= 4 ? 'Promotion - Champions League (Group Stage)' : 
                   sd.rank === 5 ? 'Promotion - Europa League (Group Stage)' :
                   sd.rank >= 18 ? 'Relegation - Championship' : null,
      all: {
        played: sd.played,
        win: sd.win,
        draw: sd.draw,
        lose: sd.lose,
        goals: {
          for: sd.goalsFor,
          against: sd.goalsAgainst
        }
      },
      home: {
        played: Math.floor(sd.played / 2),
        win: Math.floor(sd.win / 2),
        draw: Math.floor(sd.draw / 2),
        lose: Math.floor(sd.lose / 2),
        goals: {
          for: Math.floor(sd.goalsFor * 0.55),
          against: Math.floor(sd.goalsAgainst * 0.45)
        }
      },
      away: {
        played: Math.ceil(sd.played / 2),
        win: Math.ceil(sd.win / 2),
        draw: Math.ceil(sd.draw / 2),
        lose: Math.ceil(sd.lose / 2),
        goals: {
          for: Math.floor(sd.goalsFor * 0.45),
          against: Math.floor(sd.goalsAgainst * 0.55)
        }
      },
      update: new Date().toISOString()
    };
  });
}

function generateForm(wins, draws, losses) {
  // Generate a realistic form string (last 5 games)
  const results = [];
  const total = wins + draws + losses;
  const winRate = wins / total;
  const drawRate = draws / total;
  
  for (let i = 0; i < 5; i++) {
    const rand = Math.random();
    if (rand < winRate) results.push('W');
    else if (rand < winRate + drawRate) results.push('D');
    else results.push('L');
  }
  
  return results.join('');
}

async function seedDatabase() {
  console.log('🌱 Starting database seed...\n');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✓ Connected to MongoDB\n');
    
    const db = client.db('goalsgoalsgoals');
    
    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await db.collection('teams').deleteMany({});
    await db.collection('fixtures').deleteMany({});
    await db.collection('standings').deleteMany({});
    console.log('✓ Cleared existing data\n');
    
    // Insert teams
    console.log('📝 Inserting teams...');
    const teamsResult = await db.collection('teams').insertMany(allTeams);
    console.log(`✓ Inserted ${teamsResult.insertedCount} teams\n`);
    
    // Insert fixtures
    console.log('📝 Inserting fixtures...');
    const fixtures = generateFixtures();
    const fixturesResult = await db.collection('fixtures').insertMany(fixtures);
    console.log(`✓ Inserted ${fixturesResult.insertedCount} fixtures\n`);
    
    // Insert standings
    console.log('📝 Inserting standings...');
    const standings = generateStandings();
    const standingsDoc = {
      league: {
        id: 39,
        name: 'Premier League',
        country: 'England',
        logo: 'https://media.api-sports.io/football/leagues/39.png',
        flag: 'https://media.api-sports.io/flags/gb.svg',
        season: 2025
      },
      standings: [standings], // Array of arrays (for groups)
      updatedAt: new Date()
    };
    await db.collection('standings').insertOne(standingsDoc);
    console.log(`✓ Inserted standings for Premier League 2025\n`);
    
    // Create indexes for better query performance
    console.log('🔍 Creating indexes...');
    await db.collection('fixtures').createIndex({ 'fixture.date': 1 });
    await db.collection('fixtures').createIndex({ 'league.id': 1, 'league.season': 1 });
    await db.collection('fixtures').createIndex({ 'fixture.status.short': 1 });
    await db.collection('teams').createIndex({ 'id': 1 }, { unique: true });
    await db.collection('standings').createIndex({ 'league.id': 1, 'league.season': 1 });
    console.log('✓ Created indexes\n');
    
    // Summary
    console.log('════════════════════════════════════════');
    console.log('✅ Database seeded successfully!');
    console.log('════════════════════════════════════════');
    console.log(`Leagues:   ${leagues.length}`);
    console.log(`Teams:     ${allTeams.length}`);
    console.log(`Fixtures:  ${fixtures.length}`);
    console.log('════════════════════════════════════════\n');
    
    console.log('📊 Fixtures by League:');
    leagues.forEach(league => {
      const count = fixtures.filter(f => f.league.id === league.id).length;
      console.log(`  ${league.name}: ${count} fixtures`);
    });
    
    console.log('\nNext 3 Fixtures:');
    const upcomingFixtures = fixtures.filter(f => f.fixture.status.short === 'NS').slice(0, 3);
    upcomingFixtures.forEach(f => {
      const date = new Date(f.fixture.date).toLocaleDateString();
      console.log(`  ${date}: ${f.teams.home.name} vs ${f.teams.away.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✓ Database connection closed');
  }
}

// Run the seed
seedDatabase();
