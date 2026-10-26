# HookRelay

HookRelay is a webhook delivery service that accepts events, queues delivery, retries temporary failures, records request/response details, and lets developers replay failed events.

## Architecture

```text
Sender
  │ POST /v1/webhooks/send (x-api-key)
  ▼
┌──────────────── HookRelay API ────────────────┐
│ Express · JWT/API-key auth · MongoDB         │
└─────────────────────┬────────────────────────┘
                      │ enqueue
                      ▼
                 Redis / BullMQ
                      │
                      ▼
                Delivery worker ───────────────► Receiver
                      │                       success / retry
                      └──────────────► MongoDB event + attempt logs
                                               ▲
                                               │ JWT API
                                      React dashboard
```

The API and dashboard are npm workspaces. Shared API types and constants live in `packages/shared`.

## Prerequisites

- Node.js 20 or newer and npm
- Docker with Docker Compose v2 (for the containerized local setup)
- MongoDB and Redis (for manual local development)

## Quick start with Docker Compose

```sh
npm install
cp .env.example .env
```

Set `JWT_SECRET` and `HMAC_DEFAULT_SECRET` in `.env` to long random values, then start MongoDB, Redis, the API, and the Vite dashboard:

```sh
docker compose up --build
```

The dashboard is at <http://localhost:5173>, the API at <http://localhost:3001>, and the health endpoint at <http://localhost:3001/health>. Compose mounts the source tree for API and dashboard hot reload and persists local MongoDB/Redis data in named volumes.

To add sample records to the local database:

```sh
npm run seed
```

The script prints the demo login (`demo@hookrelay.com` / `Demo1234!`) and prints a newly generated API key once. It refuses to run with `NODE_ENV=production`; do not expose the seeded demo credentials on a public deployment.

## Manual development setup

1. Install dependencies and copy the environment template:

   ```sh
   npm ci
   cp .env.example .env
   ```

2. Start MongoDB and Redis. The defaults in `.env.example` use `localhost:27017` and `localhost:6379`.
3. Build the shared package and start the API:

   ```sh
   npm run build --workspace=@hookrelay/shared
   npm run dev:api
   ```

4. In another terminal, start the dashboard:

   ```sh
   npm run dev:dashboard
   ```

The Vite development server proxies `/v1` API requests to `http://localhost:3001`.

## Local demo

The landing page is served at <http://localhost:5173/>. For an end-to-end delivery demo, start the API and dashboard as above, then start the local-only receiver and send example events:

```sh
npm run demo:server
npm run seed
# Set DEMO_API_KEY to the one-time API key printed by the seed command.
npm run demo:send
```

The receiver listens only on `127.0.0.1:3002`; its success, slow, fail, intermittent, and signature-verification endpoints are for local demonstrations only. The sender submits through the API using the seeded demo account's API key. Live retries are asynchronous: the intermittent event succeeds on its third attempt, while permanent failure takes about six minutes to exhaust the full retry schedule. See [scripts/record-demo.md](./scripts/record-demo.md) for recording steps and timing.

## Environment variables

| Variable                | Required             | Description                                                                                                                                                                                                  |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`              | No                   | `development`, `test`, or `production`.                                                                                                                                                                      |
| `PORT`                  | No                   | API listen port; defaults to `3001` locally. Render supplies its service port.                                                                                                                               |
| `DATABASE_URL`          | Yes                  | MongoDB connection URI. Use a replica-set URI when transactions are needed.                                                                                                                                  |
| `REDIS_URL`             | No                   | Redis URI; defaults to `redis://localhost:6379`. Use `rediss://` for TLS Redis services.                                                                                                                     |
| `JWT_SECRET`            | Production           | Secret used to sign dashboard JWTs. Generate a unique, high-entropy value.                                                                                                                                   |
| `HMAC_DEFAULT_SECRET`   | Production           | Fallback secret used to sign webhook requests. Generate a unique, high-entropy value.                                                                                                                        |
| `FRONTEND_URL`          | No                   | Dashboard origin used for CORS and billing redirects.                                                                                                                                                        |
| `WORKER_CONCURRENCY`    | No                   | Delivery worker concurrency; defaults to `10`.                                                                                                                                                               |
| `LOG_LEVEL`             | No                   | Pino log level.                                                                                                                                                                                              |
| `STRIPE_SECRET_KEY`     | Billing              | Stripe secret API key.                                                                                                                                                                                       |
| `STRIPE_WEBHOOK_SECRET` | Billing              | Signing secret for `/v1/billing/webhook`.                                                                                                                                                                    |
| `STRIPE_PRO_PRICE_ID`   | Billing              | Recurring Stripe Price ID for Pro.                                                                                                                                                                           |
| `STRIPE_TEAM_PRICE_ID`  | Billing              | Recurring Stripe Price ID for Team.                                                                                                                                                                          |
| `VITE_API_URL`          | Dashboard deployment | Public API origin used by the Vite dashboard, e.g. `https://api.example.com`. Set this in Vercel or as a build argument for the production Compose dashboard; it is a public build-time value, not a secret. |
| `DEMO_API_KEY`          | Local demo sender    | One-time raw API key printed by `npm run seed`; export it in the shell before running `npm run demo:send`.                                                                                                   |
| `DEMO_HMAC_SECRET`      | Optional local demo  | Shared signing secret for the demo sender and signature-verification receiver. Defaults to the configured `HMAC_DEFAULT_SECRET`; set both consistently when testing signature verification.                        |
| `DEMO_API_URL`          | Optional local demo  | API origin for the sender; defaults to `http://localhost:3001`.                                                                                                                                              |
| `DEMO_RECEIVER_URL`     | Optional local demo  | Demo receiver origin; defaults to `http://127.0.0.1:3002`.                                                                                                                                                   |

Never commit `.env` or put server-only secrets in `VITE_*` variables. The demo sender requires `DEMO_API_KEY` and either `DEMO_HMAC_SECRET` or `HMAC_DEFAULT_SECRET`; the receiver uses the same signing-secret selection for signature verification.

## API overview

- `POST /v1/auth/register` and `POST /v1/auth/login` — create an account and get a dashboard JWT.
- `GET /v1/auth/me` — validate the current JWT.
- `POST /v1/webhooks/send` — accept a webhook with an API key; returns `202 Accepted`.
- `GET /v1/events` and `GET /v1/events/:eventId` — list events and inspect delivery attempts (JWT).
- `POST /v1/events/:eventId/replay` — replay a failed event (JWT).
- `GET /v1/usage` and `GET /v1/usage/daily` — usage totals and daily history (JWT).
- `GET /health` — MongoDB, Redis, queue, and process health.
- `GET /v1/metrics` — delivery and queue metrics (JWT).
- `POST /v1/billing/checkout`, `POST /v1/billing/portal` — Stripe billing sessions (JWT).
- `POST /v1/billing/webhook` — Stripe-signed webhook receiver (no JWT).

Send a webhook using an API key created in the dashboard:

```sh
curl -X POST "$API_URL/v1/webhooks/send" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"targetUrl":"https://receiver.example.com/webhooks","payload":{"type":"payment.succeeded","paymentId":"pay_123"}}'
```

The receiver gets the original JSON payload and HookRelay signature headers (`x-hookrelay-signature-256` and `x-hookrelay-timestamp`). Retries use the configured exponential schedule and exhausted deliveries move to the dead-letter queue. Consult the route and shared type definitions for request/response schemas.

## Deployment

### Render API

1. Push the repository to GitHub and select **New + → Blueprint** in Render.
2. Point Render at the repository root. The Blueprint at `apps/api/render.yaml` defines the Docker web service, managed Redis, `/health` checks, and automatic deploys from `main`.
3. Provision MongoDB (for example, MongoDB Atlas) and enter its connection URI as `DATABASE_URL`. Render generates `JWT_SECRET` and `HMAC_DEFAULT_SECRET`.
4. Set `FRONTEND_URL` to the deployed Vercel origin. Configure the Stripe variables if billing is enabled.
5. Deploy the dashboard to Vercel and set its `VITE_API_URL` to the Render API origin.

If you create a Render **Node** web service instead of using the Blueprint's Docker service, set its Root Directory to the repository root, Build Command to `npm ci --include=dev && npm run build --workspace=@hookrelay/shared && npm run build --workspace=@hookrelay/api`, and Start Command to `npm run start --workspace=@hookrelay/api`. The explicit `--include=dev` is required because TypeScript and the API's `@types/*` packages are development dependencies needed during compilation, while Render may otherwise omit them when `NODE_ENV=production`.

### Fly.io API

The alternative configuration is `apps/api/fly.toml`. Create or select a Fly app named `hookrelay-api`, configure its secrets and external database/Redis, then deploy from the repository root:

```sh
fly secrets set \
  DATABASE_URL="mongodb+srv://..." \
  REDIS_URL="rediss://..." \
  JWT_SECRET="replace-with-a-long-random-secret" \
  HMAC_DEFAULT_SECRET="replace-with-another-long-random-secret" \
  FRONTEND_URL="https://your-dashboard.vercel.app"
fly deploy --config apps/api/fly.toml
fly scale count 1 --max-per-region 3
```

Set the Stripe secret and price ID variables with `fly secrets set` when billing is enabled. Fly's health check targets `/health`; the app keeps one machine running and the scale command caps the region at three machines. Use managed external MongoDB and TLS-enabled Redis for production.

### Vercel dashboard

1. Import the repository in Vercel and set the project **Root Directory** to `apps/dashboard`.
2. Use `npm run build` as the build command and `dist` as the output directory (also configured in `apps/dashboard/vercel.json`).
3. Add `VITE_API_URL` in the Vercel project environment settings for each deployment environment. Use the HTTPS API origin, without a trailing `/v1`.
4. Deploy. The Vercel configuration rewrites application routes to `index.html` and adds browser security headers.

### Docker deployment

`docker-compose.prod.yml` runs the production API, a static Nginx-served dashboard, MongoDB configured as a single-node replica set, and Redis with AOF/RDB persistence. It has no source-code bind mounts or hot reload. Database data is kept in named volumes. Back up those volumes and use a managed/replicated database and Redis for production workloads.

```sh
cp .env.example .env
# Set production secrets and billing values in .env. For this local
# production stack, set FRONTEND_URL=http://localhost:8080.
docker compose -f docker-compose.prod.yml up --build -d
```

Open the containerized dashboard at <http://localhost:8080>. The compose file has no source-code bind mounts or hot reload. Database data is kept in named volumes. Back up those volumes and use managed/replicated database and Redis services for production workloads.

## CI

GitHub Actions runs ESLint, TypeScript project-reference checks, API tests, and production builds on pushes to `main` and pull requests. The test job starts MongoDB 7 and Redis 7.

The full HTTP-to-worker E2E scenarios are opt-in locally and run in CI. Start MongoDB and Redis, configure `DATABASE_URL`, `REDIS_URL`, and the test secrets, then set `RUN_E2E_TESTS=true` before running `npm test`. These scenarios exercise registration, API-key authentication, signed delivery, retry, dead-letter handling, and replay against the real queue.

## Contributing

1. Create a feature branch and keep changes focused.
2. Install with `npm ci`.
3. Run `npm run lint:all`, `npm run typecheck`, `npm test --workspace=@hookrelay/api`, and `npm run build:all`.
4. Add or update tests and documentation when behavior or configuration changes.
5. Open a pull request with a clear summary and validation results. Do not include credentials or production data.

## License

TBD
