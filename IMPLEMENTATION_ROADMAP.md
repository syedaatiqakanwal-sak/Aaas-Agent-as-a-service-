# AgentHub AI implementation roadmap

This roadmap follows the harness that is already in the repository. A feature is complete only when its service, permission checks, and interface are connected. Visual-only screens are not listed as complete.

## Phase 1 — foundation

Status: implemented in this workspace.

- Inspected the harness and kept its auth, billing, chat, admin, and worker code.
- Added organization, membership, invitation, workspace preference, and audit tables, with a SQL migration.
- Added onboarding for organization name, industry, objectives, and installation of existing system agents.
- Added the workspace dashboard. Counts for members, installed agents, and conversations are queried. Subscription status is read from the existing membership service.
- Added team invites, role changes, removal, and invitation acceptance.
- Invitation email is sent only through the existing `sendEmail()` path. When `APP_URL` or an email provider is missing, the invite is still saved and the owner can copy the link.
- Landing and dashboard copy distinguish live behavior from later phases.

### Completed

- Workspace creation and active-workspace switching.
- Owner, admin, member, and developer checks on the server.
- Last-owner protection and suspension blocking for setup and invites.
- Team pagination and pending invitations.
- Dashboard links to existing chat, billing, profile, settings, and admin pages.

### Partial

- Authentication is the existing harness flow: email code, Google, and GitHub, plus allowlisted password login. A separate password-reset product flow was not added.
- Onboarding has five saved steps. The requested sixth step is opening the dashboard after confirmation.
- Super-admin suspension is an API procedure. The existing admin UI does not yet have a workspace-management screen.
- Audit rows are written for workspace and membership changes. There is no audit browser yet.

### Not in this phase

- Custom agent builder, marketplace subscriptions, knowledge ingestion, workflow editor, deployment channels, credit enforcement for agent runs, and the super-admin analytics console described in the product brief.

### Tests

Passed:

- `corepack pnpm exec tsx --test src/server/organization/policy.test.ts src/server/organization/slug.test.ts src/server/organization/service.test.ts`
- `corepack pnpm exec eslint` on the new workspace, dashboard, landing, and router files
- `corepack pnpm exec tsc --noEmit`

Not run: PostgreSQL migration, browser walkthrough, and `next build`. Docker is not available in this environment, so the dashboard was not opened against a database.

### Known issues

- Renaming a workspace does not change its slug.
- A user who created an organization cannot be deleted while that organization row still references them.
- Installed-agent and conversation counts on the dashboard are for the signed-in user, not every person in the organization.
- The new AgentHub plan names (Free, Starter, Business, Pro, Enterprise) are not catalog products yet. The dashboard shows the subscription already stored by the harness.

## Phase 2 — agents and execution

Status: not started.

- Organization-owned agents, versions, and the builder wizard.
- Provider and model selection that uses configured server credentials only.
- A test chat that runs the selected agent and records the existing execution model where it fits.
- Keep the current system-agent chat working.

## Phase 3 — knowledge, tools, and usage

Status: not started.

- Organization-isolated documents, chunks, embeddings, and retrieval.
- Tool permissions with validated inputs and no customer-authored code execution.
- Execution history, token totals, and estimated cost.
- Refusal and refund handling for failed runs before any customer credit is captured.

## Phase 4 — marketplace and workflows

Status: not started.

- Marketplace entries backed by real agent configurations. The first catalog should be a small set of working templates, with the rest represented only as data that cannot be subscribed to until implemented.
- Workspace subscriptions to those templates.
- A workflow editor connected to a real runner, with validation, versions, and history.

## Phase 5 — integrations and deployment

Status: not started.

- Connection records and encrypted credentials.
- OAuth or API-key connect flows only for providers whose API calls are implemented.
- Website widget, API deployment, and webhooks with signature verification.
- Telegram, Slack, and WhatsApp only after their provider approvals and API calls exist.

## Phase 6 — commercial controls and admin analytics

Status: not started.

- Map AgentHub plans onto the existing product and entitlement services. Do not hard-code prices in the interface.
- Credits, usage limits, and provider cost.
- Super-admin views for customers, organizations, agents, pricing, providers, and audit logs.
- Margin figures only when both customer charges and provider costs are recorded.

## Phase 7 — production readiness

Status: not started.

- Permission and isolation tests against PostgreSQL.
- Security review of uploads, tools, webhooks, and prompts.
- Performance pass and deployment notes for web and worker processes.

## Next implementation tasks

1. Apply `prisma/migrations/20261112120000_organization_workspace` to a local database and run the workspace onboarding against it.
2. Add organization ownership to agent records without breaking the current system-agent chat.
3. Define the first ten marketplace templates as configuration only where no runner exists, and keep their subscribe actions unavailable until a runner exists.
