import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeCheapest } from './dedupe';
import { HotelOffer } from '../types';

const offer = (
  name: string,
  price: number,
  supplier: HotelOffer['supplier'],
  commissionPct = 10,
): HotelOffer => ({ name, price, supplier, commissionPct });

test('keeps the cheaper offer when a hotel appears in both suppliers', () => {
  const result = dedupeCheapest([
    offer('Holtin', 6000, 'Supplier A'),
    offer('Holtin', 5340, 'Supplier B'),
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].price, 5340);
  assert.equal(result[0].supplier, 'Supplier B');
});

test('keeps a hotel that only one supplier returns', () => {
  const result = dedupeCheapest([
    offer('Taz', 4200, 'Supplier A'),
    offer('Marrot', 3900, 'Supplier B'),
  ]);
  assert.equal(result.length, 2);
  // Returned in ascending price order.
  assert.deepEqual(
    result.map((r) => r.name),
    ['Marrot', 'Taz'],
  );
});

test('reproduces the assessment sample for delhi', () => {
  const result = dedupeCheapest([
    offer('Holtin', 6000, 'Supplier A', 10),
    offer('Radison', 5900, 'Supplier A', 13),
    offer('Taz', 4200, 'Supplier A', 8),
    offer('Holtin', 5340, 'Supplier B', 20),
    offer('Radison', 6100, 'Supplier B', 9),
    offer('Marrot', 3900, 'Supplier B', 12),
  ]);
  assert.deepEqual(result, [
    offer('Marrot', 3900, 'Supplier B', 12),
    offer('Taz', 4200, 'Supplier A', 8),
    offer('Holtin', 5340, 'Supplier B', 20),
    offer('Radison', 5900, 'Supplier A', 13),
  ]);
});

test('de-duplicates case-insensitively by name', () => {
  const result = dedupeCheapest([
    offer('holtin', 5000, 'Supplier A'),
    offer('Holtin', 4000, 'Supplier B'),
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].price, 4000);
});

test('on an exact price tie, the first-seen offer (Supplier A) wins', () => {
  const result = dedupeCheapest([
    offer('Oberon', 7000, 'Supplier A'),
    offer('Oberon', 7000, 'Supplier B'),
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].supplier, 'Supplier A');
});

test('returns an empty array when there are no offers', () => {
  assert.deepEqual(dedupeCheapest([]), []);
});

test('results are always sorted ascending by price', () => {
  const result = dedupeCheapest([
    offer('C', 300, 'Supplier A'),
    offer('A', 100, 'Supplier B'),
    offer('B', 200, 'Supplier A'),
  ]);
  assert.deepEqual(
    result.map((r) => r.price),
    [100, 200, 300],
  );
});
