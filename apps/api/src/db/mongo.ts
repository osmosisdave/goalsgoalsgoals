import { MongoClient, type Db } from 'mongodb';

export type MongoRuntime = {
  client: MongoClient;
  db: Db;
};

function requireEnv(name: 'MONGODB_URI' | 'MONGODB_DB_NAME'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export async function createMongoRuntimeFromEnv(): Promise<MongoRuntime> {
  const uri = requireEnv('MONGODB_URI');
  const dbName = requireEnv('MONGODB_DB_NAME');

  const client = new MongoClient(uri);
  await client.connect();

  return {
    client,
    db: client.db(dbName),
  };
}