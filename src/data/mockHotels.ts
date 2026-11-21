import { SupplierHotel } from '../types';

/**
 * Static supplier catalogues. Values are chosen so A and B deliberately
 * overlap on hotel names, which is what makes the de-dupe + cheapest-price
 * comparison meaningful.
 *
 * For city=delhi the overlap reproduces the assessment's sample response:
 *   - "Holtin"  -> Supplier B wins (5340 < 6000)
 *   - "Radison" -> Supplier A wins (5900 < 6100)
 */
export const SUPPLIER_A_HOTELS: SupplierHotel[] = [
  { hotelId: 'a1', name: 'Holtin', price: 6000, city: 'delhi', commissionPct: 10 },
  { hotelId: 'a2', name: 'Radison', price: 5900, city: 'delhi', commissionPct: 13 },
  { hotelId: 'a3', name: 'Taz', price: 4200, city: 'delhi', commissionPct: 8 },
  { hotelId: 'a4', name: 'Oberon', price: 8100, city: 'mumbai', commissionPct: 15 },
  { hotelId: 'a5', name: 'Holtin', price: 7200, city: 'mumbai', commissionPct: 11 },
];

export const SUPPLIER_B_HOTELS: SupplierHotel[] = [
  { hotelId: 'b1', name: 'Holtin', price: 5340, city: 'delhi', commissionPct: 20 },
  { hotelId: 'b2', name: 'Radison', price: 6100, city: 'delhi', commissionPct: 9 },
  { hotelId: 'b3', name: 'Marrot', price: 3900, city: 'delhi', commissionPct: 12 },
  { hotelId: 'b4', name: 'Oberon', price: 7850, city: 'mumbai', commissionPct: 14 },
];

/** Filter a supplier catalogue down to a single city (case-insensitive). */
export function hotelsForCity(
  catalogue: SupplierHotel[],
  city: string,
): SupplierHotel[] {
  const target = city.trim().toLowerCase();
  return catalogue.filter((h) => h.city.toLowerCase() === target);
}
