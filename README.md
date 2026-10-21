# HookRelay 🕸️

> Reliable webhook delivery: queue, retry, log, and replay webhooks so temporary failures don't mean lost events.

HookRelay sits between a sender and a receiver, guaranteeing delivery via a Redis-backed queue, exponential backoff retries, a dead-letter queue for exhausted attempts, HMAC-SHA256 signed payloads, and a developer dashboard for inspection & replay.

---

## 📦 Monorepo Layout

```
hookrelay/
├── apps/
│   ├── api/          # Express + TypeScript backend (ingestion, workers, auth)
│   └── dashboard/    # React + Vite + TypeScript developer UI
└── packages/
    └── shared/       # Shared types & constants (@hookrelay/shared)
```

Managed with **npm workspaces**.

---

## 🚀 Quick start

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env

# 3. Make sure MongoDB and Redis are reachable (defaults: localhost:27017 / localhost:6379)

# 4. Run services (in two terminals)
npm run dev:api
npm run dev:dashboard
```

> Backend defaults to `http://localhost:3001`, dashboard to `http://localhost:5173`.

---

## 🛠 Scripts (root)

| Script                   | Purpose                                         |
| ------------------------ | ----------------------------------------------- |
| `npm run dev:api`        | Start the API in dev mode                       |
| `npm run dev:dashboard`  | Start the React dashboard                       |
| `npm run build:all`      | Build every workspace that defines a build task |
| `npm run lint:all`       | Lint `apps/` and `packages/`                    |
| `npm run format`         | Prettier format the repo                        |
| `npm run typecheck`      | Project-reference-aware `tsc -b`                |

---

## 📐 Shared package

Import shared types/constants from either app:

```ts
import { DeliveryStatus, RETRY_SCHEDULE_MS } from '@hookrelay/shared';
```

---

## 🗺 Roadmap

See the original project spec. The 10-day build plan covers: core API → BullMQ workers → HMAC signing → dashboard → Stripe billing → launch.

---

## 📄 License

TBD