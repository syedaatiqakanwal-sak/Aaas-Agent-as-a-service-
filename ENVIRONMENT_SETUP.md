# AgentHub AI environment setup

AgentHub uses the harness environment. Copy `.env.example` to `.env`, then fill the values for the services you are actually running. `src/env.js` validates application variables. Do not put provider secrets in client code or in committed files.

## Local services

1. Install pnpm 10.12.1, the version declared in `package.json`. With Corepack: `corepack prepare pnpm@10.12.1 --activate`.
2. Install dependencies with `pnpm install`. Prisma Client is generated in `postinstall`.
3. Start PostgreSQL and Redis. The example database URL is `postgresql://velobase:velobase@localhost:5432/velobase`. `pnpm docker:db:up` starts those services when Docker is available.
4. Apply migrations with `pnpm db:migrate`. The workspace tables are in `prisma/migrations/20261112120000_organization_workspace`.
5. Seed the default assistant if you want a real system agent during onboarding: `pnpm db:seed`.
6. Start the app with `pnpm dev`. The web process listens on port 3000 by default. Workers use the existing worker service when background jobs are needed.

## Values required for the workspace

| Variable | Required for | Notes |
| --- | --- | --- |
| `AUTH_SECRET` | Sign-in | Generate a unique secret. Empty `AUTH_SECRET` can fall back to `NEXTAUTH_SECRET`. |
| `AUTH_URL` | Auth callbacks and invite links | Example: `http://localhost:3000`. `APP_URL` is preferred for invite links when it is set. |
| `DATABASE_URL` | All workspace data | PostgreSQL |
| `NEXT_PUBLIC_APP_NAME` | Branding | Defaults to AgentHub AI when unset |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google sign-in | Optional |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | GitHub sign-in | Optional |
| `RESEND_API_KEY` or `SENDGRID_API_KEY` | Invitation email | Optional. Invites still save without it |
| Redis settings | Rate-limited mutations and workers | Required for the shared rate limiter used by workspace mutations |
| AI provider key | Chat | Required only when opening the existing chat. See `AI_CHAT_MODE` in `.env.example` |
| Stripe and billing settings | Paid checkout | Required only when exercising the existing billing pages |

Workspace setup does not add a new secret. It does not need an agent-provider key until someone opens chat.

## Checks

From the repository root:

```bash
pnpm exec tsx --test src/server/organization/policy.test.ts src/server/organization/slug.test.ts src/server/organization/service.test.ts
```

The organization tests do not connect to PostgreSQL or a model provider. Before a deployment, also run the harness checks that match the files you changed: `pnpm lint`, `pnpm typecheck`, and a migration against a database. `pnpm build` is appropriate before a release, not after a documentation-only edit.

## Production notes

- Keep `SERVICE_MODE` on `web,worker` until a public HTTP API needs the optional API process.
- Set `APP_URL` to the public origin so invitation links are absolute.
- Rotate `AUTH_SECRET` only with a session-invalidation plan.
- Do not commit `.env`.
- The billing package uses its own schema notes in `.env.example`. Follow those notes before taking a payment in production.
