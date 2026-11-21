import { log } from '@temporalio/activity';
import { config } from '../config';
import { getRedis, cityIndexKey, hotelKey } from '../redis/client';
import { HotelOffer, SupplierHotel, SupplierLabel } from '../types';

/**
 * Temporal activities = the side-effecting / non-deterministic steps.
 * Calling the suppliers over HTTP and touching Redis both happen here so the
 * workflow itself stays pure and deterministic.
 */

async function fetchSupplier(
  path: string,
  label: SupplierLabel,
  city: string,
  forceDown: boolean,
): Promise<HotelOffer[]> {
  // forceDown lets a request deliberately take one supplier offline so the
  // "one supplier down" scenario is reproducible from a single API call.
  const downParam = forceDown ? '&down=true' : '';
  const url = `${config.supplierBaseUrl}${path}?city=${encodeURIComponent(city)}${downParam}`;
  log.info('Calling supplier', { label, url });

  const res = await fetch(url);
  if (!res.ok) {
    // Thrown errors are retried by Temporal per the activity retry policy.
    throw new Error(`${label} returned HTTP ${res.status}`);
  }

  const hotels = (await res.json()) as SupplierHotel[];
  log.info('Supplier responded', { label, count: hotels.length });

  return hotels.map((h) => ({
    name: h.name,
    price: h.price,
    supplier: label,
    commissionPct: h.commissionPct,
  }));
}

export async function fetchSupplierA(city: string, forceDown = false): Promise<HotelOffer[]> {
  return fetchSupplier('/supplierA/hotels', 'Supplier A', city, forceDown);
}

export async function fetchSupplierB(city: string, forceDown = false): Promise<HotelOffer[]> {
  return fetchSupplier('/supplierB/hotels', 'Supplier B', city, forceDown);
}

/**
 * Persist the de-duplicated list for a city.
 *
 * Storage model:
 *   - A sorted set `hotels:<city>:byprice` with score = price, member = name.
 *     This is what lets us price-filter *inside Redis* via ZRANGEBYSCORE.
 *   - One string key per hotel holding the full JSON offer, for hydration.
 */
export async function saveDedupedListToRedis(
  city: string,
  offers: HotelOffer[],
): Promise<void> {
  const redis = getRedis();
  const indexKey = cityIndexKey(city);

  const pipeline = redis.multi();
  // Rebuild the index from scratch so stale members never linger.
  pipeline.del(indexKey);
  for (const offer of offers) {
    pipeline.zadd(indexKey, offer.price, offer.name);
    pipeline.set(
      hotelKey(city, offer.name),
      JSON.stringify(offer),
      'EX',
      config.redisTtlSeconds,
    );
  }
  if (offers.length > 0) {
    pipeline.expire(indexKey, config.redisTtlSeconds);
  }
  await pipeline.exec();

  log.info('Saved deduped list to Redis', { city, count: offers.length });
}

/**
 * Price filtering performed *inside Redis* using ZRANGEBYSCORE, then the
 * matching offers are hydrated from their JSON keys. Results come back in
 * ascending price order (that is the sorted-set score order).
 */
export async function filterByPriceFromRedis(
  city: string,
  minPrice: number,
  maxPrice: number,
): Promise<HotelOffer[]> {
  const redis = getRedis();
  const indexKey = cityIndexKey(city);

  const names = await redis.zrangebyscore(indexKey, minPrice, maxPrice);
  log.info('Filtered in Redis', { city, minPrice, maxPrice, matches: names.length });
  if (names.length === 0) return [];

  const blobs = await redis.mget(names.map((n) => hotelKey(city, n)));
  const offers: HotelOffer[] = [];
  for (const blob of blobs) {
    if (blob) offers.push(JSON.parse(blob) as HotelOffer);
  }
  return offers;
}
