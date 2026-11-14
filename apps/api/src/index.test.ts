import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from './index.js';

type InviteCreateResponse = {
  inviteId: string;
  inviteToken: string;
  expiresAtUtc: string;
};

describe('invite lifecycle routes (REQ-001 / REQ-002)', () => {
  const apps: Array<ReturnType<typeof buildServer>> = [];

  async function newApp() {
    const app = buildServer();
    apps.push(app);
    await app.ready();
    return app;
  }

  async function createInviteAsAdmin(app: ReturnType<typeof buildServer>, email = 'invitee@example.com') {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/admin/invites',
      headers: {
        'x-role': 'admin',
        'x-user-id': 'admin-1',
      },
      payload: { email },
    });

    return res;
  }

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it('POST /api/v2/admin/invites allows admin and returns 201', async () => {
    const app = await newApp();

    const res = await createInviteAsAdmin(app);

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as InviteCreateResponse;
    expect(body.inviteId).toBeTypeOf('string');
    expect(body.inviteToken).toBeTypeOf('string');
    expect(body.expiresAtUtc).toBeTypeOf('string');
  });

  it('POST /api/v2/admin/invites blocks non-admin with 403', async () => {
    const app = await newApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/admin/invites',
      headers: { 'x-role': 'user' },
      payload: { email: 'invitee@example.com' },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'FORBIDDEN' });
  });

  it('POST /api/v2/auth/invite/redeem succeeds once and then returns 409', async () => {
    const app = await newApp();

    const inviteRes = await createInviteAsAdmin(app);
    const invite = JSON.parse(inviteRes.body) as InviteCreateResponse;

    const firstRedeem = await app.inject({
      method: 'POST',
      url: '/api/v2/auth/invite/redeem',
      payload: {
        inviteToken: invite.inviteToken,
        email: 'invitee@example.com',
        displayName: 'Invitee',
      },
    });

    expect(firstRedeem.statusCode).toBe(201);

    const secondRedeem = await app.inject({
      method: 'POST',
      url: '/api/v2/auth/invite/redeem',
      payload: {
        inviteToken: invite.inviteToken,
        email: 'invitee@example.com',
        displayName: 'Invitee Again',
      },
    });

    expect(secondRedeem.statusCode).toBe(409);
    expect(JSON.parse(secondRedeem.body)).toMatchObject({ error: 'INVITE_ALREADY_USED' });
  });

  it('POST /api/v2/auth/invite/redeem returns 403 for mismatched email', async () => {
    const app = await newApp();

    const inviteRes = await createInviteAsAdmin(app);
    const invite = JSON.parse(inviteRes.body) as InviteCreateResponse;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/auth/invite/redeem',
      payload: {
        inviteToken: invite.inviteToken,
        email: 'other@example.com',
        displayName: 'Other',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'INVITE_EMAIL_MISMATCH' });
  });

  it('POST /api/v2/auth/invite/redeem returns 410 for revoked invite', async () => {
    const app = await newApp();

    const inviteRes = await createInviteAsAdmin(app);
    const invite = JSON.parse(inviteRes.body) as InviteCreateResponse;

    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/v2/admin/invites/${invite.inviteId}/revoke`,
      headers: { 'x-role': 'admin' },
    });

    expect(revokeRes.statusCode).toBe(200);

    const redeemRes = await app.inject({
      method: 'POST',
      url: '/api/v2/auth/invite/redeem',
      payload: {
        inviteToken: invite.inviteToken,
        email: 'invitee@example.com',
        displayName: 'Invitee',
      },
    });

    expect(redeemRes.statusCode).toBe(410);
    expect(JSON.parse(redeemRes.body)).toMatchObject({ error: 'INVITE_REVOKED' });
  });

  it('POST /api/v2/admin/invites/:inviteId/revoke blocks non-admin with 403', async () => {
    const app = await newApp();

    const inviteRes = await createInviteAsAdmin(app);
    const invite = JSON.parse(inviteRes.body) as InviteCreateResponse;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v2/admin/invites/${invite.inviteId}/revoke`,
      headers: { 'x-role': 'user' },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'FORBIDDEN' });
  });

  it('POST /api/v2/admin/invites/:inviteId/revoke returns 409 for already-used invite', async () => {
    const app = await newApp();

    const inviteRes = await createInviteAsAdmin(app);
    const invite = JSON.parse(inviteRes.body) as InviteCreateResponse;

    const redeemRes = await app.inject({
      method: 'POST',
      url: '/api/v2/auth/invite/redeem',
      payload: {
        inviteToken: invite.inviteToken,
        email: 'invitee@example.com',
        displayName: 'Invitee',
      },
    });

    expect(redeemRes.statusCode).toBe(201);

    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/v2/admin/invites/${invite.inviteId}/revoke`,
      headers: { 'x-role': 'admin' },
    });

    expect(revokeRes.statusCode).toBe(409);
    expect(JSON.parse(revokeRes.body)).toMatchObject({ error: 'INVITE_ALREADY_USED_CANNOT_REVOKE' });
  });
});