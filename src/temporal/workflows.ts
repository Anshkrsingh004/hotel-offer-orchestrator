import { proxyActivities, ApplicationFailure, log } from '@temporalio/workflow';
import type * as activities from './activities';
import type { HotelOffer } from '../types';

/**
 * Activity stubs. Each supplier call is retried up to 3 times; a persistently
 * failing supplier is handled gracefully by the workflow (see below).
 */
const { fetchSupplierA, fetchSupplierB, saveDedupedListToRedis, filterByPriceFromRedis } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '10 seconds',
    retry: {
      initialInterval: '500ms',
      backoffCoefficient: 2,
      maximumInterval: '5 seconds',
      maximumAttempts: 3,
    },
  });

export interface HotelSearchInput {
  city: string;
  minPrice?: number;
  maxPrice?: number;
  /** Force a supplier offline for this request (failure simulation). */
  down?: 'A' | 'B';
}

/** Run an activity, returning null instead of throwing if it ultimately fails. */
async function tryFetch(fn: () => Promise<HotelOffer[]>): Promise<HotelOffer[] | null> {
  try {
    return await fn();
  } catch (err) {
    log.warn('Supplier fetch failed after retries', { error: String(err) });
    return null;
  }
}

/**
 * Orchestrates the hotel comparison:
 *   1. Call Supplier A and Supplier B in parallel.
 *   2. De-duplicate by name, keeping the cheaper price (if only one supplier
 *      has a hotel, that one is kept).
 *   3. Persist the de-duplicated list to Redis.
 *   4. Optionally price-filter the result inside Redis.
 */
export async function hotelComparisonWorkflow(input: HotelSearchInput): Promise<HotelOffer[]> {
  const { city, minPrice, maxPrice, down } = input;
  log.info('Workflow started', { city, minPrice, maxPrice, down });

  // 1. Parallel supplier calls, resilient to one supplier being down.
  const [aOffers, bOffers] = await Promise.all([
    tryFetch(() => fetchSupplierA(city, down === 'A')),
    tryFetch(() => fetchSupplierB(city, down === 'B')),
  ]);

  if (aOffers === null && bOffers === null) {
    throw ApplicationFailure.nonRetryable(
      'Both suppliers are unavailable',
      'BothSuppliersDown',
    );
  }

  const allOffers: HotelOffer[] = [...(aOffers ?? []), ...(bOffers ?? [])];

  // 2. De-duplicate by name, keeping the cheapest offer.
  const cheapestByName = new Map<string, HotelOffer>();
  for (const offer of allOffers) {
    const key = offer.name.toLowerCase();
    const existing = cheapestByName.get(key);
    if (!existing || offer.price < existing.price) {
      cheapestByName.set(key, offer);
    }
  }
  const deduped = [...cheapestByName.values()].sort((a, b) => a.price - b.price);

  // 3. Persist to Redis (sorted set scored by price).
  await saveDedupedListToRedis(city, deduped);

  // 4. Price-filter inside Redis when a range is requested.
  if (minPrice !== undefined || maxPrice !== undefined) {
    return filterByPriceFromRedis(
      city,
      minPrice ?? 0,
      maxPrice ?? Number.MAX_SAFE_INTEGER,
    );
  }

  return deduped;
}
