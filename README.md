# Hotel Offer Orchestrator

Aggregate overlapping hotel offers from two mock suppliers, de-duplicate by name,
and select the **best-priced** offer per hotel. The comparison is orchestrated
with **Temporal**, and the de-duplicated listing is stored in **Redis** where
price-range filtering is performed.

**Stack:** Node.js (TypeScript) · Express · Temporal · Redis · Docker Compose

---

## Architecture

```
                     ┌──────────────────────────────────────────┐
  Client ── HTTP ──▶ │  api  (Express)                          │
                     │  • GET /api/hotels      → starts workflow│
                     │  • GET /supplierA|B/hotels (mock data)   │
                     │  • GET /health                           │
                     └───────────────┬──────────────────────────┘
                                     │ Temporal client
                                     ▼
                     ┌──────────────────────────────────────────┐
                     │  temporal  (server + Postgres + Web UI)  │
                     └───────────────┬──────────────────────────┘
                                     │ task queue: hotel-orchestrator
                                     ▼
                     ┌──────────────────────────────────────────┐
                     │  worker  (workflow + activities)         │
                     │   1. fetchSupplierA ┐ in parallel        │
                     │      fetchSupplierB ┘ (activities, retry) │
                     │   2. dedupe + pick cheapest (workflow)    │
                     │   3. saveDedupedListToRedis (activity)    │
                     │   4. filterByPriceFromRedis (activity)    │
                     └───────────────┬──────────────────────────┘
                                     ▼
                     ┌──────────────────────────────────────────┐
                     │  redis                                   │
                     │   ZADD hotels:<city>:byprice <price> name│
                     │   filter = ZRANGEBYSCORE <min> <max>     │
                     └──────────────────────────────────────────┘
```

### How it works

- **`/api/hotels`** starts the `hotelComparisonWorkflow` and waits for the result.
- The workflow runs **Supplier A** and **Supplier B** calls **in parallel** as
  Temporal **activities** (each with an automatic retry policy).
- **De-duplication by name** keeps the **cheaper** offer. If only one supplier
  returns a hotel, that one is kept. This logic is deterministic and lives in
  the workflow itself.
- The de-duplicated list is **saved to Redis** as a sorted set scored by price,
  plus one JSON key per hotel.
- When `minPrice`/`maxPrice` are supplied, **filtering is done inside Redis**
  via `ZRANGEBYSCORE` — not in application code.
- If **one supplier is down**, the workflow proceeds with the other. If **both**
  are down, the API returns `502`.

---

## Endpoints

| Method & path | Description |
|---|---|
| `GET /api/hotels?city=delhi` | De-duplicated, best-priced list for a city |
| `GET /api/hotels?city=delhi&minPrice=<min>&maxPrice=<max>` | Same, price-filtered inside Redis |
| `GET /api/hotels?city=delhi&down=A` | Simulate Supplier A offline (`down=A` or `down=B`) |
| `GET /supplierA/hotels?city=delhi` | Mock Supplier A (add `&down=true` for a 503) |
| `GET /supplierB/hotels?city=delhi` | Mock Supplier B |
| `GET /health` | Service health + reachability of both suppliers |

### Sample response — `GET /api/hotels?city=delhi`

```json
[
  { "name": "Marrot",  "price": 3900, "supplier": "Supplier B", "commissionPct": 12 },
  { "name": "Taz",     "price": 4200, "supplier": "Supplier A", "commissionPct": 8 },
  { "name": "Holtin",  "price": 5340, "supplier": "Supplier B", "commissionPct": 20 },
  { "name": "Radison", "price": 5900, "supplier": "Supplier A", "commissionPct": 13 }
]
```

`Holtin` and `Radison` appear in **both** suppliers; the cheaper offer wins
(Holtin → Supplier B @ 5340, Radison → Supplier A @ 5900). Results are returned
in ascending price order.

---

## Run with Docker Compose (recommended)

Prerequisites: **Docker** and **Docker Compose v2**.

```bash
docker compose up --build
```

This starts six services:

| Service | Port | Purpose |
|---|---|---|
| `api` | 3000 | Express API + mock suppliers |
| `worker` | — | Temporal worker (workflows + activities) |
| `temporal` | 7233 | Temporal server |
| `temporal-ui` | 8080 | Temporal Web UI — http://localhost:8080 |
| `postgresql` | — | Temporal persistence |
| `redis` | 6379 | De-duplicated store + price filtering |

Then try:

```bash
curl "http://localhost:3000/api/hotels?city=delhi"
curl "http://localhost:3000/api/hotels?city=delhi&minPrice=4000&maxPrice=6000"
curl "http://localhost:3000/health"
```

> First boot takes ~30–60s while Temporal provisions its schema. The `api` and
> `worker` retry the Temporal connection automatically until it is ready.

Shut down (and wipe Temporal's Postgres volume):

```bash
docker compose down -v
```

---

## Run locally (without Docker)

You still need a Temporal dev server and a Redis instance:

```bash
# 1. Temporal dev server (Temporal CLI: https://docs.temporal.io/cli)
temporal server start-dev            # serves 7233, UI on 8233

# 2. Redis
redis-server                         # or: docker run -p 6379:6379 redis:7-alpine

# 3. Install deps and start the two processes (separate terminals)
npm install
cp .env.example .env
npm run build
npm run start:worker                 # Temporal worker
npm run start:api                    # Express API on :3000
```

For hot-reload during development use `npm run dev:worker` and `npm run dev:api`.

---

## Testing with Postman

Import `postman/HotelOfferOrchestrator.postman_collection.json`. It includes:

- **Hotels - Delhi (expected overlaps)** — verifies de-dupe + cheapest selection
- **Hotels - Delhi filtered by price range (Redis)** — verifies Redis filtering
- **Hotels - City with no results** — empty-array case (`city=jaipur`)
- **Hotels - Simulate Supplier A down** — `down=A`, all results fall back to B
- **Supplier A / B - raw hotels** — the mock catalogues
- **Health** — both suppliers reported `up`

The collection uses a `baseUrl` variable defaulting to `http://localhost:3000`.

---

## Unit tests

The core de-dupe / cheapest-selection rule is a pure function
(`src/domain/dedupe.ts`) covered by unit tests using Node's built-in test
runner (no extra test framework):

```bash
npm test
```

Cases covered: cheaper-of-two wins, single-supplier hotel kept, the assessment's
delhi sample, case-insensitive names, exact-price tie-break (Supplier A wins),
empty input, and ascending-price ordering.

---

## Project layout

```
src/
  api/
    server.ts              Express bootstrap + routing
    routes/hotels.ts       GET /api/hotels (starts the workflow)
    routes/suppliers.ts    Mock GET /supplierA|B/hotels
    routes/health.ts       GET /health
  temporal/
    client.ts              Temporal client (lazy, retrying)
    worker.ts              Worker entrypoint
    workflows.ts           hotelComparisonWorkflow (dedupe + cheapest)
    activities.ts          fetch suppliers, save to Redis, filter in Redis
  domain/
    dedupe.ts              Pure de-dupe + cheapest-selection rule
    dedupe.test.ts         Unit tests (node:test)
  redis/client.ts          ioredis connection + key helpers
  data/mockHotels.ts       Static supplier catalogues (overlapping names)
  config.ts                Env-driven configuration
  types.ts                 Shared domain types
Dockerfile                 Multi-stage build (one image, two commands)
docker-compose.yml         Full stack
postman/                   Postman collection (.json)
```

---

## Configuration

All configuration is environment-driven (see `.env.example`):

| Variable | Default | Notes |
|---|---|---|
| `API_PORT` | `3000` | Express port |
| `SUPPLIER_BASE_URL` | `http://localhost:3000` | Where activities reach the suppliers (`http://api:3000` in Docker) |
| `TEMPORAL_ADDRESS` | `localhost:7233` | Temporal frontend |
| `TEMPORAL_NAMESPACE` | `default` | |
| `TEMPORAL_TASK_QUEUE` | `hotel-orchestrator` | |
| `REDIS_URL` | `redis://localhost:6379` | |
| `REDIS_TTL_SECONDS` | `300` | TTL for cached city listings |

---

## Bonus features implemented

- **`/health`** reports the health of both suppliers (returns `503` if either is down).
- **Logging & error handling** in activities and the workflow — supplier calls
  are logged, activity failures are retried by Temporal, and the workflow
  degrades gracefully when a supplier is unavailable.

---

## Notes & trade-offs

- Supplier calls are retried up to 3 times (500ms initial, exponential backoff).
  A persistently failing supplier is tolerated as long as the other responds.
- Price filtering genuinely runs in Redis (`ZRANGEBYSCORE`); the application only
  hydrates the matching JSON blobs afterwards.
- `api` and `worker` share a single Docker image and differ only by start command.
```
