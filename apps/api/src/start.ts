import { buildServer } from './index.js';
import { MongoInviteLifecycleStore } from './auth/mongo-invite-lifecycle-store.js';
import { createMongoRuntimeFromEnv } from './db/mongo.js';
import type { InviteRecord, UserRecord } from './auth/invite-lifecycle.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

const runtime = await createMongoRuntimeFromEnv();

const invites = runtime.db.collection<InviteRecord>('invites');
const users = runtime.db.collection<UserRecord>('users');

const store = new MongoInviteLifecycleStore(invites, users);
const app = buildServer(store);

try {
  await app.listen({ port: PORT, host: HOST });
} catch (error) {
  app.log.error(error);
  await runtime.client.close();
  process.exit(1);
}