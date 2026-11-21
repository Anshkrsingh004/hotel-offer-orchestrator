/**
 * Shared domain types for the Hotel Offer Orchestrator.
 */

/** Raw shape returned by the mock supplier APIs. */
export interface SupplierHotel {
  hotelId: string;
  name: string;
  price: number;
  city: string;
  commissionPct: number;
}

/**
 * The de-duplicated, best-priced offer we return to the client and store in
 * Redis. Note the supplier field is a human-readable label ("Supplier A"),
 * not the raw supplier id.
 */
export interface HotelOffer {
  name: string;
  price: number;
  supplier: string;
  commissionPct: number;
}

/** Identifies which supplier an offer originated from. */
export type SupplierLabel = 'Supplier A' | 'Supplier B';
