#!/usr/bin/env node
/**
 * Clears all documents from the match_selections collection.
 * Run this before re-seeding to start from a clean state:
 *
 *   node clear_mock_match_selections.js
 *   node seed_mock_match_selections.js
 *
 * Or use the npm shortcut: npm run reseed-selections
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function clearMatchSelections() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('MONGODB_URI not found in environment variables');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const collection = client.db('goalsgoalsgoals').collection('match_selections');

    const before = await collection.countDocuments({});
    console.log(`Found ${before} match selection(s) to delete`);

    if (before === 0) {
      console.log('Collection is already empty — nothing to do');
      return;
    }

    const result = await collection.deleteMany({});
    console.log(`✓ Deleted ${result.deletedCount} match selection(s)`);

    const after = await collection.countDocuments({});
    if (after !== 0) {
      console.error(`✗ Unexpected: ${after} document(s) remain after deletion`);
      process.exit(1);
    }

    console.log('✓ Collection is now empty');
  } catch (error) {
    console.error('Error clearing match selections:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Database connection closed');
  }
}

clearMatchSelections();
