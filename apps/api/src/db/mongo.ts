import { MongoClient, type Db } from 'mongodb';

export type MongoRuntime = {
  client: MongoClient;
  db: Db;
};

export async function createMongoRuntimeFromEnv(): Promise<MongoRuntime> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;

  if (!uri) throw new Error('MONGODB_URI is required.');
  if (!dbName) throw new Error('MONGODB_DB_NAME is required.');

  const client = new MongoClient(uri);
  await client.connect();

  return {
    client,
    db: client.db(dbName),
  };
}