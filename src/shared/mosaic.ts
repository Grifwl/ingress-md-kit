/**
 * Layout of the mission mosaic.
 *
 * All the ordering logic lives in `mosaicCells`, so that a change in how
 * the set should be displayed stays in one function.
 */
import { MOSAIC_COLUMNS } from './rules';

/** Two neighbouring images of the mosaic. */
export interface MosaicPair<T> {
  first: T;
  second: T;
  direction: 'horizontal' | 'vertical';
}

/**
 * Lays out missions the way the scanner shows a set: the first mission at
 * the bottom-right and the last one towards the top-left. Empty cells pad
 * the top row of an incomplete set, keeping the first mission in place
 * while organisers are still choosing.
 *
 * @param ordered - Items in recommended order, first mission first.
 * @param columns - Number of columns of the grid.
 * @returns Cells from top-left to bottom-right, row by row; null when empty.
 */
export function mosaicCells<T>(
  ordered: readonly T[],
  columns: number = MOSAIC_COLUMNS,
): (T | null)[] {
  const padding = (columns - (ordered.length % columns)) % columns;
  return [...Array<null>(padding).fill(null), ...[...ordered].reverse()];
}

/**
 * Lists the pairs of images that touch in the mosaic, which are the ones
 * that could read as a single picture.
 *
 * @param cells - Output of `mosaicCells`.
 * @param columns - Number of columns of the grid.
 * @returns Each adjacent pair once; `first` is left of or above `second`.
 */
export function mosaicAdjacentPairs<T>(
  cells: readonly (T | null)[],
  columns: number = MOSAIC_COLUMNS,
): MosaicPair<T>[] {
  const pairs: MosaicPair<T>[] = [];
  cells.forEach((first, index) => {
    if (first === null) {
      return;
    }
    const right = (index + 1) % columns === 0 ? null : (cells[index + 1] ?? null);
    if (right !== null) {
      pairs.push({ first, second: right, direction: 'horizontal' });
    }
    const below = cells[index + columns] ?? null;
    if (below !== null) {
      pairs.push({ first, second: below, direction: 'vertical' });
    }
  });
  return pairs;
}
