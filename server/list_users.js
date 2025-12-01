// One-off script to list users from MongoDB or local users.json (prints only username and role)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs-extra');
const MONGODB_URI = process.env.MONGODB_URI || '';
const USERS_FILE = path.join(__dirname, 'users.json');

(async function main(){
  if (MONGODB_URI) {
    try {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      const db = client.db();
      const col = db.collection('users');
      const docs = await col.find({}, { projection: { _id: 0, username: 1, role: 1 } }).toArray();
      if (!docs.length) {
        console.log('No users found in MongoDB users collection.');
      } else {
        console.log('Users in MongoDB:');
        docs.forEach(d => console.log(`- ${d.username} (${d.role || 'user'})`));
      }
      await client.close();
      return;
    } catch (e) {
      console.error('Failed to list users from MongoDB:', e.message || e);
      // fall through to file
    }
  }

  // Fallback: read local users.json
  try {
    const data = await fs.readJson(USERS_FILE);
    const users = data.users || [];
    if (!users.length) {
      console.log('No users found in local users.json');
    } else {
      console.log('Users in users.json:');
      users.forEach(u => console.log(`- ${u.username} (${u.role || 'user'})`));
    }
  } catch (e) {
    console.error('Failed to read users.json:', e.message || e);
  }
})();
