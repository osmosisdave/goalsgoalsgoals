#!/usr/bin/env node
/**
 * Script to update first 20 gameweeks with results
 * Adds random goal scores and marks fixtures as complete
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function updateFixturesWithResults() {
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
    const matchSelectionsCollection = db.collection('match_selections');
    
    // Get fixtures from rounds 1-20 for season 2025
    const rounds = [];
    for (let i = 1; i <= 20; i++) {
      rounds.push(`Regular Season - ${i}`);
    }
    
    const fixtures = await fixturesCollection.find({
      'league.season': 2025,
      'league.round': { $in: rounds }
    }).toArray();
    
    console.log(`Found ${fixtures.length} fixtures from gameweeks 1-20`);
    
    if (fixtures.length === 0) {
      console.log('No fixtures found to update');
      return;
    }
    
    let updatedCount = 0;
    
    for (const fixture of fixtures) {
      // Generate random scores (0-4 goals per team)
      const homeGoals = Math.floor(Math.random() * 5);
      const awayGoals = Math.floor(Math.random() * 5);
      
      // Generate halftime scores (roughly half of fulltime)
      const homeHT = Math.floor(homeGoals * (0.3 + Math.random() * 0.5));
      const awayHT = Math.floor(awayGoals * (0.3 + Math.random() * 0.5));
      
      // Determine winner
      let homeWinner = null;
      let awayWinner = null;
      if (homeGoals > awayGoals) {
        homeWinner = true;
        awayWinner = false;
      } else if (awayGoals > homeGoals) {
        homeWinner = false;
        awayWinner = true;
      }
      
      // Update the fixture
      await fixturesCollection.updateOne(
        { 'fixture.id': fixture.fixture.id },
        {
          $set: {
            'fixture.status.long': 'Match Finished',
            'fixture.status.short': 'FT',
            'fixture.status.elapsed': 90,
            'goals.home': homeGoals,
            'goals.away': awayGoals,
            'score.halftime.home': homeHT,
            'score.halftime.away': awayHT,
            'score.fulltime.home': homeGoals,
            'score.fulltime.away': awayGoals,
            'teams.home.winner': homeWinner,
            'teams.away.winner': awayWinner
          }
        }
      );
      
      updatedCount++;
    }
    
    console.log(`\n✓ Updated ${updatedCount} fixtures with results`);
    
    // Update match selections status for completed fixtures
    console.log('\nUpdating match selections status...');
    const selectionsUpdateResult = await matchSelectionsCollection.updateMany(
      { 
        round: { $in: rounds },
        season: 2025
      },
      { 
        $set: { status: 'FT' }
      }
    );
    console.log(`✓ Updated ${selectionsUpdateResult.modifiedCount} match selections to FT status`);
    
    // Show sample results
    console.log('\nSample results:');
    const samples = await fixturesCollection.find({
      'league.season': 2025,
      'league.round': 'Regular Season - 1',
      'fixture.status.short': 'FT'
    }).limit(5).toArray();
    
    samples.forEach(f => {
      const result = f.goals.home > f.goals.away ? 'W' : 
                     f.goals.home < f.goals.away ? 'L' : 'D';
      console.log(`  ${f.league.name} GW ${f.league.round}: ${f.teams.home.name} ${f.goals.home}-${f.goals.away} ${f.teams.away.name} (${result})`);
    });
    
    // Show statistics
    const stats = await fixturesCollection.aggregate([
      { 
        $match: { 
          'league.season': 2025,
          'league.round': { $in: rounds },
          'fixture.status.short': 'FT'
        }
      },
      {
        $group: {
          _id: null,
          totalMatches: { $sum: 1 },
          totalGoals: { $sum: { $add: ['$goals.home', '$goals.away'] } },
          homeWins: {
            $sum: {
              $cond: [{ $eq: ['$teams.home.winner', true] }, 1, 0]
            }
          },
          awayWins: {
            $sum: {
              $cond: [{ $eq: ['$teams.away.winner', true] }, 1, 0]
            }
          },
          draws: {
            $sum: {
              $cond: [{ $eq: ['$teams.home.winner', null] }, 1, 0]
            }
          }
        }
      }
    ]).toArray();
    
    if (stats.length > 0) {
      const s = stats[0];
      console.log('\nStatistics for gameweeks 1-20:');
      console.log(`  Total matches: ${s.totalMatches}`);
      console.log(`  Total goals: ${s.totalGoals} (avg ${(s.totalGoals / s.totalMatches).toFixed(2)} per match)`);
      console.log(`  Home wins: ${s.homeWins} (${(s.homeWins / s.totalMatches * 100).toFixed(1)}%)`);
      console.log(`  Away wins: ${s.awayWins} (${(s.awayWins / s.totalMatches * 100).toFixed(1)}%)`);
      console.log(`  Draws: ${s.draws} (${(s.draws / s.totalMatches * 100).toFixed(1)}%)`);
    }
    
  } catch (error) {
    console.error('Error updating fixtures:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the script
updateFixturesWithResults();
