export const ORGANIZATION_ROLES = [
  "OWNER",
  "ADMIN",
  "MEMBER",
  "DEVELOPER",
] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const INVITE_ROLES = ["ADMIN", "MEMBER", "DEVELOPER"] as const;

export type InviteRole = (typeof INVITE_ROLES)[number];

export type OrganizationStatus = "ACTIVE" | "SUSPENDED";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  objectives: string[];
  status: OrganizationStatus;
  onboardingStep: number;
  onboardingCompletedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountIdentity {
  id: string;
  email: string | null;
  canonicalEmail: string | null;
  name: string | null;
  image: string | null;
}

export interface MemberRecord {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export interface MembershipRecord extends MemberRecord {
  organization: OrganizationRecord;
}

export interface InvitationRecord {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  token: string;
  status: InvitationStatus;
  invitedById: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

export interface AuditEntry {
  organizationId?: string | null;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface InstalledAgentSummary {
  id: string;
  name: string;
  model: string;
  enabled: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  updatedAt: Date;
}

export interface SystemAgentSummary {
  id: string;
  name: string;
  description: string | null;
  model: string;
}

export interface MemberCursor {
  createdAt: Date;
  id: string;
}

export interface OrganizationStore {
  findOrganization(id: string): Promise<OrganizationRecord | null>;
  findMemberships(userId: string): Promise<MembershipRecord[]>;
  findMembership(
    organizationId: string,
    userId: string,
  ): Promise<MembershipRecord | null>;
  findPreference(
    userId: string,
  ): Promise<{ activeOrganizationId: string | null } | null>;
  setActiveOrganization(userId: string, organizationId: string): Promise<void>;
  slugExists(slug: string): Promise<boolean>;
  createOrganization(input: {
    name: string;
    slug: string;
    createdById: string;
  }): Promise<MembershipRecord>;
  updateOrganization(
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
  ): Promise<OrganizationRecord>;
  listMembers(input: {
    organizationId: string;
    cursor?: MemberCursor | null;
    limit: number;
  }): Promise<MemberRecord[]>;
  countMembers(organizationId: string): Promise<number>;
  countOwners(organizationId: string): Promise<number>;
  findMemberById(memberId: string): Promise<MemberRecord | null>;
  findMemberByEmail(
    organizationId: string,
    email: string,
  ): Promise<MemberRecord | null>;
  updateMemberRole(
    memberId: string,
    role: OrganizationRole,
  ): Promise<MemberRecord>;
  deleteMember(memberId: string): Promise<void>;
  findUserById(id: string): Promise<AccountIdentity | null>;
  findPendingInvitation(
    organizationId: string,
    email: string,
  ): Promise<InvitationRecord | null>;
  saveInvitation(input: {
    organizationId: string;
    email: string;
    role: InviteRole;
    token: string;
    invitedById: string;
    expiresAt: Date;
  }): Promise<InvitationRecord>;
  findInvitationByToken(
    token: string,
  ): Promise<(InvitationRecord & { organization: OrganizationRecord }) | null>;
  findInvitationById(id: string): Promise<InvitationRecord | null>;
  markInvitation(
    id: string,
    status: InvitationStatus,
    acceptedAt?: Date | null,
  ): Promise<void>;
  listPendingInvitations(organizationId: string): Promise<InvitationRecord[]>;
  addMember(input: {
    organizationId: string;
    userId: string;
    role: OrganizationRole;
  }): Promise<MemberRecord>;
  writeAudit(entry: AuditEntry): Promise<void>;
  countUserAgents(userId: string): Promise<number>;
  listInstalledAgents(
    userId: string,
    limit: number,
  ): Promise<InstalledAgentSummary[]>;
  countConversations(userId: string): Promise<number>;
  listRecentConversations(
    userId: string,
    limit: number,
  ): Promise<ConversationSummary[]>;
  listSystemAgents(): Promise<SystemAgentSummary[]>;
  installSystemAgents(userId: string, agentIds: string[]): Promise<string[]>;
}
