import { describe, expect, it } from 'vitest';
import {
  INVITE_TTL_DAYS,
  assertRoleCanAccess,
  createInvite,
  redeemInvite,
  revokeInvite,
  roleCanAccess,
  type InviteLifecycleDeps,
  type InviteLifecycleStore,
  type InviteRecord,
  type UserRecord,
} from './invite-lifecycle.js';

class InMemoryInviteLifecycleStore implements InviteLifecycleStore {
  public readonly invites = new Map<string, InviteRecord>();
  public readonly users = new Map<string, UserRecord>();

  public async insertInvite(invite: InviteRecord): Promise<void> {
    this.invites.set(invite.inviteId, invite);
  }

  public async findInviteById(inviteId: string): Promise<InviteRecord | null> {
    return this.invites.get(inviteId) ?? null;
  }

  public async findInviteByTokenHash(tokenHash: string): Promise<InviteRecord | null> {
    for (const invite of this.invites.values()) {
      if (invite.tokenHash === tokenHash) {
        return invite;
      }
    }

    return null;
  }

  public async updateInvite(invite: InviteRecord): Promise<void> {
    this.invites.set(invite.inviteId, invite);
  }

  public async findUserByEmail(email: string): Promise<UserRecord | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }

    return null;
  }

  public async insertUser(user: UserRecord): Promise<void> {
    this.users.set(user.userId, user);
  }
}

function fixedDeps(nowIsoUtc = '2026-11-14T10:00:00.000Z'): InviteLifecycleDeps {
  let idCounter = 0;

  return {
    now: () => new Date(nowIsoUtc),
    createId: () => {
      idCounter += 1;
      return `id-${idCounter}`;
    },
    createInviteToken: () => 'plain-token',
    hashInviteToken: (token: string) => `hash-${token}`,
  };
}

describe('invite lifecycle (REQ-001)', () => {
  it('creates invite with 30-day expiry and stores hashed token only', async () => {
    const store = new InMemoryInviteLifecycleStore();
    const deps = fixedDeps();

    const result = await createInvite(
      store,
      {
        email: 'Person@Example.COM',
        createdByAdminUserId: 'admin-1',
      },
      deps,
    );

    expect(result.inviteToken).toBe('plain-token');
    expect(result.expiresAtUtc).toBe('2026-12-14T10:00:00.000Z');

    const stored = await store.findInviteById(result.inviteId);
    expect(stored).not.toBeNull();
    expect(stored?.email).toBe('person@example.com');
    expect(stored?.tokenHash).toBe('hash-plain-token');
    expect(stored?.tokenHash).not.toBe('plain-token');

    const createdAt = new Date(stored!.createdAtUtc);
    const expiresAt = new Date(stored!.expiresAtUtc);
    const durationDays = (expiresAt.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
    expect(durationDays).toBe(INVITE_TTL_DAYS);
  });

  it('redeems invite once, creates user role=user, and blocks second redemption', async () => {
    const store = new InMemoryInviteLifecycleStore();
    const deps = fixedDeps();

    await createInvite(
      store,
      {
        email: 'invitee@example.com',
        createdByAdminUserId: 'admin-1',
      },
      deps,
    );

    const redemption = await redeemInvite(
      store,
      {
        inviteToken: 'plain-token',
        email: 'invitee@example.com',
        displayName: 'Invitee',
      },
      deps,
    );

    expect(redemption.user.role).toBe('user');

    await expect(
      redeemInvite(
        store,
        {
          inviteToken: 'plain-token',
          email: 'invitee@example.com',
          displayName: 'Invitee Again',
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'INVITE_ALREADY_USED' });
  });

  it('prevents redemption after revocation', async () => {
    const store = new InMemoryInviteLifecycleStore();
    const deps = fixedDeps();

    const invite = await createInvite(
      store,
      {
        email: 'invitee@example.com',
        createdByAdminUserId: 'admin-1',
      },
      deps,
    );

    await revokeInvite(store, { inviteId: invite.inviteId }, deps);

    await expect(
      redeemInvite(
        store,
        {
          inviteToken: 'plain-token',
          email: 'invitee@example.com',
          displayName: 'Invitee',
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'INVITE_REVOKED' });
  });

  it('prevents redemption after invite expiry', async () => {
    const store = new InMemoryInviteLifecycleStore();

    await createInvite(
      store,
      {
        email: 'invitee@example.com',
        createdByAdminUserId: 'admin-1',
      },
      fixedDeps('2026-11-14T10:00:00.000Z'),
    );

    await expect(
      redeemInvite(
        store,
        {
          inviteToken: 'plain-token',
          email: 'invitee@example.com',
          displayName: 'Invitee',
        },
        fixedDeps('2026-12-14T10:00:00.001Z'),
      ),
    ).rejects.toMatchObject({ code: 'INVITE_EXPIRED' });
  });

  it('prevents redemption for mismatched email', async () => {
    const store = new InMemoryInviteLifecycleStore();
    const deps = fixedDeps();

    await createInvite(
      store,
      {
        email: 'invitee@example.com',
        createdByAdminUserId: 'admin-1',
      },
      deps,
    );

    await expect(
      redeemInvite(
        store,
        {
          inviteToken: 'plain-token',
          email: 'other@example.com',
          displayName: 'Invitee',
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'INVITE_EMAIL_MISMATCH' });
  });
});

describe('role access (REQ-002)', () => {
  it('treats admin as super-role', () => {
    expect(roleCanAccess('admin', 'admin')).toBe(true);
    expect(roleCanAccess('user', 'admin')).toBe(true);
  });

  it('restricts user from admin-only operations', () => {
    expect(roleCanAccess('admin', 'user')).toBe(false);
    expect(() => assertRoleCanAccess('admin', 'user')).toThrowError(
      'Role user cannot access admin-required operation.',
    );
  });

  it('allows user operations for user role', () => {
    expect(roleCanAccess('user', 'user')).toBe(true);
    expect(() => assertRoleCanAccess('user', 'user')).not.toThrow();
  });
});
