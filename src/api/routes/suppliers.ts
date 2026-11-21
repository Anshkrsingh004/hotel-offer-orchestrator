import { Router, Request, Response } from 'express';
import { SUPPLIER_A_HOTELS, SUPPLIER_B_HOTELS, hotelsForCity } from '../../data/mockHotels';
import { SupplierHotel } from '../../types';

/**
 * Mock supplier endpoints hosted inside this same service.
 *
 *   GET /supplierA/hotels?city=delhi
 *   GET /supplierB/hotels?city=delhi
 *
 * Failure simulation: add ?down=true (or set the DOWN_SUPPLIER_A / _B env var)
 * to make a supplier return HTTP 503. This drives the "one supplier down"
 * Postman scenario and exercises the workflow's resilience path.
 */
export const suppliersRouter = Router();

function makeSupplierHandler(
  label: 'A' | 'B',
  catalogue: SupplierHotel[],
): (req: Request, res: Response) => void {
  return (req, res) => {
    const downByQuery = String(req.query.down ?? '').toLowerCase() === 'true';
    const downByEnv = process.env[`DOWN_SUPPLIER_${label}`] === 'true';
    if (downByQuery || downByEnv) {
      res.status(503).json({ error: `Supplier ${label} is currently unavailable` });
      return;
    }

    const city = typeof req.query.city === 'string' ? req.query.city : '';
    const hotels = city ? hotelsForCity(catalogue, city) : catalogue;
    res.json(hotels);
  };
}

suppliersRouter.get('/supplierA/hotels', makeSupplierHandler('A', SUPPLIER_A_HOTELS));
suppliersRouter.get('/supplierB/hotels', makeSupplierHandler('B', SUPPLIER_B_HOTELS));
