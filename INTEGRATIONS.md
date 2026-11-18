# AgentHub AI integrations

An integration is listed as available only when this repository contains its authentication flow and a tested API call. The admin module-status panel reports whether configuration is present. That panel is an operator diagnostic, not a customer integration catalog.

## Available through the existing harness

These are framework integrations. They are not AgentHub agent tools.

| Integration | Requirement | Use |
| --- | --- | --- |
| Google sign-in | `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` | Account login |
| GitHub sign-in | `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` | Account login |
| Email delivery | `RESEND_API_KEY` and/or `SENDGRID_API_KEY`, selected with `EMAIL_PROVIDER` | Auth codes and workspace invitations |
| PostgreSQL | `DATABASE_URL` | Application data |
| Redis | `REDIS_URL` or host settings | Rate limits, queues, and workers |
| Stripe and the existing billing package | Payment-provider keys and billing schema described in `.env.example` | Subscriptions, credits, and checkout |
| AI chat providers | A supported provider key and `AI_CHAT_MODE` | Existing chat. Keys stay on the server |
| Object storage | S3-compatible settings in `.env.example` | Existing uploads through `@/server/storage` |

Workspace invitations call `sendEmail()` and do not talk to Resend or SendGrid directly. If no provider is configured, invitation creation still succeeds and the interface tells the owner to copy the link.

## Not available as AgentHub connections

The following were requested and are not implemented. The product must not show them as connected:

- Gmail, Outlook, WhatsApp Business, Telegram, Slack, and Discord as agent channels.
- HubSpot, Salesforce, Pipedrive, and Zoho CRM.
- Google Calendar, Drive, Sheets, Notion, and Microsoft Teams.
- Shopify and WooCommerce.
- PayPal as a customer billing provider. Stripe remains the implemented card provider in the harness.
- Customer-managed GitHub, generic REST tools, and outbound webhooks for agents.

GitHub OAuth for sign-in is separate from a GitHub tool that can read a customer's repositories. Repository connections that already exist in the harness stay user-scoped and are not organization agent tools.

## Rules for the next integration

1. Add the provider's environment variables to `src/env.js` and `.env.example`. Do not read `process.env` in new application code.
2. Store customer credentials encrypted, scoped to one organization, and never return the secret after it is saved.
3. Gate every tool call with the agent's tool permission and the workspace role.
4. Verify webhook signatures before changing state.
5. Keep the module disabled until the API operation used by the agent has a test with a mocked provider.
6. Sensitive actions, including sending email on behalf of a customer or changing business records, need a configurable approval step before they run.
