import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Role } from '@ggg/shared';

export const INVITE_TTL_DAYS = 30;

export type InviteRecord = {
  inviteId: string;
  email: string;
  tokenHash: string;
  createdByAdminUserId: string;
  createdAtUtc: string;
  expiresAtUtc: string;
  revokedAtUtc: string | null;
  usedAtUtc: string | null;
  usedByUserId: string | null;
};

export type UserRecord = {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  createdAtUtc: string;
};

export type InviteLifecycleStore = {
  insertInvite(invite: InviteRecord): Promise<void>;
  findInviteById(inviteId: string): Promise<InviteRecord | null>;
  findInviteByTokenHash(tokenHash: string): Promise<InviteRecord | null>;
  updateInvite(invite: InviteRecord): Promise<void>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  insertUser(user: UserRecord): Promise<void>;
};

export type InviteLifecycleDeps = {
  now: () => Date;
  createId: () => string;
  createInviteToken: () => string;
  hashInviteToken: (token: string) => string;
};

export type CreateInviteInput = {
  email: string;
  createdByAdminUserId: string;
};

export type CreateInviteResult = {
  inviteId: string;
  inviteToken: string;
  expiresAtUtc: string;
};

export type RedeemInviteInput = {
  inviteToken: string;
  email: string;
  displayName: string;
};

export type RedeemInviteResult = {
  user: UserRecord;
  inviteId: string;
};

export type RevokeInviteInput = {
  inviteId: string;
};

export type InviteLifecycleErrorCode =
  | 'INVITE_NOT_FOUND'
  | 'INVITE_REVOKED'
  | 'INVITE_ALREADY_USED'
  | 'INVITE_EXPIRED'
  | 'INVITE_EMAIL_MISMATCH'
  | 'INVITE_ALREADY_REVOKED'
  | 'INVITE_ALREADY_USED_CANNOT_REVOKE'
  | 'USER_ALREADY_EXISTS';

export class InviteLifecycleError extends Error {
  public readonly code: InviteLifecycleErrorCode;

  public constructor(code: InviteLifecycleErrorCode, message: string) {
    super(message);
    this.name = 'InviteLifecycleError';
    this.code = code;
  }
}

function defaultCreateInviteToken(): string {
  return `${randomUUID()}-${randomBytes(16).toString('hex')}`;
}

function defaultHashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toUtcIso(value: Date): string {
  return value.toISOString();
}

function plusDays(start: Date, days: number): Date {
  return new Date(start.getTime() + (days * 24 * 60 * 60 * 1000));
}

export function createDefaultInviteLifecycleDeps(): InviteLifecycleDeps {
  return {
    now: () => new Date(),
    createId: () => randomUUID(),
    createInviteToken: defaultCreateInviteToken,
    hashInviteToken: defaultHashInviteToken,
  };
}

// REQ-001: Invite-only onboarding with 30-day single-use revocable invites.
export async function createInvite(
  store: InviteLifecycleStore,
  input: CreateInviteInput,
  deps: InviteLifecycleDeps = createDefaultInviteLifecycleDeps(),
): Promise<CreateInviteResult> {
  const createdAt = deps.now();
  const inviteToken = deps.createInviteToken();
  const inviteId = deps.createId();

  const invite: InviteRecord = {
    inviteId,
    email: input.email.trim().toLowerCase(),
    tokenHash: deps.hashInviteToken(inviteToken),
    createdByAdminUserId: input.createdByAdminUserId,
    createdAtUtc: toUtcIso(createdAt),
    expiresAtUtc: toUtcIso(plusDays(createdAt, INVITE_TTL_DAYS)),
    revokedAtUtc: null,
    usedAtUtc: null,
    usedByUserId: null,
  };

  await store.insertInvite(invite);

  return {
    inviteId: invite.inviteId,
    inviteToken,
    expiresAtUtc: invite.expiresAtUtc,
  };
}

// REQ-001: Single-use token + expiry + invite-email redemption.
export async function redeemInvite(
  store: InviteLifecycleStore,
  input: RedeemInviteInput,
  deps: InviteLifecycleDeps = createDefaultInviteLifecycleDeps(),
): Promise<RedeemInviteResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const invite = await store.findInviteByTokenHash(deps.hashInviteToken(input.inviteToken));

  if (invite === null) {
    throw new InviteLifecycleError('INVITE_NOT_FOUND', 'Invite token is invalid.');
  }

  if (invite.email !== normalizedEmail) {
    throw new InviteLifecycleError('INVITE_EMAIL_MISMATCH', 'Invite email does not match redemption email.');
  }

  if (invite.revokedAtUtc !== null) {
    throw new InviteLifecycleError('INVITE_REVOKED', 'Invite has been revoked.');
  }

  if (invite.usedAtUtc !== null) {
    throw new InviteLifecycleError('INVITE_ALREADY_USED', 'Invite token has already been used.');
  }

  const now = deps.now();
  const expiry = new Date(invite.expiresAtUtc);
  if (now.getTime() > expiry.getTime()) {
    throw new InviteLifecycleError('INVITE_EXPIRED', 'Invite has expired.');
  }

  const existingUser = await store.findUserByEmail(normalizedEmail);
  if (existingUser !== null) {
    throw new InviteLifecycleError('USER_ALREADY_EXISTS', 'User already exists for invite email.');
  }

  const user: UserRecord = {
    userId: deps.createId(),
    email: normalizedEmail,
    displayName: input.displayName,
    role: 'user',
    createdAtUtc: toUtcIso(now),
  };

  const updatedInvite: InviteRecord = {
    ...invite,
    usedAtUtc: toUtcIso(now),
    usedByUserId: user.userId,
  };

  await store.insertUser(user);
  await store.updateInvite(updatedInvite);

  return {
    user,
    inviteId: invite.inviteId,
  };
}

// REQ-001: Admin can revoke unused invite.
export async function revokeInvite(
  store: InviteLifecycleStore,
  input: RevokeInviteInput,
  deps: InviteLifecycleDeps = createDefaultInviteLifecycleDeps(),
): Promise<InviteRecord> {
  const invite = await store.findInviteById(input.inviteId);

  if (invite === null) {
    throw new InviteLifecycleError('INVITE_NOT_FOUND', 'Invite was not found.');
  }

  if (invite.revokedAtUtc !== null) {
    throw new InviteLifecycleError('INVITE_ALREADY_REVOKED', 'Invite is already revoked.');
  }

  if (invite.usedAtUtc !== null) {
    throw new InviteLifecycleError('INVITE_ALREADY_USED_CANNOT_REVOKE', 'Used invite cannot be revoked.');
  }

  const updatedInvite: InviteRecord = {
    ...invite,
    revokedAtUtc: toUtcIso(deps.now()),
  };

  await store.updateInvite(updatedInvite);

  return updatedInvite;
}

// REQ-002: roles are user/admin, with admin super-role.
export function roleCanAccess(requiredRole: Role, actorRole: Role): boolean {
  if (actorRole === 'admin') {
    return true;
  }

  return requiredRole === actorRole;
}

export function assertRoleCanAccess(requiredRole: Role, actorRole: Role): void {
  if (!roleCanAccess(requiredRole, actorRole)) {
    throw new Error(`Role ${actorRole} cannot access ${requiredRole}-required operation.`);
  }
}
