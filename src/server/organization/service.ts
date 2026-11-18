import { randomBytes } from "node:crypto";

import { OrganizationError } from "./errors";
import { emailsMatch, normalizeEmail } from "./email";
import {
  INDUSTRIES,
  OBJECTIVES,
  isIndustry,
  isObjective,
} from "@/lib/organization-catalog";
import {
  canAssignRole,
  canManageTeam,
  canRemoveMember,
  canUpdateWorkspace,
} from "./policy";
import { slugify } from "./slug";
import type {
  InvitationRecord,
  MemberCursor,
  MembershipRecord,
  OrganizationRecord,
  OrganizationRole,
  OrganizationStatus,
  OrganizationStore,
} from "./types";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface OrganizationEventSink {
  emit(
    event: "organization:created" | "organization:member-joined",
    payload: { organizationId: string; userId: string; role?: string },
  ): Promise<void>;
}

export interface OrganizationServiceOptions {
  now?: () => Date;
  createToken?: () => string;
  events?: OrganizationEventSink;
}

export interface TeamPage {
  members: Awaited<ReturnType<OrganizationStore["listMembers"]>>;
  nextCursor: string | null;
  invitations: Array<{
    id: string;
    email: string;
    role: OrganizationRole;
    expiresAt: Date;
    acceptPath: string | null;
  }>;
}

function encodeCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

export function decodeMemberCursor(cursor: string): MemberCursor {
  const separator = cursor.lastIndexOf("|");
  const createdAt = new Date(cursor.slice(0, separator));
  const id = cursor.slice(separator + 1);
  if (separator <= 0 || Number.isNaN(createdAt.getTime()) || !id) {
    throw new OrganizationError("VALIDATION", "That page cursor is invalid.");
  }
  return { createdAt, id };
}

export function createOrganizationService(
  store: OrganizationStore,
  options: OrganizationServiceOptions = {},
) {
  const now = options.now ?? (() => new Date());
  const createToken =
    options.createToken ?? (() => randomBytes(24).toString("hex"));

  async function publish(
    event: "organization:created" | "organization:member-joined",
    payload: { organizationId: string; userId: string; role?: string },
  ) {
    if (!options.events) return;
    await options.events.emit(event, payload);
  }

  async function getWorkspace(userId: string): Promise<MembershipRecord | null> {
    const memberships = await store.findMemberships(userId);
    const first = memberships[0];
    if (!first) return null;
    const preference = await store.findPreference(userId);
    const active =
      memberships.find(
        (member) => member.organizationId === preference?.activeOrganizationId,
      ) ?? first;
    if (preference?.activeOrganizationId !== active.organizationId) {
      await store.setActiveOrganization(userId, active.organizationId);
    }
    return active;
  }

  async function requireWorkspace(userId: string): Promise<MembershipRecord> {
    const current = await getWorkspace(userId);
    if (!current) {
      throw new OrganizationError("NOT_FOUND", "Create a workspace first.");
    }
    return current;
  }

  function assertActive(organization: OrganizationRecord) {
    if (organization.status !== "ACTIVE") {
      throw new OrganizationError(
        "SUSPENDED",
        "This workspace is suspended.",
      );
    }
  }

  function assertCanUpdate(role: OrganizationRole) {
    if (!canUpdateWorkspace(role)) {
      throw new OrganizationError(
        "FORBIDDEN",
        "You cannot change this workspace.",
      );
    }
  }

  async function listActiveInvitations(
    organizationId: string,
    includePath: boolean,
  ) {
    const invitations = await store.listPendingInvitations(organizationId);
    const visible: TeamPage["invitations"] = [];
    for (const invitation of invitations) {
      if (invitation.expiresAt.getTime() <= now().getTime()) {
        await store.markInvitation(invitation.id, "EXPIRED");
        continue;
      }
      visible.push(toPublicInvitation(invitation, includePath));
    }
    return visible;
  }

  return {
    industries: INDUSTRIES,
    objectives: OBJECTIVES,

    getWorkspace,

    async overview(userId: string) {
      const memberships = await store.findMemberships(userId);
      const current = await getWorkspace(userId);
      const workspaces = memberships.map((member) => ({
        id: member.organization.id,
        name: member.organization.name,
        slug: member.organization.slug,
        role: member.role,
      }));
      if (!current) {
        return {
          organization: null,
          role: null,
          workspaces,
          capabilities: { manageTeam: false, updateWorkspace: false },
          stats: { members: 0, installedAgents: 0, conversations: 0 },
          agents: [],
          conversations: [],
        };
      }
      const [members, installedAgents, conversations, agents, recent] =
        await Promise.all([
          store.countMembers(current.organizationId),
          store.countUserAgents(userId),
          store.countConversations(userId),
          store.listInstalledAgents(userId, 8),
          store.listRecentConversations(userId, 5),
        ]);
      return {
        organization: current.organization,
        role: current.role,
        workspaces,
        capabilities: {
          manageTeam: canManageTeam(current.role),
          updateWorkspace: canUpdateWorkspace(current.role),
        },
        stats: {
          members,
          installedAgents,
          conversations,
        },
        agents,
        conversations: recent,
      };
    },

    async createOrganization(userId: string, name: string) {
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 80) {
        throw new OrganizationError(
          "VALIDATION",
          "Workspace name must be between 2 and 80 characters.",
        );
      }
      const base = slugify(trimmed);
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
        if (await store.slugExists(slug)) continue;
        try {
          const membership = await store.createOrganization({
            name: trimmed,
            slug,
            createdById: userId,
          });
          await publish("organization:created", {
            organizationId: membership.organization.id,
            userId,
          });
          return membership;
        } catch (error) {
          if (
            error instanceof OrganizationError &&
            error.code === "CONFLICT"
          ) {
            continue;
          }
          throw error;
        }
      }
      throw new OrganizationError(
        "CONFLICT",
        "Could not reserve a workspace URL. Try a different name.",
      );
    },

    async renameOrganization(userId: string, name: string) {
      const current = await requireWorkspace(userId);
      assertActive(current.organization);
      assertCanUpdate(current.role);
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 80) {
        throw new OrganizationError(
          "VALIDATION",
          "Workspace name must be between 2 and 80 characters.",
        );
      }
      const organization = await store.updateOrganization(current.organizationId, {
        name: trimmed,
      });
      await store.writeAudit({
        organizationId: organization.id,
        actorId: userId,
        action: "organization.renamed",
        targetType: "organization",
        targetId: organization.id,
      });
      return organization;
    },

    async saveIndustry(userId: string, industry: string) {
      if (!isIndustry(industry)) {
        throw new OrganizationError("VALIDATION", "Choose a supported industry.");
      }
      const current = await requireWorkspace(userId);
      assertActive(current.organization);
      assertCanUpdate(current.role);
      return store.updateOrganization(current.organizationId, {
        industry,
        onboardingStep: Math.max(current.organization.onboardingStep, 2),
      });
    },

    async saveObjectives(userId: string, objectives: string[]) {
      const unique = [...new Set(objectives)];
      if (
        unique.length < 1 ||
        unique.length > OBJECTIVES.length ||
        unique.some((objective) => !isObjective(objective))
      ) {
        throw new OrganizationError(
          "VALIDATION",
          "Choose at least one supported objective.",
        );
      }
      const current = await requireWorkspace(userId);
      assertActive(current.organization);
      assertCanUpdate(current.role);
      return store.updateOrganization(current.organizationId, {
        objectives: unique,
        onboardingStep: Math.max(current.organization.onboardingStep, 3),
      });
    },

    async selectAgents(userId: string, agentIds: string[]) {
      const current = await requireWorkspace(userId);
      assertActive(current.organization);
      assertCanUpdate(current.role);
      const unique = [...new Set(agentIds)];
      const installed = await store.installSystemAgents(userId, unique);
      if (installed.length !== unique.length) {
        throw new OrganizationError(
          "VALIDATION",
          "One or more agents are not available to install.",
        );
      }
      return store.updateOrganization(current.organizationId, {
        onboardingStep: Math.max(current.organization.onboardingStep, 4),
      });
    },

    async completeOnboarding(userId: string) {
      const current = await requireWorkspace(userId);
      assertActive(current.organization);
      assertCanUpdate(current.role);
      if (current.organization.onboardingCompletedAt) return current.organization;
      if (!current.organization.industry || current.organization.objectives.length === 0) {
        throw new OrganizationError(
          "VALIDATION",
          "Choose an industry and at least one objective before opening the dashboard.",
        );
      }
      const organization = await store.updateOrganization(current.organizationId, {
        onboardingStep: 6,
        onboardingCompletedAt: now(),
      });
      await store.writeAudit({
        organizationId: organization.id,
        actorId: userId,
        action: "organization.onboarding-completed",
        targetType: "organization",
        targetId: organization.id,
      });
      return organization;
    },

    async switchOrganization(userId: string, organizationId: string) {
      const membership = await store.findMembership(organizationId, userId);
      if (!membership) {
        throw new OrganizationError("NOT_FOUND", "Workspace not found.");
      }
      await store.setActiveOrganization(userId, organizationId);
      return membership;
    },

    async listTeam(
      userId: string,
      input: { cursor?: string; limit?: number } = {},
    ): Promise<TeamPage> {
      const current = await requireWorkspace(userId);
      const limit = input.limit ?? 20;
      const rows = await store.listMembers({
        organizationId: current.organizationId,
        cursor: input.cursor ? decodeMemberCursor(input.cursor) : null,
        limit,
      });
      const hasMore = rows.length > limit;
      const members = hasMore ? rows.slice(0, limit) : rows;
      const last = members[members.length - 1];
      const invitations = await listActiveInvitations(
        current.organizationId,
        canManageTeam(current.role),
      );
      return {
        members,
        nextCursor:
          hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
        invitations,
      };
    },

    async invite(userId: string, email: string, role: OrganizationRole) {
      const current = await requireWorkspace(userId);
      assertActive(current.organization);
      if (!canManageTeam(current.role) || role === "OWNER" || !canAssignRole(current.role, role)) {
        throw new OrganizationError("FORBIDDEN", "You cannot invite members.");
      }
      const actor = await store.findUserById(userId);
      if (!actor?.email && !actor?.canonicalEmail) {
        throw new OrganizationError(
          "VALIDATION",
          "Add an email to your account before inviting people.",
        );
      }
      const normalized = normalizeEmail(email);
      if (actor && emailsMatch(actor, normalized)) {
        throw new OrganizationError(
          "CONFLICT",
          "You are already in this workspace.",
        );
      }
      const existing = await store.findMemberByEmail(
        current.organizationId,
        normalized,
      );
      if (existing) {
        throw new OrganizationError(
          "CONFLICT",
          "That person is already a member.",
        );
      }
      const invitation = await store.saveInvitation({
        organizationId: current.organizationId,
        email: normalized,
        role,
        token: createToken(),
        invitedById: userId,
        expiresAt: new Date(now().getTime() + INVITE_TTL_MS),
      });
      await store.writeAudit({
        organizationId: current.organizationId,
        actorId: userId,
        action: "organization.member-invited",
        targetType: "invitation",
        targetId: invitation.id,
        metadata: { role },
      });
      return {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        acceptPath: `/dashboard/invitations/${invitation.token}`,
        organizationName: current.organization.name,
      };
    },

    async revokeInvitation(userId: string, invitationId: string) {
      const current = await requireWorkspace(userId);
      assertActive(current.organization);
      if (!canManageTeam(current.role)) {
        throw new OrganizationError(
          "FORBIDDEN",
          "You cannot revoke invitations.",
        );
      }
      const invitation = await store.findInvitationById(invitationId);
      if (
        !invitation ||
        invitation.organizationId !== current.organizationId ||
        invitation.status !== "PENDING"
      ) {
        throw new OrganizationError("NOT_FOUND", "Invitation not found.");
      }
      await store.markInvitation(invitation.id, "REVOKED");
      await store.writeAudit({
        organizationId: current.organizationId,
        actorId: userId,
        action: "organization.invitation-revoked",
        targetType: "invitation",
        targetId: invitation.id,
      });
    },

    async acceptInvitation(userId: string, token: string) {
      const invitation = await store.findInvitationByToken(token);
      if (!invitation) {
        throw new OrganizationError("NOT_FOUND", "Invitation not found.");
      }
      if (invitation.status === "REVOKED") {
        throw new OrganizationError(
          "VALIDATION",
          "This invitation has been revoked.",
        );
      }
      if (
        invitation.status === "PENDING" &&
        invitation.expiresAt.getTime() <= now().getTime()
      ) {
        await store.markInvitation(invitation.id, "EXPIRED");
        throw new OrganizationError("VALIDATION", "This invitation has expired.");
      }
      if (invitation.organization.status !== "ACTIVE") {
        throw new OrganizationError("SUSPENDED", "This workspace is suspended.");
      }
      const actor = await store.findUserById(userId);
      if (!actor || !emailsMatch(actor, invitation.email)) {
        throw new OrganizationError(
          "FORBIDDEN",
          "Sign in with the invited email address.",
        );
      }
      if (invitation.role === "OWNER") {
        throw new OrganizationError(
          "VALIDATION",
          "This invitation cannot be accepted.",
        );
      }
      const existing = await store.findMembership(
        invitation.organizationId,
        userId,
      );
      const member =
        existing ??
        (await store.addMember({
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role,
        }));
      if (invitation.status !== "ACCEPTED") {
        await store.markInvitation(invitation.id, "ACCEPTED", now());
        await store.writeAudit({
          organizationId: invitation.organizationId,
          actorId: userId,
          action: "organization.member-joined",
          targetType: "member",
          targetId: member.id,
          metadata: { role: member.role },
        });
        await publish("organization:member-joined", {
          organizationId: invitation.organizationId,
          userId,
          role: member.role,
        });
      }
      await store.setActiveOrganization(userId, invitation.organizationId);
      return member;
    },

    async updateMemberRole(
      userId: string,
      memberId: string,
      role: OrganizationRole,
    ) {
      const current = await requireWorkspace(userId);
      assertActive(current.organization);
      if (!canManageTeam(current.role) || !canAssignRole(current.role, role)) {
        throw new OrganizationError("FORBIDDEN", "You cannot assign that role.");
      }
      const member = await store.findMemberById(memberId);
      if (!member || member.organizationId !== current.organizationId) {
        throw new OrganizationError("NOT_FOUND", "Member not found.");
      }
      if (member.role === "OWNER" && !canAssignRole(current.role, "OWNER")) {
        throw new OrganizationError(
          "FORBIDDEN",
          "Only an owner can change an owner.",
        );
      }
      if (member.role === "OWNER" && role !== "OWNER") {
        const owners = await store.countOwners(current.organizationId);
        if (owners <= 1) {
          throw new OrganizationError(
            "CONFLICT",
            "The workspace must keep at least one owner.",
          );
        }
      }
      if (member.userId === userId) {
        throw new OrganizationError(
          "FORBIDDEN",
          "You cannot change your own role.",
        );
      }
      const updated = await store.updateMemberRole(member.id, role);
      await store.writeAudit({
        organizationId: current.organizationId,
        actorId: userId,
        action: "organization.member-role-changed",
        targetType: "member",
        targetId: member.id,
        metadata: { role },
      });
      return updated;
    },

    async removeMember(userId: string, memberId: string) {
      const current = await requireWorkspace(userId);
      assertActive(current.organization);
      const member = await store.findMemberById(memberId);
      if (!member || member.organizationId !== current.organizationId) {
        throw new OrganizationError("NOT_FOUND", "Member not found.");
      }
      if (member.userId === userId) {
        throw new OrganizationError(
          "FORBIDDEN",
          "You cannot remove yourself from the workspace.",
        );
      }
      if (!canRemoveMember(current.role, member.role)) {
        throw new OrganizationError("FORBIDDEN", "You cannot remove that member.");
      }
      if (member.role === "OWNER") {
        const owners = await store.countOwners(current.organizationId);
        if (owners <= 1) {
          throw new OrganizationError(
            "CONFLICT",
            "The workspace must keep at least one owner.",
          );
        }
      }
      await store.deleteMember(member.id);
      await store.writeAudit({
        organizationId: current.organizationId,
        actorId: userId,
        action: "organization.member-removed",
        targetType: "member",
        targetId: member.id,
      });
    },

    listSystemAgents() {
      return store.listSystemAgents();
    },

    async setStatus(input: {
      actorIsPlatformAdmin: boolean;
      organizationId: string;
      status: OrganizationStatus;
    }) {
      if (!input.actorIsPlatformAdmin) {
        throw new OrganizationError(
          "FORBIDDEN",
          "Platform administrator access is required.",
        );
      }
      const organization = await store.findOrganization(input.organizationId);
      if (!organization) {
        throw new OrganizationError("NOT_FOUND", "Workspace not found.");
      }
      const updated = await store.updateOrganization(organization.id, {
        status: input.status,
      });
      await store.writeAudit({
        organizationId: organization.id,
        action:
          input.status === "SUSPENDED"
            ? "organization.suspended"
            : "organization.resumed",
        targetType: "organization",
        targetId: organization.id,
      });
      return updated;
    },
  };
}

function toPublicInvitation(invitation: InvitationRecord, includePath: boolean) {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
    acceptPath: includePath
      ? `/dashboard/invitations/${invitation.token}`
      : null,
  };
}
