import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getTemporalClient } from '../../temporal/client';
import { hotelComparisonWorkflow, HotelSearchInput } from '../../temporal/workflows';
import { config } from '../../config';

export const hotelsRouter = Router();

/** Parse an optional non-negative numeric query param. */
function parseOptionalNumber(value: unknown): number | undefined | 'invalid' {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') return 'invalid';
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 'invalid';
  return n;
}

/**
 * GET /api/hotels?city=delhi
 * GET /api/hotels?city=delhi&minPrice=<min>&maxPrice=<max>
 *
 * Starts the Temporal workflow that fans out to both suppliers, de-dupes,
 * persists to Redis, and (when a range is given) price-filters inside Redis.
 */
hotelsRouter.get('/hotels', async (req, res) => {
  const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
  if (!city) {
    res.status(400).json({ error: 'Query param "city" is required' });
    return;
  }

  const minPrice = parseOptionalNumber(req.query.minPrice);
  const maxPrice = parseOptionalNumber(req.query.maxPrice);
  if (minPrice === 'invalid' || maxPrice === 'invalid') {
    res.status(400).json({ error: 'minPrice and maxPrice must be non-negative numbers' });
    return;
  }
  if (typeof minPrice === 'number' && typeof maxPrice === 'number' && minPrice > maxPrice) {
    res.status(400).json({ error: 'minPrice cannot be greater than maxPrice' });
    return;
  }

  // Optional failure simulation: ?down=A or ?down=B takes that supplier offline.
  const downRaw = typeof req.query.down === 'string' ? req.query.down.trim().toUpperCase() : '';
  if (downRaw && downRaw !== 'A' && downRaw !== 'B') {
    res.status(400).json({ error: 'down must be "A" or "B"' });
    return;
  }
  const down = downRaw === 'A' || downRaw === 'B' ? (downRaw as 'A' | 'B') : undefined;

  const input: HotelSearchInput = {
    city,
    minPrice: minPrice as number | undefined,
    maxPrice: maxPrice as number | undefined,
    down,
  };

  try {
    const client = await getTemporalClient();
    const result = await client.workflow.execute(hotelComparisonWorkflow, {
      args: [input],
      taskQueue: config.temporalTaskQueue,
      workflowId: `hotels-${city.toLowerCase()}-${randomUUID()}`,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[api] workflow failed:', message);
    res.status(502).json({
      error: 'Failed to orchestrate hotel comparison',
      detail: message,
    });
  }
});
