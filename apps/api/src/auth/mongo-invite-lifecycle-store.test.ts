import { describe, expect, it, vi } from 'vitest';
import type { Collection } from 'mongodb';
import type { InviteRecord, UserRecord } from './invite-lifecycle.js';
import { MongoInviteLifecycleStore } from './mongo-invite-lifecycle-store.js';

function inviteRecord(): InviteRecord {
  return {
    inviteId: 'inv-1',
    email: 'invitee@example.com',
    tokenHash: 'hash-1',
    createdByAdminUserId: 'admin-1',
    createdAtUtc: '2026-11-14T10:00:00.000Z',
    expiresAtUtc: '2026-12-14T10:00:00.000Z',
    revokedAtUtc: null,
    usedAtUtc: null,
    usedByUserId: null,
  };
}

function userRecord(): UserRecord {
  return {
    userId: 'user-1',
    email: 'invitee@example.com',
    displayName: 'Invitee',
    role: 'user',
    createdAtUtc: '2026-11-14T10:05:00.000Z',
  };
}

describe('MongoInviteLifecycleStore', () => {
  it('findInviteById queries by inviteId', async () => {
    const invites = {
      insertOne: vi.fn(),
      findOne: vi.fn().mockResolvedValue(inviteRecord()),
      replaceOne: vi.fn(),
    } as unknown as Collection<InviteRecord>;

    const users = {
      insertOne: vi.fn(),
      findOne: vi.fn(),
    } as unknown as Collection<UserRecord>;

    const store = new MongoInviteLifecycleStore(invites, users);
    const result = await store.findInviteById('inv-1');

    expect(invites.findOne).toHaveBeenCalledWith({ inviteId: 'inv-1' });
    expect(result?.inviteId).toBe('inv-1');
  });

  it('findInviteByTokenHash queries by tokenHash', async () => {
    const invites = {
      insertOne: vi.fn(),
      findOne: vi.fn().mockResolvedValue(inviteRecord()),
      replaceOne: vi.fn(),
    } as unknown as Collection<InviteRecord>;

    const users = {
      insertOne: vi.fn(),
      findOne: vi.fn(),
    } as unknown as Collection<UserRecord>;

    const store = new MongoInviteLifecycleStore(invites, users);
    await store.findInviteByTokenHash('hash-1');

    expect(invites.findOne).toHaveBeenCalledWith({ tokenHash: 'hash-1' });
  });

  it('updateInvite replaces by inviteId with upsert', async () => {
    const record = inviteRecord();

    const invites = {
      insertOne: vi.fn(),
      findOne: vi.fn(),
      replaceOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    } as unknown as Collection<InviteRecord>;

    const users = {
      insertOne: vi.fn(),
      findOne: vi.fn(),
    } as unknown as Collection<UserRecord>;

    const store = new MongoInviteLifecycleStore(invites, users);
    await store.updateInvite(record);

    expect(invites.replaceOne).toHaveBeenCalledWith(
      { inviteId: 'inv-1' },
      record,
      { upsert: true },
    );
  });

  it('findUserByEmail queries by email', async () => {
    const invites = {
      insertOne: vi.fn(),
      findOne: vi.fn(),
      replaceOne: vi.fn(),
    } as unknown as Collection<InviteRecord>;

    const users = {
      insertOne: vi.fn(),
      findOne: vi.fn().mockResolvedValue(userRecord()),
    } as unknown as Collection<UserRecord>;

    const store = new MongoInviteLifecycleStore(invites, users);
    const result = await store.findUserByEmail('invitee@example.com');

    expect(users.findOne).toHaveBeenCalledWith({ email: 'invitee@example.com' });
    expect(result?.email).toBe('invitee@example.com');
  });
});