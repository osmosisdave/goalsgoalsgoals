import { buildServer } from './index.js';
import type { InviteRecord, UserRecord } from './auth/invite-lifecycle.js';
import { MongoInviteLifecycleStore } from './auth/mongo-invite-lifecycle-store.js';
import { createMongoRuntimeFromEnv } from './db/mongo.js';

const port = Number(process.env.PORT ?? '3000');
const host = process.env.HOST ?? '0.0.0.0';

const runtime = await createMongoRuntimeFromEnv();

const invitesCollection = runtime.db.collection<InviteRecord>('invites');
const usersCollection = runtime.db.collection<UserRecord>('users');

const store = new MongoInviteLifecycleStore(invitesCollection, usersCollection);
const app = buildServer(store);

app.addHook('onClose', async () => {
  await runtime.client.close();
});

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exit(1);
}