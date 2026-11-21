# Submission Note

Hi,

Please find my submission for the Hotel Offer Orchestrator assessment:

**Repo:** https://github.com/Anshkrsingh004/hotel-offer-orchestrator

I built the service in Node.js/TypeScript with Express, using Temporal to
orchestrate the comparison. On a request to `/api/hotels`, the workflow calls
both mock suppliers in parallel (as activities with retries), de-duplicates
hotels by name keeping the cheaper offer, stores the result in Redis, and —
when a price range is given — does the filtering inside Redis with
`ZRANGEBYSCORE`. If one supplier is down the workflow still returns the other's
results.

Everything runs with a single `docker compose up` (Temporal, Postgres, Redis,
the API, and the worker). I added healthchecks so the services start in the
right order — the API is gated on its own `/health` endpoint and the worker
waits for both Temporal and the API to be healthy, rather than relying only on
retries. The README has the full setup and run steps, and there's a Postman
collection covering the main cases, including a city with no results and a
one-supplier-down scenario.

I also added the optional bits: the `/health` endpoint that reports both
suppliers (and doubles as the API's Docker healthcheck), logging/error handling
in the activities and workflow, and a small unit test for the de-dupe logic.
I've run the whole stack end-to-end to confirm it works.

One small heads-up for the Postman run: the "supplier down" request (`?down=A`)
deliberately exercises the retry path, so it takes ~2–2.5 seconds to return
(the healthy supplier is fetched in parallel) — it's retrying, not hung.

Happy to walk through any part of it.

Thanks,
Ansh
