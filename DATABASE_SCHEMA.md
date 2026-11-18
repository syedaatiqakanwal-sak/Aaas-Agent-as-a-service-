# AgentHub AI database schema

PostgreSQL is the system of record. Prisma models live in `prisma/schema.prisma`. Deployable changes belong in `prisma/migrations`. Local experiments may use `prisma db push`, but a release should use the migration files.

All new product tables use `cuid()` identifiers, `created_at` timestamps, and organization or user foreign keys. List screens page membership with a `createdAt` plus `id` cursor.

## Existing tables kept as-is

These harness tables were not redesigned:

- Accounts and sessions: `users`, `accounts`, `sessions`, `verification_tokens`.
- Chat: `agents`, `user_agents`, `conversations`, `interactions`.
- Projects and documents: `projects`, `documents`.
- Billing: `products`, `product_prices`, `orders`, `payments`, `user_subscriptions`, `subscription_plans`, `entitlements`, and the credit ledger tables owned by the billing package.
- Execution framework: `agent_runs`, `agent_attempts`, `agent_tool_operations`.
- Growth and support: affiliate, touch, support, and notification tables.

`users.is_admin` remains the platform super-administrator flag. AgentHub does not add a second global role table in this phase.

## Phase 1 tables

### organizations

| Column | Purpose |
| --- | --- |
| `id` | Primary key |
| `name` | Display name |
| `slug` | Unique URL key. Not changed on rename |
| `industry` | Optional industry key selected during onboarding |
| `objectives` | Text array of objective keys |
| `status` | `ACTIVE` or `SUSPENDED` |
| `onboarding_step` | Highest saved setup step |
| `onboarding_completed_at` | Set when setup is finished |
| `created_by_id` | User who created the workspace. Restrict on user delete |

Indexes: unique `slug`, `created_by_id`, `status`.

### organization_members

| Column | Purpose |
| --- | --- |
| `organization_id`, `user_id` | Unique membership |
| `role` | `OWNER`, `ADMIN`, `MEMBER`, or `DEVELOPER` |

Deleting an organization or user deletes the membership. Indexes cover `user_id` and `(organization_id, role)`.

### organization_invitations

| Column | Purpose |
| --- | --- |
| `email` | Normalized address |
| `role` | Role granted on acceptance. The service rejects owner invitations |
| `token` | Unique secret used in the accept link |
| `status` | `PENDING`, `ACCEPTED`, `REVOKED`, or `EXPIRED` |
| `expires_at` | Seven days from the latest invite |
| `invited_by_id` | Nullable. Set null if the inviter is deleted |

Indexes: unique `token`, `(organization_id, status)`, `(email, status)`.

### workspace_preferences

One row per user. `active_organization_id` is the workspace used by later requests. The foreign key is set null if that organization is removed. The service only stores an organization the user belongs to.

### audit_logs

| Column | Purpose |
| --- | --- |
| `organization_id` | Nullable workspace scope |
| `actor_id` | Nullable acting user |
| `action` | Stable action name such as `organization.created` |
| `target_type`, `target_id` | Subject of the action |
| `metadata` | JSON without secrets or invitation tokens |

Indexes: `(organization_id, created_at)` and `(actor_id, created_at)`.

## Access rules

- Membership and invitation mutations load the caller's active membership in the service.
- A requested organization id is accepted only for switching, and only when a membership row exists.
- Platform suspension uses `adminProcedure` and does not depend on a workspace role.
- Invitation tokens are returned to owners and admins. Other members receive invitation email and role, not the token.
- User-agent and conversation counts are filtered by `user_id`. They are not organization-wide yet.

## Designed, not migrated

These entities are part of the product target and do not have tables yet. Do not invent rows for them in the interface.

- `Roles` and `Permissions` as data-driven grants. Phase 1 roles are the membership enum.
- `AgentTemplates`, organization-owned `Agents`, `AgentVersions`, `AgentTools`, and `ToolPermissions`.
- `AgentKnowledgeBases`, organization-scoped document chunks, and embeddings. `pgvector` is not installed.
- Organization-scoped `Conversations` and `Messages`. Current conversations belong to a user.
- Customer `AgentExecutions`, `ExecutionSteps`, and `ExecutionLogs`. The harness `agent_runs` tables remain the framework runner.
- `Integrations`, `IntegrationCredentials`, `Workflows`, `WorkflowNodes`, `WorkflowConnections`.
- `Deployments`, customer `APIKeys`, and product `Webhooks`.
- AgentHub `UsageRecords` and `BillingRecords` beyond the existing order, payment, and credit ledger.
- `Notifications` beyond the existing notification preference model.

When those tables are added, every customer-owned row needs `organization_id`, a foreign key, and an index that starts with `organization_id`. Queries must include that predicate in the service.
