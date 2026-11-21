import Redis from 'ioredis';
import { config } from '../config';

/**
 * A single shared ioredis connection for the process. ioredis handles
 * reconnection automatically, so this is safe to reuse across activities.
 */
let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(config.redisUrl, {
      // Keep trying to reach Redis on startup instead of throwing immediately,
      // which matters when containers come up in an arbitrary order.
      maxRetriesPerRequest: null,
      retryStrategy: (times: number) => Math.min(times * 200, 2000),
    });

    client.on('error', (err: Error) => {
      // eslint-disable-next-line no-console
      console.error('[redis] connection error:', err.message);
    });
  }
  return client;
}

/** Redis key for the sorted set of hotel names scored by price, per city. */
export function cityIndexKey(city: string): string {
  return `hotels:${city.toLowerCase()}:byprice`;
}

/** Redis key for the full JSON blob of a single hotel offer, per city+name. */
export function hotelKey(city: string, name: string): string {
  return `hotel:${city.toLowerCase()}:${name.toLowerCase()}`;
}
