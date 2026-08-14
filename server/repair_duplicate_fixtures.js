#!/usr/bin/env node

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'goalsgoalsgoals';

const args = process.argv.slice(2);
const seasonArg = args.indexOf('--season');
const SEASON = seasonArg !== -1 ? parseInt(args[seasonArg + 1], 10) : null;
const DRY_RUN = args.includes('--dry-run');

function statusRank(shortStatus) {
  switch (shortStatus) {
    case 'FT':
    case 'AET':
    case 'PEN':
      return 5;
    case '2H':
    case 'HT':
    case '1H':
    case 'ET':
      return 4;
    case 'NS':
      return 3;
    case 'PST':
    case 'SUSP':
    case 'ABD':
    case 'CANC':
      return 2;
    default:
      return 1;
  }
}

function compareFixtures(a, b) {
  const rankDiff = statusRank(b.fixture?.status?.short) - statusRank(a.fixture?.status?.short);
  if (rankDiff !== 0) return rankDiff;

  const aHasScore = Number.isInteger(a.goals?.home) || Number.isInteger(a.goals?.away);
  const bHasScore = Number.isInteger(b.goals?.home) || Number.isInteger(b.goals?.away);
  if (aHasScore !== bHasScore) return bHasScore ? 1 : -1;

  const aTime = new Date(a.fixture?.date || 0).getTime();
  const bTime = new Date(b.fixture?.date || 0).getTime();
  return bTime - aTime;
}

async function main() {
  if (!MONGO_URI) {
    throw new Error('MONGODB_URI not configured');
  }

  const client = new MongoClient(MONGO_URI, { tls: true });
  await client.connect();

  try {
    const db = client.db(DB_NAME);
    const fixtures = db.collection('fixtures');
    const selections = db.collection('match_selections');
    const history = db.collection('match_selection_history');

    const matchStage = {};
    if (SEASON !== null && !Number.isNaN(SEASON)) {
      matchStage['league.season'] = SEASON;
    }

    const duplicateGroups = await fixtures.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            season: '$league.season',
            leagueId: '$league.id',
            round: '$league.round',
            home: '$teams.home.name',
            away: '$teams.away.name',
          },
          count: { $sum: 1 },
          fixtureIds: { $push: '$fixture.id' },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { '_id.season': 1, '_id.leagueId': 1, '_id.round': 1, '_id.home': 1, '_id.away': 1 } },
    ]).toArray();

    if (duplicateGroups.length === 0) {
      console.log('No duplicate fixtures found.');
      return;
    }

    let groupsFixed = 0;
    let fixtureDocsDeleted = 0;
    let selectionsRepointed = 0;
    let historyRepointed = 0;

    for (const group of duplicateGroups) {
      const docs = await fixtures.find(
        { 'fixture.id': { $in: group.fixtureIds } },
        { projection: { _id: 0 } }
      ).toArray();

      if (docs.length < 2) continue;

      docs.sort(compareFixtures);
      const preferredDoc = docs[0];
      const duplicateIds = docs.map(doc => doc.fixture.id);

      const activeRefs = await selections.find(
        { fixtureId: { $in: duplicateIds } },
        { projection: { _id: 0, fixtureId: 1 } }
      ).toArray();
      const historyRefs = await history.find(
        { fixtureId: { $in: duplicateIds } },
        { projection: { _id: 0, fixtureId: 1 } }
      ).toArray();

      const canonicalId = activeRefs[0]?.fixtureId || historyRefs[0]?.fixtureId || docs
        .slice()
        .sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime())[0]
        .fixture.id;

      const canonicalDoc = {
        ...preferredDoc,
        fixture: {
          ...preferredDoc.fixture,
          id: canonicalId,
        },
      };

      const idsToRemove = duplicateIds.filter(id => id !== canonicalId);
      const metadataPatch = {
        fixtureId: canonicalId,
        date: canonicalDoc.fixture.date,
        status: canonicalDoc.fixture.status.short,
        season: canonicalDoc.league.season,
        round: canonicalDoc.league.round,
        leagueName: canonicalDoc.league.name,
        homeTeam: canonicalDoc.teams.home.name,
        awayTeam: canonicalDoc.teams.away.name,
      };

      console.log(`\n[${DRY_RUN ? 'dry-run' : 'repair'}] ${canonicalDoc.league.name} ${canonicalDoc.league.round}`);
      console.log(`  ${canonicalDoc.teams.home.name} vs ${canonicalDoc.teams.away.name}`);
      console.log(`  duplicate ids: ${duplicateIds.join(', ')}`);
      console.log(`  canonical id: ${canonicalId}`);
      console.log(`  preferred status/date: ${canonicalDoc.fixture.status.short} ${canonicalDoc.fixture.date}`);

      if (DRY_RUN) {
        continue;
      }

      await fixtures.updateOne(
        { 'fixture.id': canonicalId },
        { $set: canonicalDoc },
        { upsert: true }
      );

      const selectionResult = await selections.updateMany(
        { fixtureId: { $in: duplicateIds } },
        { $set: metadataPatch }
      );
      const historyResult = await history.updateMany(
        { fixtureId: { $in: duplicateIds } },
        { $set: metadataPatch }
      );

      selectionsRepointed += selectionResult.modifiedCount;
      historyRepointed += historyResult.modifiedCount;

      if (idsToRemove.length > 0) {
        const deleteResult = await fixtures.deleteMany({ 'fixture.id': { $in: idsToRemove } });
        fixtureDocsDeleted += deleteResult.deletedCount;
      }

      groupsFixed++;
    }

    console.log('\nRepair summary:');
    console.log(`  duplicate groups processed: ${groupsFixed}`);
    console.log(`  fixture documents deleted: ${fixtureDocsDeleted}`);
    console.log(`  active selections repointed: ${selectionsRepointed}`);
    console.log(`  history selections repointed: ${historyRepointed}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Repair failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
