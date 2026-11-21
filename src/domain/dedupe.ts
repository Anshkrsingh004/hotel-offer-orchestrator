import { HotelOffer } from '../types';

/**
 * De-duplicate hotel offers by name, keeping the cheapest offer for each name.
 *
 *  - If a hotel appears in both suppliers, the cheaper-priced offer wins.
 *  - If only one supplier returns a hotel, that offer is kept.
 *  - On an exact price tie the first offer seen wins (callers pass Supplier A
 *    before Supplier B, giving A precedence on ties).
 *  - Names are compared case-insensitively.
 *  - Results are returned in ascending price order.
 *
 * Pure and deterministic, so it is safe to call from inside the Temporal
 * workflow as well as from unit tests.
 */
export function dedupeCheapest(offers: HotelOffer[]): HotelOffer[] {
  const cheapestByName = new Map<string, HotelOffer>();
  for (const offer of offers) {
    const key = offer.name.toLowerCase();
    const existing = cheapestByName.get(key);
    if (!existing || offer.price < existing.price) {
      cheapestByName.set(key, offer);
    }
  }
  return [...cheapestByName.values()].sort((a, b) => a.price - b.price);
}
