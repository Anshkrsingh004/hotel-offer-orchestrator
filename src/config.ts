/**
 * Centralised configuration, read from environment variables with sensible
 * defaults so the app runs both locally (ts-node) and inside Docker Compose.
 */

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const config = {
  /** Port the Express API (and the mock suppliers) listens on. */
  apiPort: envInt('API_PORT', 3000),

  /**
   * Base URL the Temporal activities use to reach the mock supplier endpoints.
   * Inside Docker this points at the `api` service; locally it defaults to
   * localhost. The suppliers live inside the API service itself.
   */
  supplierBaseUrl: env('SUPPLIER_BASE_URL', 'http://localhost:3000'),

  /** Temporal frontend address (host:port). */
  temporalAddress: env('TEMPORAL_ADDRESS', 'localhost:7233'),
  temporalNamespace: env('TEMPORAL_NAMESPACE', 'default'),
  temporalTaskQueue: env('TEMPORAL_TASK_QUEUE', 'hotel-orchestrator'),

  /** Redis connection URL, e.g. redis://redis:6379 inside Docker. */
  redisUrl: env('REDIS_URL', 'redis://localhost:6379'),

  /** How long (seconds) a stored city listing stays in Redis before expiring. */
  redisTtlSeconds: envInt('REDIS_TTL_SECONDS', 300),
} as const;
