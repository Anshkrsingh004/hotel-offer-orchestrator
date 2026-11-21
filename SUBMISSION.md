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
the API, and the worker). The README has the full setup and run steps, and
there's a Postman collection covering the main cases, including a city with no
results and a one-supplier-down scenario.

I also added the optional bits: a `/health` endpoint that reports both
suppliers, logging/error handling in the activities and workflow, and a small
unit test for the de-dupe logic. I've run the whole stack end-to-end to confirm
it works.

Happy to walk through any part of it.

Thanks,
Ansh
