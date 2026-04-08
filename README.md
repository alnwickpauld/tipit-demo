# Tipit Demo

Tipit is a hospitality tipping platform built with Next.js, TypeScript, Prisma, Neon Postgres, and Stripe. This repo is ready to deploy to Vercel with Prisma migrations managed through `prisma migrate deploy`.

## Scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "postinstall": "prisma generate",
  "lint": "prisma validate && tsc -p tsconfig.json --noEmit",
  "test": "npm run test:server",
  "db:migrate": "prisma migrate dev --name init",
  "db:migrate:deploy": "prisma migrate deploy",
  "db:generate": "prisma generate",
  "db:validate": "prisma validate",
  "db:seed": "prisma db seed"
}
```

Extra local helpers:

- `npm run typecheck`
- `npm run test:server`
- `npm run test:payroll`
- `npm run dev:stack`
- `npm run dev:stop`

## Environments

### Local

Use local Postgres or Neon dev credentials. `TIPIT_DEV_FAKE_STRIPE=true` is supported for local demo checkout without a live Stripe account.

Suggested values:

- `APP_URL=http://localhost:3000`
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- `TIPIT_DEV_FAKE_STRIPE=true`

### Staging

Use a dedicated Neon staging database and Stripe test mode:

- `DATABASE_URL` should use the Neon pooled connection string
- `DIRECT_URL` should use the direct Neon connection string
- `STRIPE_SECRET_KEY` should be a Stripe test key
- `STRIPE_WEBHOOK_SECRET` should come from the staging webhook endpoint
- `TIPIT_DEV_FAKE_STRIPE=false`

### Production

Use a dedicated Neon production database and Stripe live mode:

- `DATABASE_URL` should use the Neon pooled connection string for runtime Prisma access
- `DIRECT_URL` should use the direct Neon connection string for migrations
- `STRIPE_SECRET_KEY` should be a Stripe live key
- `STRIPE_WEBHOOK_SECRET` should be the live webhook secret from Stripe
- `TIPIT_DEV_FAKE_STRIPE=false`
- `AUTH_SECRET` should be a long random secret
- `APP_URL` and `NEXT_PUBLIC_APP_URL` should point at the live Vercel domain or custom domain

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure env

Copy `.env.example` to `.env` or `.env.local`.

```bash
cp .env.example .env
```

### 3. Generate Prisma client

```bash
npm run db:generate
```

### 4. Run migrations

```bash
npm run db:migrate
```

### 5. Run seed

```bash
npm run db:seed
```

### 6. Start dev server

```bash
npm run dev
```

## Prisma and Migration Strategy

### Local development

Use `prisma migrate dev` through:

```bash
npm run db:migrate
```

This creates and applies new migrations interactively.

### Staging and production

Use committed migrations and deploy them with:

```bash
npm run db:migrate:deploy
```

For Neon:

- `DATABASE_URL` should be the pooled runtime URL
- `DIRECT_URL` should be the direct connection URL used by Prisma migrations

Recommended deployment flow:

1. Create migrations locally with `npm run db:migrate`
2. Commit the generated `prisma/migrations` folder
3. Run `npm run db:migrate:deploy` in staging/production before or during deployment
4. Let Vercel install dependencies and run `postinstall`, which generates Prisma Client

## Vercel Deployment Notes

No `vercel.json` is required for this app right now.

Set these environment variables in Vercel for each environment:

- `DATABASE_URL`
- `DIRECT_URL`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `AUTH_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `TIPIT_DEV_FAKE_STRIPE`

Recommended build settings:

- Install command: `npm install`
- Build command: `npm run build`
- Start command: `npm run start`

If you run migrations as a release step, use:

```bash
npm run db:migrate:deploy
```

## GitHub Actions for Neon PR Branches

This repo includes a pull-request workflow at `.github/workflows/neon-pr-branches.yml`.

It will:

- create a temporary Neon branch when a PR is opened, reopened, or synchronized
- run `npm ci`
- run `npm run db:migrate:deploy` against that temporary branch
- update branch-specific Vercel preview `DATABASE_URL` and `DIRECT_URL` env vars for the PR source branch
- delete the Neon branch when the PR closes
- remove those branch-specific Vercel preview env vars when the PR closes

Set these in GitHub before enabling the workflow:

- Repository variable: `NEON_PROJECT_ID`
- Repository variable: `VERCEL_ORG_ID`
- Repository secret: `NEON_API_KEY`
- Repository secret: `VERCEL_TOKEN`

The workflow uses:

- the direct Neon branch URL for Prisma migrations so `prisma migrate deploy` can run reliably
- the pooled Neon branch URL for Vercel preview runtime `DATABASE_URL`
- the direct Neon branch URL for Vercel preview `DIRECT_URL`

The Vercel project ID for this repo is already embedded in the workflow:

- `prj_b91uNVBPiUCVv56xEksHCeQynQHD`

## Stripe Webhooks

Production-safe webhook handling is available at:

- `/api/stripe/webhook`

Configure this endpoint in Stripe for staging and production. The route verifies the Stripe signature using `STRIPE_WEBHOOK_SECRET` and finalizes or fails tip transactions based on Stripe checkout events.

Recommended Stripe events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

## Health Check

A deployment health endpoint is available at:

- `/api/health`

It returns a simple JSON status and checks database connectivity.

## Logging and Error Handling

The app includes basic production-oriented structured logging for:

- Prisma client errors
- API validation failures
- unhandled server errors
- Stripe checkout and webhook lifecycle events

Logs are emitted as JSON to stdout/stderr so they work cleanly with Vercel logging.

## Future Hospitality Integrations

The backend is prepared for future integrations with:

- Oracle Simphony
- Ameego
- Planet
- Sage

Integration-ready schema support now exists for:

- external references on venues, departments, staff members, and payroll periods
- imported hours worked
- imported card/service charge data
- payroll export batches and lines

Provider-specific logic should plug in through:

- [contracts.ts](/Users/PaulDavidson/OneDrive%20-%20MEDIAWORKS%20UK%20LTD/Documents/Tipit/src/server/integrations/contracts.ts)

Integration notes and provider mapping live in:

- [integrations.md](/Users/PaulDavidson/OneDrive%20-%20MEDIAWORKS%20UK%20LTD/Documents/Tipit/docs/integrations.md)

## Seeded Demo Credentials

After running `npm run db:seed` locally:

- `platform-admin@tipit.example` / `Password123!`
- `admin@sandman.example` / `Password123!`
- `manager@sandman.example` / `Password123!`
- `viewer@sandman.example` / `Password123!`

## Pilot Rollout Package

The seed script provisions a client-demo hospitality pilot package for `Sandman Hotel Group UK` with:

- two venues:
  - `Sandman Signature Newcastle`
  - `Portmarnock Resort`
- rollout enabled only for `MEETING_EVENTS`, `BREAKFAST`, and `ROOM_SERVICE`
- `BAR` and `RESTAURANT` disabled by default
- realistic active, scheduled, completed, and cancelled shifts
- customer-scoped staff, pools, payroll inputs, successful tips, failed tips, refunded tips, QR assets, and audit logs
- public journeys that only expose active-shift staff where individual selection is allowed

Sample public URLs after seeding:

- `http://localhost:3000/tip/ssn-breakfast-table-card-a`
- `http://localhost:3000/tip/ssn-breakfast-table-card-b`
- `http://localhost:3000/tip/ssn-breakfast-host-stand`
- `http://localhost:3000/tip/ssn-room-service-tray-card`
- `http://localhost:3000/tip/ssn-room-service-in-room-tent-card`
- `http://localhost:3000/tip/pmr-ballroom-event-sign`
- `http://localhost:3000/tip/pmr-conference-foyer-sign`
- `http://localhost:3000/tip/pmr-private-dining-qr`

Expected pilot journey behavior:

- `Breakfast` journeys: `TEAM_OR_INDIVIDUAL`
- `Room Service` journeys: `TEAM_ONLY`
- `Meeting & Events` journeys: `TEAM_OR_INDIVIDUAL`
