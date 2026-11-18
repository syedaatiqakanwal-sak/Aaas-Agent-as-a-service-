import { randomUUID } from "node:crypto";

import { OrganizationError } from "./errors";
import { emailsMatch, normalizeEmail } from "./email";
import type {
  AccountIdentity,
  AuditEntry,
  InvitationRecord,
  MemberRecord,
  MembershipRecord,
  OrganizationRecord,
  OrganizationStore,
} from "./types";

interface StoredMember {
  id: string;
  organizationId: string;
  userId: string;
  role: MemberRecord["role"];
  createdAt: Date;
  updatedAt: Date;
}

export class MemoryOrganizationStore implements OrganizationStore {
  organizations = new Map<string, OrganizationRecord>();
  members: StoredMember[] = [];
  invitations: InvitationRecord[] = [];
  preferences = new Map<string, string>();
  identities = new Map<string, AccountIdentity>();
  audits: AuditEntry[] = [];
  systemAgents = new Map<
    string,
    { id: string; name: string; description: string | null; model: string }
  >();
  installed = new Map<string, Set<string>>();
  conversations = new Map<
    string,
    Array<{ id: string; title: string | null; updatedAt: Date }>
  >();

  registerUser(user: AccountIdentity) {
    this.identities.set(user.id, user);
  }

  async findOrganization(id: string) {
    return this.organizations.get(id) ?? null;
  }

  async findMemberships(userId: string) {
    return this.members
      .filter((member) => member.userId === userId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((member) => this.toMembership(member));
  }

  async findMembership(organizationId: string, userId: string) {
    const member = this.members.find(
      (entry) => entry.organizationId === organizationId && entry.userId === userId,
    );
    return member ? this.toMembership(member) : null;
  }

  async findPreference(userId: string) {
    if (!this.preferences.has(userId)) return null;
    return { activeOrganizationId: this.preferences.get(userId) ?? null };
  }

  async setActiveOrganization(userId: string, organizationId: string) {
    this.preferences.set(userId, organizationId);
  }

  async slugExists(slug: string) {
    return [...this.organizations.values()].some((organization) => organization.slug === slug);
  }

  async createOrganization(input: {
    name: string;
    slug: string;
    createdById: string;
  }) {
    if (await this.slugExists(input.slug)) {
      throw new OrganizationError("CONFLICT", "Slug already exists.");
    }
    const timestamp = new Date();
    const organization: OrganizationRecord = {
      id: randomUUID(),
      name: input.name,
      slug: input.slug,
      industry: null,
      objectives: [],
      status: "ACTIVE",
      onboardingStep: 1,
      onboardingCompletedAt: null,
      createdById: input.createdById,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.organizations.set(organization.id, organization);
    const member: StoredMember = {
      id: randomUUID(),
      organizationId: organization.id,
      userId: input.createdById,
      role: "OWNER",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.members.push(member);
    this.preferences.set(input.createdById, organization.id);
    await this.writeAudit({
      organizationId: organization.id,
      actorId: input.createdById,
      action: "organization.created",
      targetType: "organization",
      targetId: organization.id,
    });
    return this.toMembership(member);
  }

  async updateOrganization(
    id: string,
    data: Partial<
      Pick<
        OrganizationRecord,
        | "name"
        | "industry"
        | "objectives"
        | "status"
        | "onboardingStep"
        | "onboardingCompletedAt"
      >
    >,
  ) {
    const organization = this.organizations.get(id);
    if (!organization) {
      throw new OrganizationError("NOT_FOUND", "Workspace not found.");
    }
    const updated = { ...organization, ...data, updatedAt: new Date() };
    this.organizations.set(id, updated);
    return updated;
  }

  async listMembers(input: {
    organizationId: string;
    cursor?: { createdAt: Date; id: string } | null;
    limit: number;
  }) {
    const cursor = input.cursor;
    return this.members
      .filter((member) => member.organizationId === input.organizationId)
      .filter((member) => {
        if (!cursor) return true;
        const time = member.createdAt.getTime();
        const cursorTime = cursor.createdAt.getTime();
        return time > cursorTime || (time === cursorTime && member.id > cursor.id);
      })
      .sort(
        (left, right) =>
          left.createdAt.getTime() - right.createdAt.getTime() ||
          left.id.localeCompare(right.id),
      )
      .slice(0, input.limit + 1)
      .map((member) => this.toMember(member));
  }

  async countMembers(organizationId: string) {
    return this.members.filter((member) => member.organizationId === organizationId).length;
  }

  async countOwners(organizationId: string) {
    return this.members.filter(
      (member) => member.organizationId === organizationId && member.role === "OWNER",
    ).length;
  }

  async findMemberById(memberId: string) {
    const member = this.members.find((entry) => entry.id === memberId);
    return member ? this.toMember(member) : null;
  }

  async findMemberByEmail(organizationId: string, email: string) {
    const member = this.members.find((entry) => {
      if (entry.organizationId !== organizationId) return false;
      const identity = this.identities.get(entry.userId);
      return identity ? emailsMatch(identity, email) : false;
    });
    return member ? this.toMember(member) : null;
  }

  async updateMemberRole(memberId: string, role: MemberRecord["role"]) {
    const member = this.members.find((entry) => entry.id === memberId);
    if (!member) throw new OrganizationError("NOT_FOUND", "Member not found.");
    member.role = role;
    member.updatedAt = new Date();
    return this.toMember(member);
  }

  async deleteMember(memberId: string) {
    this.members = this.members.filter((member) => member.id !== memberId);
  }

  async findUserById(id: string) {
    return this.identities.get(id) ?? null;
  }

  async findPendingInvitation(organizationId: string, email: string) {
    return (
      this.invitations.find(
        (invitation) =>
          invitation.organizationId === organizationId &&
          invitation.email === normalizeEmail(email) &&
          invitation.status === "PENDING",
      ) ?? null
    );
  }

  async saveInvitation(input: {
    organizationId: string;
    email: string;
    role: InvitationRecord["role"];
    token: string;
    invitedById: string;
    expiresAt: Date;
  }): Promise<InvitationRecord> {
    const email = normalizeEmail(input.email);
    const existing = await this.findPendingInvitation(input.organizationId, email);
    if (existing) {
      existing.role = input.role;
      existing.token = input.token;
      existing.invitedById = input.invitedById;
      existing.expiresAt = input.expiresAt;
      existing.status = "PENDING";
      return existing;
    }
    const invitation: InvitationRecord = {
      id: randomUUID(),
      organizationId: input.organizationId,
      email,
      role: input.role,
      token: input.token,
      status: "PENDING",
      invitedById: input.invitedById,
      expiresAt: input.expiresAt,
      acceptedAt: null,
      createdAt: new Date(),
    };
    this.invitations.push(invitation);
    return invitation;
  }

  async findInvitationByToken(token: string) {
    const invitation = this.invitations.find((entry) => entry.token === token);
    if (!invitation) return null;
    const organization = this.organizations.get(invitation.organizationId);
    if (!organization) return null;
    return { ...invitation, organization };
  }

  async findInvitationById(id: string) {
    return this.invitations.find((invitation) => invitation.id === id) ?? null;
  }

  async markInvitation(
    id: string,
    status: InvitationRecord["status"],
    acceptedAt?: Date | null,
  ) {
    const invitation = await this.findInvitationById(id);
    if (!invitation) throw new OrganizationError("NOT_FOUND", "Invitation not found.");
    invitation.status = status;
    if (acceptedAt !== undefined) invitation.acceptedAt = acceptedAt;
  }

  async listPendingInvitations(organizationId: string) {
    return this.invitations
      .filter(
        (invitation) =>
          invitation.organizationId === organizationId &&
          invitation.status === "PENDING",
      )
      .slice(0, 50);
  }

  async addMember(input: {
    organizationId: string;
    userId: string;
    role: MemberRecord["role"];
  }) {
    const existing = this.members.find(
      (member) =>
        member.organizationId === input.organizationId &&
        member.userId === input.userId,
    );
    if (existing) return this.toMember(existing);
    const timestamp = new Date();
    const member: StoredMember = {
      id: randomUUID(),
      ...input,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.members.push(member);
    return this.toMember(member);
  }

  async writeAudit(entry: AuditEntry) {
    this.audits.push(entry);
  }

  async countUserAgents(userId: string) {
    return this.installed.get(userId)?.size ?? 0;
  }

  async listInstalledAgents(userId: string, limit: number) {
    const ids = [...(this.installed.get(userId) ?? [])].slice(0, limit);
    return ids.map((id) => {
      const agent = this.systemAgents.get(id);
      return {
        id,
        name: agent?.name ?? id,
        model: agent?.model ?? "unknown",
        enabled: true,
      };
    });
  }

  async countConversations(userId: string) {
    return this.conversations.get(userId)?.length ?? 0;
  }

  async listRecentConversations(userId: string, limit: number) {
    return (this.conversations.get(userId) ?? []).slice(0, limit);
  }

  async listSystemAgents() {
    return [...this.systemAgents.values()];
  }

  async installSystemAgents(userId: string, agentIds: string[]) {
    const installed = agentIds.filter((id) => this.systemAgents.has(id));
    if (installed.length !== agentIds.length) return installed;
    const current = this.installed.get(userId) ?? new Set<string>();
    for (const id of installed) current.add(id);
    this.installed.set(userId, current);
    return installed;
  }

  private toMember(member: StoredMember): MemberRecord {
    const identity = this.identities.get(member.userId);
    return {
      ...member,
      user: {
        id: member.userId,
        name: identity?.name ?? null,
        email: identity?.email ?? null,
        image: identity?.image ?? null,
      },
    };
  }

  private toMembership(member: StoredMember): MembershipRecord {
    const organization = this.organizations.get(member.organizationId);
    if (!organization) {
      throw new OrganizationError("NOT_FOUND", "Workspace not found.");
    }
    return { ...this.toMember(member), organization };
  }
}
