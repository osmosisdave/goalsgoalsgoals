import Fastify from 'fastify';
import {
  InviteLifecycleError,
  createInvite,
  redeemInvite,
  revokeInvite,
  type InviteLifecycleStore,
} from './auth/invite-lifecycle.js';
import { InMemoryInviteLifecycleStore } from './auth/in-memory-invite-lifecycle-store.js';

type Role = 'user' | 'admin';

function getActorRole(headerValue: string | undefined): Role {
  return headerValue === 'admin' ? 'admin' : 'user';
}

function mapInviteErrorToHttp(error: InviteLifecycleError): { statusCode: number; message: string } {
  switch (error.code) {
    case 'INVITE_NOT_FOUND':
      return { statusCode: 404, message: error.message };
    case 'INVITE_REVOKED':
    case 'INVITE_EXPIRED':
      return { statusCode: 410, message: error.message };
    case 'INVITE_EMAIL_MISMATCH':
      return { statusCode: 403, message: error.message };
    case 'INVITE_ALREADY_USED':
    case 'INVITE_ALREADY_REVOKED':
    case 'INVITE_ALREADY_USED_CANNOT_REVOKE':
    case 'USER_ALREADY_EXISTS':
      return { statusCode: 409, message: error.message };
    default:
      return { statusCode: 400, message: error.message };
  }
}

function requireAdmin(role: Role): void {
  if (role !== 'admin') {
    throw new Error('ADMIN_REQUIRED');
  }
}

export function buildServer(store: InviteLifecycleStore = new InMemoryInviteLifecycleStore()) {
  const app = Fastify({ logger: true });

  // REQ-001 + REQ-002: admin-only invite creation
  app.post<{ Body: { email: string } }>(
    '/api/v2/admin/invites',
    async (request, reply) => {
      try {
        const role = getActorRole(request.headers['x-role'] as string | undefined);
        requireAdmin(role);

        const createdByAdminUserId = (request.headers['x-user-id'] as string | undefined) ?? 'admin-dev';
        const result = await createInvite(store, {
          email: request.body.email,
          createdByAdminUserId,
        });

        return reply.code(201).send(result);
      } catch (error) {
        if (error instanceof Error && error.message === 'ADMIN_REQUIRED') {
          return reply.code(403).send({ error: 'FORBIDDEN', message: 'Admin role required.' });
        }
        if (error instanceof InviteLifecycleError) {
          const mapped = mapInviteErrorToHttp(error);
          return reply.code(mapped.statusCode).send({ error: error.code, message: mapped.message });
        }
        request.log.error(error);
        return reply.code(500).send({ error: 'INTERNAL_SERVER_ERROR' });
      }
    },
  );

  // REQ-001: invite redemption
  app.post<{ Body: { inviteToken: string; email: string; displayName: string } }>(
    '/api/v2/auth/invite/redeem',
    async (request, reply) => {
      try {
        const result = await redeemInvite(store, request.body);
        return reply.code(201).send(result);
      } catch (error) {
        if (error instanceof InviteLifecycleError) {
          const mapped = mapInviteErrorToHttp(error);
          return reply.code(mapped.statusCode).send({ error: error.code, message: mapped.message });
        }
        request.log.error(error);
        return reply.code(500).send({ error: 'INTERNAL_SERVER_ERROR' });
      }
    },
  );

  // REQ-001 + REQ-002: admin-only invite revocation
  app.post<{ Params: { inviteId: string } }>(
    '/api/v2/admin/invites/:inviteId/revoke',
    async (request, reply) => {
      try {
        const role = getActorRole(request.headers['x-role'] as string | undefined);
        requireAdmin(role);

        const result = await revokeInvite(store, { inviteId: request.params.inviteId });
        return reply.code(200).send(result);
      } catch (error) {
        if (error instanceof Error && error.message === 'ADMIN_REQUIRED') {
          return reply.code(403).send({ error: 'FORBIDDEN', message: 'Admin role required.' });
        }
        if (error instanceof InviteLifecycleError) {
          const mapped = mapInviteErrorToHttp(error);
          return reply.code(mapped.statusCode).send({ error: error.code, message: mapped.message });
        }
        request.log.error(error);
        return reply.code(500).send({ error: 'INTERNAL_SERVER_ERROR' });
      }
    },
  );

  return app;
}