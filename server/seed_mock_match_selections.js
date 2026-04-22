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
    
    // Build gameweeks using the same qualifying rules as the /api/football/gameweeks endpoint:
    //   - Saturday: 15:00 UK local kickoffs only
    //   - Other days: 19:00–20:00 UK local kickoffs only
    //   - Only date-groups with >= 30 qualifying fixtures become a gameweek
    // Then restrict to gameweeks that are currently unlocked:
    //   - GW1 is always unlocked
    //   - GWN unlocks at 10:00 UTC the day after GW(N-1)'s date
    const fixtures = await fixturesCollection.find({
      'league.season': 2025
    }).sort({ 'fixture.date': 1 }).toArray();

    console.log(`Found ${fixtures.length} fixtures for 2025 season`);

    function toUKParts(isoDate) {
      const d = new Date(isoDate);
      const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
        weekday: 'short',
      });
      const parts = fmt.formatToParts(d);
      const get = (type) => parts.find(p => p.type === type)?.value ?? '';
      const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
      return {
        dayOfWeek: weekdayMap[get('weekday')] ?? -1,
        hour: parseInt(get('hour'), 10),
        dateStr: `${get('year')}-${get('month')}-${get('day')}`,
      };
    }

    const byDate = {};
    for (const f of fixtures) {
      const isoDate = f?.fixture?.date;
      if (!isoDate) continue;
      const { dayOfWeek, hour, dateStr } = toUKParts(isoDate);
      const qualifies = dayOfWeek === 6 ? hour === 15 : (hour === 19 || hour === 20);
      if (!qualifies) continue;
      if (!byDate[dateStr]) byDate[dateStr] = [];
      byDate[dateStr].push(f);
    }

    const qualifyingDates = Object.entries(byDate)
      .filter(([, fxs]) => fxs.length >= 30)
      .sort(([a], [b]) => a.localeCompare(b));

    const now = new Date();

    // Build gameweeks, keeping only those that are currently unlocked
    const gameweeks = qualifyingDates
      .map(([dateStr, fxs], idx) => {
        let isLocked = false;
        if (idx > 0) {
          const prevDate = qualifyingDates[idx - 1][0];
          const unlockDate = new Date(`${prevDate}T10:00:00Z`);
          unlockDate.setUTCDate(unlockDate.getUTCDate() + 1);
          isLocked = now < unlockDate;
        }
        return { number: idx + 1, dateStr, fixtures: fxs, isLocked };
      })
      .filter(gw => !gw.isLocked);

    console.log(`Found ${qualifyingDates.length} total gameweeks, ${gameweeks.length} currently unlocked`);

    if (gameweeks.length === 0) {
      console.log('No unlocked gameweeks available yet.');
      return;
    }

    // Delete existing match selections
    console.log('\nDeleting existing match selections...');
    const deleteResult = await matchSelectionsCollection.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing selections`);

    let totalSelections = 0;

    // For each user, select one random fixture per unlocked gameweek
    for (const user of users) {
      console.log(`\nProcessing user: ${user.username}`);
      const selections = [];

      const gameweeksToSelect = gameweeks;
      
      for (const gw of gameweeksToSelect) {
        if (gw.fixtures.length > 0) {
          // Pick a random fixture from this gameweek
          const randomFixture = gw.fixtures[Math.floor(Math.random() * gw.fixtures.length)];

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
    
    console.log(`\n✓ Successfully created ${totalSelections} total match selections across ${gameweeks.length} unlocked gameweeks`);
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
