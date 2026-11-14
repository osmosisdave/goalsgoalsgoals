import type { Collection } from 'mongodb';
import type {
  InviteLifecycleStore,
  InviteRecord,
  UserRecord,
} from './invite-lifecycle.js';

export class MongoInviteLifecycleStore implements InviteLifecycleStore {
  public constructor(
    private readonly invitesCollection: Collection<InviteRecord>,
    private readonly usersCollection: Collection<UserRecord>,
  ) {}

  public async insertInvite(invite: InviteRecord): Promise<void> {
    await this.invitesCollection.insertOne(invite);
  }

  public async findInviteById(inviteId: string): Promise<InviteRecord | null> {
    return this.invitesCollection.findOne({ inviteId });
  }

  public async findInviteByTokenHash(tokenHash: string): Promise<InviteRecord | null> {
    return this.invitesCollection.findOne({ tokenHash });
  }

  public async updateInvite(invite: InviteRecord): Promise<void> {
    await this.invitesCollection.replaceOne(
      { inviteId: invite.inviteId },
      invite,
      { upsert: true },
    );
  }

  public async findUserByEmail(email: string): Promise<UserRecord | null> {
    return this.usersCollection.findOne({ email });
  }

  public async insertUser(user: UserRecord): Promise<void> {
    await this.usersCollection.insertOne(user);
  }
}