#!/usr/bin/env node
const bcrypt = require('bcryptjs');
const fs = require('fs-extra');
const path = require('path');

// Load .env when present
try {
  require('dotenv').config();
} catch (e) {}

const MONGODB_URI = process.env.MONGODB_URI || null;
const USERS_FILE = path.join(__dirname, 'users.json');

async function connectMongo(uri) {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  const db = client.db();
  const users = db.collection('users');
  return { client, users };
}

async function ensureUsersFile() {
  const exists = await fs.pathExists(USERS_FILE);
  if (!exists) {
    await fs.writeJson(USERS_FILE, { users: [] }, { spaces: 2 });
  }
}

async function run() {
  const username = process.env.ADMIN_USER || process.argv[2] || 'admin';
  let password = process.env.ADMIN_PASS || process.argv[3];

  if (!password) {
    if (process.stdin.isTTY) {
      // Prompt for password when interactive
      password = await new Promise((resolve) => {
        const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
        rl.question(`Enter password for user '${username}': `, (ans) => {
          rl.close();
          resolve(ans.trim());
        });
      });
    } else {
      console.error('No password provided. Set ADMIN_PASS env var or pass password as second argument.');
      process.exit(2);
    }
  }

  if (!password) {
    console.error('Empty password not allowed.');
    process.exit(3);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  if (MONGODB_URI) {
    console.log('Connecting to MongoDB...');
    let client;
    try {
      const res = await connectMongo(MONGODB_URI);
      client = res.client;
      const users = res.users;
      const existing = await users.findOne({ username });
      if (existing) {
        await users.updateOne({ username }, { $set: { passwordHash, role: 'admin' } });
        console.log(`Updated password for existing user '${username}' in MongoDB.`);
      } else {
        await users.insertOne({ username, passwordHash, role: 'admin' });
        console.log(`Created admin user '${username}' in MongoDB.`);
      }
    } catch (e) {
      console.error('Failed to update MongoDB user:', e);
      process.exit(4);
    } finally {
      if (client) await client.close();
    }
  } else {
    try {
      await ensureUsersFile();
      const data = await fs.readJson(USERS_FILE);
      data.users = data.users || [];
      const idx = data.users.findIndex((u) => u.username === username);
      if (idx >= 0) {
        data.users[idx].passwordHash = passwordHash;
        data.users[idx].role = 'admin';
        console.log(`Updated password for existing user '${username}' in ${USERS_FILE}.`);
      } else {
        data.users.push({ username, passwordHash, role: 'admin' });
        console.log(`Created admin user '${username}' in ${USERS_FILE}.`);
      }
      await fs.writeJson(USERS_FILE, data, { spaces: 2 });
    } catch (e) {
      console.error('Failed to update users.json:', e);
      process.exit(5);
    }
  }

  console.log('Done. You can now sign in with the new credentials.');
  process.exit(0);
}

run();
