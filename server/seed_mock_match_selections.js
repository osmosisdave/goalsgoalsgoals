#!/usr/bin/env node
/**
 * Script to generate mock match selection data
 * Creates 20 match selections per user (one per gameweek)
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function seedMockMatchSelections() {
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
    const usersCollection = db.collection('users');
    const fixturesCollection = db.collection('fixtures');
    const matchSelectionsCollection = db.collection('match_selections');
    
    // Get all non-admin users
    const users = await usersCollection.find({ 
      username: { $ne: 'admin' } 
    }).toArray();
    
    console.log(`Found ${users.length} users`);
    
    if (users.length === 0) {
      console.log('No users found. Please create users first.');
      return;
    }
    
    // Get fixtures grouped by round (gameweek) for season 2025
    const fixturesByRound = {};
    const fixtures = await fixturesCollection.find({ 
      'league.season': 2025 
    }).toArray();
    
    console.log(`Found ${fixtures.length} fixtures for 2025 season`);
    
    fixtures.forEach(f => {
      const roundMatch = f.league.round?.match(/(\d+)$/);
      const roundNum = roundMatch ? parseInt(roundMatch[1]) : 1;
      
      if (!fixturesByRound[roundNum]) {
        fixturesByRound[roundNum] = [];
      }
      fixturesByRound[roundNum].push(f);
    });
    
    const rounds = Object.keys(fixturesByRound).map(Number).sort((a, b) => a - b);
    console.log(`Found ${rounds.length} gameweeks`);
    
    if (rounds.length < 20) {
      console.warn(`Warning: Only ${rounds.length} gameweeks available, need at least 20`);
    }
    
    // Delete existing match selections
    console.log('\nDeleting existing match selections...');
    const deleteResult = await matchSelectionsCollection.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing selections`);
    
    let totalSelections = 0;
    
    // For each user, select one random fixture per gameweek (first 20 gameweeks)
    for (const user of users) {
      console.log(`\nProcessing user: ${user.username}`);
      const selections = [];
      
      // Select one fixture from each of the first 20 gameweeks
      const gameweeksToSelect = rounds.slice(0, 20);
      
      for (const roundNum of gameweeksToSelect) {
        const roundFixtures = fixturesByRound[roundNum];
        
        if (roundFixtures && roundFixtures.length > 0) {
          // Pick a random fixture from this gameweek
          const randomFixture = roundFixtures[Math.floor(Math.random() * roundFixtures.length)];
          
          selections.push({
            username: user.username,
            fixtureId: randomFixture.fixture.id,
            selectedAt: new Date(),
            homeTeam: randomFixture.teams.home.name,
            awayTeam: randomFixture.teams.away.name,
            date: randomFixture.fixture.date,
            leagueId: randomFixture.league.id,
            leagueName: randomFixture.league.name,
            round: randomFixture.league.round,
            season: randomFixture.league.season,
            status: randomFixture.fixture.status.short
          });
        }
      }
      
      if (selections.length > 0) {
        const result = await matchSelectionsCollection.insertMany(selections);
        console.log(`  Created ${result.insertedCount} selections for ${user.username}`);
        totalSelections += result.insertedCount;
      }
    }
    
    console.log(`\n✓ Successfully created ${totalSelections} total match selections`);
    console.log(`✓ ${totalSelections / users.length} selections per user on average`);
    
    // Verify the count
    const count = await matchSelectionsCollection.countDocuments({});
    console.log(`✓ Verified: ${count} match selections in database`);
    
    // Show sample selections
    console.log('\nSample selections:');
    const samples = await matchSelectionsCollection.find({}).limit(5).toArray();
    samples.forEach(s => {
      console.log(`  ${s.username}: ${s.homeTeam} vs ${s.awayTeam} (GW ${s.round})`);
    });
    
  } catch (error) {
    console.error('Error seeding match selections:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the script
seedMockMatchSelections();
