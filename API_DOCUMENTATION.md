# AgentHub AI API

The application API is tRPC, mounted from `src/server/api/root.ts`. The client calls it through `@/trpc/react`. A parallel REST surface was not added. The optional Hono service stays disabled unless a later deployment needs a public HTTP API.

Every mutation below uses the authenticated session. Team and setup actions also check the caller's workspace role. Invalid input returns a validation error. Permission failures return `FORBIDDEN`. Missing workspaces and foreign memberships return `NOT_FOUND`, including when a caller asks to switch into an organization they do not belong to.

Rate-limited mutations use the existing per-user limiter.

## Workspace procedures

| Procedure | Type | Access | Behavior |
| --- | --- | --- | --- |
| `organization.overview` | query | signed in | Active workspace, role, capabilities, member count, the caller's installed agents, and the caller's recent conversations |
| `organization.listSystemAgents` | query | signed in | Enabled system agents that can actually be installed |
| `organization.listTeam` | query | member | Cursor page of members and pending invitations. Tokens are included only for owners and admins |
| `organization.create` | mutation | signed in | Creates a workspace and an owner membership |
| `organization.rename` | mutation | owner or admin | Changes the display name |
| `organization.saveIndustry` | mutation | owner or admin | Saves one industry from the fixed list |
| `organization.saveObjectives` | mutation | owner or admin | Saves one or more objectives from the fixed list |
| `organization.selectAgents` | mutation | owner or admin | Installs the selected system agents for the caller, or rejects unknown ids |
| `organization.completeOnboarding` | mutation | owner or admin | Requires industry and at least one objective |
| `organization.switch` | mutation | member of the target | Changes the active workspace |
| `organization.invite` | mutation | owner or admin | Creates or refreshes a seven-day invitation. Owner invites are rejected |
| `organization.revokeInvitation` | mutation | owner or admin | Revokes a pending invitation in the active workspace |
| `organization.acceptInvitation` | mutation | invited email | Adds the membership and switches to that workspace |
| `organization.updateMemberRole` | mutation | owner, or admin for non-owner roles | Cannot change your own role or remove the last owner |
| `organization.removeMember` | mutation | owner, or admin for members and developers | Cannot remove yourself or the last owner |
| `organization.setStatus` | mutation | platform admin | Sets `ACTIVE` or `SUSPENDED` |

`organization.invite` also tries to send mail. The response includes:

- `emailSent: true` and `emailStatus: "sent"` when the provider accepted it.
- `emailStatus: "not-configured"` when no public app URL is available.
- `emailStatus: "not-sent"` when the provider is missing or rejects the message.

The invitation row is kept in all three cases. The accept path is `/dashboard/invitations/:token`.

## Events

Successful creation emits `organization:created`. A new membership emits `organization:member-joined`. Handlers run through `appEvents` and cannot roll back the database write.

## Existing procedures the dashboard uses

| Procedure | Behavior |
| --- | --- |
| `membership.getSubscriptionStatus` | Reads the caller's current harness subscription. It is not an AgentHub plan catalog. |
| `agent.listSystem` | Public list of enabled system agents. |
| `userAgent.list` | Installed agents for the signed-in user. Chat can install the default assistant when one exists. |
| `billing.*`, `order.*`, `product.*` | Existing billing and checkout. The dashboard links to `/account/billing` rather than duplicating checkout. |

## Suggested REST names, not implemented

The product brief used routes such as `POST /api/agents` and `GET /api/marketplace`. Those routes do not exist. When a public API is added, it should call the same services as tRPC, authenticate with the existing session or a future hashed API key, and repeat the organization predicate in the service.

Do not add a REST handler that returns sample agents, sample executions, or sample invoices.

## Errors and secrets

- Invitation tokens are not written to logs.
- Email provider failures are logged without turning the provider response into the client message.
- Suspended workspaces reject setup and invite changes.
- Platform status changes require `User.isAdmin` on the server, not a role sent by the client.
