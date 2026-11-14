import type {
  InviteLifecycleStore,
  InviteRecord,
  UserRecord,
} from './invite-lifecycle.js';

export class InMemoryInviteLifecycleStore implements InviteLifecycleStore {
  private readonly invites = new Map<string, InviteRecord>();
  private readonly users = new Map<string, UserRecord>();

  public async insertInvite(invite: InviteRecord): Promise<void> {
    this.invites.set(invite.inviteId, invite);
  }

  public async findInviteById(inviteId: string): Promise<InviteRecord | null> {
    return this.invites.get(inviteId) ?? null;
  }

  public async findInviteByTokenHash(tokenHash: string): Promise<InviteRecord | null> {
    for (const invite of this.invites.values()) {
      if (invite.tokenHash === tokenHash) return invite;
    }
    return null;
  }

  public async updateInvite(invite: InviteRecord): Promise<void> {
    this.invites.set(invite.inviteId, invite);
  }

  public async findUserByEmail(email: string): Promise<UserRecord | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  public async insertUser(user: UserRecord): Promise<void> {
    this.users.set(user.userId, user);
  }
}