import { describe, expect, it } from 'vitest';
import { mosaicAdjacentPairs, mosaicCells } from './mosaic';

describe('mosaicCells', () => {
  it('puts the first mission at the bottom-right of a full set', () => {
    const cells = mosaicCells([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(cells.slice(0, 6)).toEqual([12, 11, 10, 9, 8, 7]);
    expect(cells.slice(6)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it('pads the top row of an incomplete set', () => {
    const cells = mosaicCells([1, 2, 3, 4, 5, 6, 7]);
    expect(cells).toEqual([null, null, null, null, null, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('returns nothing for an empty set', () => {
    expect(mosaicCells([])).toEqual([]);
  });
});

describe('mosaicAdjacentPairs', () => {
  it('pairs neighbours without wrapping around rows', () => {
    const pairs = mosaicAdjacentPairs(['a', 'b', 'c', 'd'], 2);
    expect(pairs).toEqual([
      { first: 'a', second: 'b', direction: 'horizontal' },
      { first: 'a', second: 'c', direction: 'vertical' },
      { first: 'b', second: 'd', direction: 'vertical' },
      { first: 'c', second: 'd', direction: 'horizontal' },
    ]);
  });

  it('skips empty cells', () => {
    expect(mosaicAdjacentPairs([null, 'b', 'c', 'd'], 2)).toEqual([
      { first: 'b', second: 'd', direction: 'vertical' },
      { first: 'c', second: 'd', direction: 'horizontal' },
    ]);
  });
});
