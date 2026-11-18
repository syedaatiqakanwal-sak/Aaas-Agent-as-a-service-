# AgentHub AI architecture

AgentHub AI is a multi-tenant agent workspace being built on the Velobase Harness codebase in this repository. The harness remains the application framework. Product behavior added for AgentHub lives beside it and calls the existing account, billing, chat, and worker services.

The harness is MIT licensed. That license allows commercial use when its copyright and permission notice stay with the software. The packaged dependency `@velobase/billing` is downloaded from a Velobase GitHub release and is separate from the MIT files in this repository. Confirm that package's license before redistributing a commercial build.

## Stack

- Next.js App Router and React render the web application.
- Auth.js (`next-auth` 5 beta) owns sessions. Server components call `auth()` from `@/server/auth`. Client components call `useSession()`.
- tRPC is the application API. Routers validate input with Zod and delegate to services.
- PostgreSQL is accessed only through the shared Prisma client in `@/server/db`.
- Redis and BullMQ run background work. Workers are created with `createWorkerInstance()`.
- AI chat uses the Vercel AI SDK, persisted `Conversation` and `Interaction` records, and the existing `Agent` / `UserAgent` models.
- Billing, credits, subscriptions, orders, and Stripe webhooks already exist and were not rewritten.

## Request path

```text
Browser
  -> Next.js page
  -> tRPC procedure
  -> organization or existing domain service
  -> Prisma
```

Authenticated procedures resolve the user from the session, then load that user's membership. Organization ids supplied by the browser are not trusted for team or setup actions. Those actions use the caller's active workspace. Switching workspaces checks membership first and returns "not found" when the caller is not a member.

Platform administration continues to use `User.isAdmin`. That flag is the super-administrator role already enforced by `adminProcedure`.

## What already existed

| Area | Where it lives | Current behavior |
| --- | --- | --- |
| Email-code, Google, and GitHub sign-in | `src/server/auth` | Working account system. Password login is an allowlisted opt-in. |
| Profile, billing, settings | `src/app/account` | Existing account pages. |
| Admin console | `src/app/admin` | Users, orders, products, credits, promos, and module status. |
| Plans, subscriptions, credits | `src/server/billing`, `src/server/membership`, `src/server/order` | Existing products and Stripe-oriented billing. Plan types in the database include Starter, Plus, and Premium. |
| System agents and chat | `Agent`, `UserAgent`, `src/app/chat` | Users can chat with installed system agents. |
| Durable agent runs | `AgentRun`, `AgentAttempt`, `AgentToolOperation` | Framework execution records and a worker queue. Not yet a customer execution console. |
| Documents and projects | `Project`, `Document` | User-owned project documents. Not an organization knowledge base or vector index. |
| Integrations inventory | Admin module-status panel | Shows whether configured providers are present. A green status is not a customer integration marketplace. |

## What Phase 1 added

- `Organization`, `OrganizationMember`, `OrganizationInvitation`, `WorkspacePreference`, and `AuditLog`.
- Server-side role checks for owner, admin, member, and developer.
- Workspace onboarding that stores industry, objectives, and installs only enabled system agents.
- Dashboard, team management, and invitation acceptance.
- Landing copy that names AgentHub and distinguishes live features from planned ones.

Organization roles are not a replacement for `User.isAdmin`. A workspace owner cannot suspend another customer. Only a platform administrator can suspend or resume a workspace, through `organization.setStatus`.

## Role map

| Product role | Implementation |
| --- | --- |
| Super administrator | Existing `User.isAdmin` |
| Organization owner | `OrganizationMember.role = OWNER` |
| Organization admin | `ADMIN` |
| Team member | `MEMBER` |
| Developer | `DEVELOPER` |

In this phase, developers and members can view the workspace and their own chat activity. Developer-only tool permissions and API keys are not implemented. Owners and admins can update workspace setup and manage team access. Admins cannot change or remove owners. A workspace must keep at least one owner.

## Planned boundaries

Later phases should keep these rules:

- Do not replace the billing ledger or grant credits from a new webhook handler. Entitlements stay on the existing fulfillment path.
- Do not expose provider API keys to customers.
- Do not execute customer-authored code. Tools need explicit permissions, validated inputs, and limits.
- Keep organization data isolated in every query. Frontend filtering is not sufficient.
- Mark a channel or integration as available only after its authentication and API calls are implemented and tested.

The customer navigation lists marketplace, builder, knowledge, integrations, executions, analytics, and API keys as planned. Those items do not navigate to empty screens.
