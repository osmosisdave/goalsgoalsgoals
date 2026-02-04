// One-off script to create an initial admin user using INIT_ADMIN_PASS from server/.env
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs-extra');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || '';
const USERS_FILE = path.join(__dirname, 'users.json');

(async function main(){
  // Accept password via CLI: `node create_admin.js yourPassword` or `node create_admin.js --password=yourPassword`
  const argv = process.argv.slice(2);
  let adminPass = '';
  if (argv.length) {
    // support `--password=...` or positional arg
    const flag = argv.find(a => a.startsWith('--password='));
    if (flag) adminPass = flag.split('=')[1];
    else adminPass = argv[0];
  }
  // fallback to ADMIN_PASS env var if provided (not recommended for long-term storage)
  if (!adminPass) adminPass = process.env.ADMIN_PASS || '';
  if (!adminPass) {
    console.error('Admin password not provided. Usage: node create_admin.js --password=YourPassword');
    process.exit(1);
  }
  const username = 'admin';
  const role = 'admin';
  const passwordHash = await bcrypt.hash(adminPass, 12);

  if (MONGODB_URI) {
    try {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      const db = client.db('goalsgoalsgoals');
      const col = db.collection('users');
      const existing = await col.findOne({ username });
      if (existing) {
        console.log('Admin user already exists in MongoDB (database: goalsgoalsgoals). No changes made.');
      } else {
        await col.insertOne({ username, passwordHash, role });
        console.log('Created admin user in MongoDB (username: admin, database: goalsgoalsgoals)');
      }
      await client.close();
      return;
    } catch (e) {
      console.error('Failed to create admin in MongoDB:', e.message || e);
      process.exit(1);
    }
  }

  // Fallback: write to users.json
  try {
    const data = await fs.readJson(USERS_FILE).catch(() => ({ users: [] }));
    data.users = data.users || [];
    const existing = data.users.find(u => u.username === username);
    if (existing) {
      console.log('Admin user already exists in users.json. No changes made.');
    } else {
      data.users.push({ username, passwordHash, role });
      await fs.writeJson(USERS_FILE, data, { spaces: 2 });
      console.log('Created admin user in users.json (username: admin)');
    }
  } catch (e) {
    console.error('Failed to write users.json:', e.message || e);
    process.exit(1);
  }
})();
