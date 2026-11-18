import { Prisma, type PrismaClient } from "@prisma/client";

import { OrganizationError } from "./errors";
import { normalizeEmail } from "./email";
import type {
  AuditEntry,
  MemberRecord,
  MembershipRecord,
  OrganizationRecord,
  OrganizationStore,
} from "./types";

type MemberRow = {
  id: string;
  organizationId: string;
  userId: string;
  role: MemberRecord["role"];
  createdAt: Date;
  updatedAt: Date;
  user: MemberRecord["user"];
  organization?: OrganizationRecord;
};

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

function toMember(row: MemberRow): MemberRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: row.user,
  };
}

function toMembership(row: MemberRow): MembershipRecord {
  if (!row.organization) {
    throw new OrganizationError("NOT_FOUND", "Workspace not found.");
  }
  return { ...toMember(row), organization: row.organization };
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

const identitySelect = {
  id: true,
  email: true,
  canonicalEmail: true,
  name: true,
  image: true,
} as const;

export function createPrismaOrganizationStore(
  db: PrismaClient,
): OrganizationStore {
  return {
    findOrganization(id) {
      return db.organization.findUnique({ where: { id } });
    },

    async findMemberships(userId) {
      const rows = await db.organizationMember.findMany({
        where: { userId },
        include: { organization: true, user: { select: userSelect } },
        orderBy: { createdAt: "asc" },
      });
      return rows.map((row) => toMembership(row));
    },

    async findMembership(organizationId, userId) {
      const row = await db.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
        include: { organization: true, user: { select: userSelect } },
      });
      return row ? toMembership(row) : null;
    },

    async findPreference(userId) {
      const preference = await db.workspacePreference.findUnique({
        where: { userId },
        select: { activeOrganizationId: true },
      });
      return preference;
    },

    async setActiveOrganization(userId, organizationId) {
      await db.workspacePreference.upsert({
        where: { userId },
        create: { userId, activeOrganizationId: organizationId },
        update: { activeOrganizationId: organizationId },
      });
    },

    async slugExists(slug) {
      const existing = await db.organization.findUnique({
        where: { slug },
        select: { id: true },
      });
      return Boolean(existing);
    },

    async createOrganization(input) {
      try {
        const row = await db.$transaction(async (tx) => {
          const organization = await tx.organization.create({
            data: {
              name: input.name,
              slug: input.slug,
              createdById: input.createdById,
            },
          });
          const member = await tx.organizationMember.create({
            data: {
              organizationId: organization.id,
              userId: input.createdById,
              role: "OWNER",
            },
            include: { user: { select: userSelect }, organization: true },
          });
          await tx.workspacePreference.upsert({
            where: { userId: input.createdById },
            create: {
              userId: input.createdById,
              activeOrganizationId: organization.id,
            },
            update: { activeOrganizationId: organization.id },
          });
          await tx.auditLog.create({
            data: {
              organizationId: organization.id,
              actorId: input.createdById,
              action: "organization.created",
              targetType: "organization",
              targetId: organization.id,
            },
          });
          return member;
        });
        return toMembership(row);
      } catch (error) {
        if (isUniqueConflict(error)) {
          throw new OrganizationError("CONFLICT", "Slug already exists.");
        }
        throw error;
      }
    },

    async updateOrganization(id, data) {
      return db.organization.update({ where: { id }, data });
    },

    async listMembers(input) {
      const rows = await db.organizationMember.findMany({
        where: {
          organizationId: input.organizationId,
          ...(input.cursor
            ? {
                OR: [
                  { createdAt: { gt: input.cursor.createdAt } },
                  {
                    createdAt: input.cursor.createdAt,
                    id: { gt: input.cursor.id },
                  },
                ],
              }
            : {}),
        },
        include: { user: { select: userSelect } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: input.limit + 1,
      });
      return rows.map((row) => toMember(row));
    },

    countMembers(organizationId) {
      return db.organizationMember.count({ where: { organizationId } });
    },

    countOwners(organizationId) {
      return db.organizationMember.count({
        where: { organizationId, role: "OWNER" },
      });
    },

    async findMemberById(memberId) {
      const row = await db.organizationMember.findUnique({
        where: { id: memberId },
        include: { user: { select: userSelect } },
      });
      return row ? toMember(row) : null;
    },

    async findMemberByEmail(organizationId, email) {
      const identity = await db.user.findFirst({
        where: {
          OR: [
            { email: { equals: email, mode: "insensitive" } },
            { canonicalEmail: { equals: email, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      if (!identity) return null;
      const row = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: identity.id },
        },
        include: { user: { select: userSelect } },
      });
      return row ? toMember(row) : null;
    },

    async updateMemberRole(memberId, role) {
      const row = await db.organizationMember.update({
        where: { id: memberId },
        data: { role },
        include: { user: { select: userSelect } },
      });
      return toMember(row);
    },

    async deleteMember(memberId) {
      await db.organizationMember.delete({ where: { id: memberId } });
    },

    async findUserById(id) {
      return db.user.findUnique({ where: { id }, select: identitySelect });
    },

    async findPendingInvitation(organizationId, email) {
      return db.organizationInvitation.findFirst({
        where: {
          organizationId,
          email: normalizeEmail(email),
          status: "PENDING",
        },
      });
    },

    async saveInvitation(input) {
      const email = normalizeEmail(input.email);
      const existing = await db.organizationInvitation.findFirst({
        where: { organizationId: input.organizationId, email, status: "PENDING" },
      });
      if (existing) {
        return db.organizationInvitation.update({
          where: { id: existing.id },
          data: {
            role: input.role,
            token: input.token,
            invitedById: input.invitedById,
            expiresAt: input.expiresAt,
            status: "PENDING",
          },
        });
      }
      return db.organizationInvitation.create({
        data: {
          organizationId: input.organizationId,
          email,
          role: input.role,
          token: input.token,
          invitedById: input.invitedById,
          expiresAt: input.expiresAt,
        },
      });
    },

    async findInvitationByToken(token) {
      const invitation = await db.organizationInvitation.findUnique({
        where: { token },
        include: { organization: true },
      });
      if (!invitation) return null;
      const { organization, ...record } = invitation;
      return { ...record, organization };
    },

    findInvitationById(id) {
      return db.organizationInvitation.findUnique({ where: { id } });
    },

    async markInvitation(id, status, acceptedAt) {
      await db.organizationInvitation.update({
        where: { id },
        data: {
          status,
          ...(acceptedAt !== undefined ? { acceptedAt } : {}),
        },
      });
    },

    listPendingInvitations(organizationId) {
      return db.organizationInvitation.findMany({
        where: { organizationId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    },

    async addMember(input) {
      try {
        const row = await db.organizationMember.create({
          data: input,
          include: { user: { select: userSelect } },
        });
        return toMember(row);
      } catch (error) {
        if (!isUniqueConflict(error)) throw error;
        const existing = await db.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: input.organizationId,
              userId: input.userId,
            },
          },
          include: { user: { select: userSelect } },
        });
        if (!existing) throw error;
        return toMember(existing);
      }
    },

    async writeAudit(entry: AuditEntry) {
      await db.auditLog.create({
        data: {
          organizationId: entry.organizationId ?? null,
          actorId: entry.actorId ?? null,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId ?? null,
          metadata: entry.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    },

    countUserAgents(userId) {
      return db.userAgent.count({ where: { userId } });
    },

    async listInstalledAgents(userId, limit) {
      const rows = await db.userAgent.findMany({
        where: { userId },
        include: { agent: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows.map((row) => ({
        id: row.agentId,
        name: row.agent.name,
        model: row.customModel ?? row.agent.model,
        enabled: row.enabled && row.agent.enabled,
      }));
    },

    countConversations(userId) {
      return db.conversation.count({
        where: { userId, isArchived: false },
      });
    },

    listRecentConversations(userId, limit) {
      return db.conversation.findMany({
        where: { userId, isArchived: false },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: { id: true, title: true, updatedAt: true },
      });
    },

    listSystemAgents() {
      return db.agent.findMany({
        where: { isSystem: true, enabled: true },
        orderBy: { name: "asc" },
        take: 50,
        select: { id: true, name: true, description: true, model: true },
      });
    },

    async installSystemAgents(userId, agentIds) {
      if (agentIds.length === 0) return [];
      const agents = await db.agent.findMany({
        where: { id: { in: agentIds }, isSystem: true, enabled: true },
        select: { id: true },
      });
      if (agents.length !== agentIds.length) {
        return agents.map((agent) => agent.id);
      }
      await db.$transaction(async (tx) => {
        const existing = await tx.userAgent.count({ where: { userId } });
        for (const [index, agent] of agents.entries()) {
          await tx.userAgent.upsert({
            where: { userId_agentId: { userId, agentId: agent.id } },
            create: {
              userId,
              agentId: agent.id,
              enabled: true,
              isDefault: existing === 0 && index === 0,
            },
            update: { enabled: true },
          });
        }
      });
      return agents.map((agent) => agent.id);
    },
  };
}
