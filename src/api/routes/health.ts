import { Router } from 'express';
import { config } from '../../config';

export const healthRouter = Router();

type SupplierStatus = 'up' | 'down';

/** Probe a supplier endpoint; treat any non-2xx or network error as down. */
async function probe(path: string): Promise<SupplierStatus> {
  try {
    const res = await fetch(`${config.supplierBaseUrl}${path}?city=delhi`);
    return res.ok ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

/**
 * GET /health
 * Reports overall service health plus the reachability of both suppliers.
 * Returns 503 if either supplier is down so orchestrators/load-balancers can
 * react.
 */
healthRouter.get('/health', async (_req, res) => {
  const [supplierA, supplierB] = await Promise.all([
    probe('/supplierA/hotels'),
    probe('/supplierB/hotels'),
  ]);

  const healthy = supplierA === 'up' && supplierB === 'up';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    suppliers: {
      'Supplier A': supplierA,
      'Supplier B': supplierB,
    },
    timestamp: new Date().toISOString(),
  });
});
