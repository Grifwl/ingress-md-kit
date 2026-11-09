/**
 * Soft check against designing the set as a banner: neighbouring images
 * whose touching edges almost match probably continue one picture. It is
 * only advice, so it compares raw edge pixels and accepts false alarms
 * rather than paying for anything cleverer.
 */
import type { MosaicPair } from '../../../shared/mosaic';

/** Resolution used for comparing; a small image is enough and fast. */
const SAMPLE_SIZE = 64;

/** Similarity from which two edges are reported, between 0 and 1. */
export const EDGE_SIMILARITY_THRESHOLD = 0.96;

/** Side of a square image. */
export type Edge = 'left' | 'right' | 'top' | 'bottom';

/**
 * Reads the pixels along one side of a square image.
 *
 * @param data - RGBA pixels, row by row.
 * @param size - Side of the image in pixels.
 * @param edge - Side to read.
 * @returns The RGB values along that side.
 */
export function extractEdge(data: Uint8ClampedArray, size: number, edge: Edge): number[] {
  const values: number[] = [];
  for (let step = 0; step < size; step += 1) {
    const column = edge === 'left' ? 0 : edge === 'right' ? size - 1 : step;
    const row = edge === 'top' ? 0 : edge === 'bottom' ? size - 1 : step;
    const offset = (row * size + column) * 4;
    values.push(data[offset]!, data[offset + 1]!, data[offset + 2]!);
  }
  return values;
}

/**
 * Compares two edges.
 *
 * @param a - RGB values of one edge.
 * @param b - RGB values of the other, of the same length.
 * @returns 1 for identical edges, down to 0 for opposite ones.
 */
export function edgeSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || a.length !== b.length) {
    return 0;
  }
  const difference = a.reduce((sum, value, index) => sum + Math.abs(value - b[index]!), 0);
  return 1 - difference / (a.length * 255);
}

/**
 * Loads an image and returns its pixels at the sampling resolution.
 *
 * @param url - Address of the image, on this same site.
 * @returns The RGBA pixels.
 */
async function loadPixels(url: string): Promise<Uint8ClampedArray> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) {
    throw new Error('Canvas is not available');
  }
  context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  return context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
}

/**
 * Finds the neighbouring images whose touching edges almost match.
 *
 * @param pairs - Neighbours in the mosaic; every item must have an image.
 * @param urlOf - Gives the address of an item's image.
 * @returns The pairs that look like one continuous picture.
 */
export async function findBannerLikePairs<T>(
  pairs: readonly MosaicPair<T>[],
  urlOf: (item: T) => string,
): Promise<MosaicPair<T>[]> {
  // Each image takes part in up to four pairs, but is only loaded once.
  const pixels = new Map<T, Promise<Uint8ClampedArray>>();

  /**
   * Returns the pixels of an item, loading them the first time.
   *
   * @param item - Mosaic item.
   * @returns Its pixels.
   */
  const pixelsOf = (item: T): Promise<Uint8ClampedArray> => {
    let loaded = pixels.get(item);
    if (loaded === undefined) {
      loaded = loadPixels(urlOf(item));
      pixels.set(item, loaded);
    }
    return loaded;
  };

  const results = await Promise.all(
    pairs.map(async (pair) => {
      const [first, second] = await Promise.all([pixelsOf(pair.first), pixelsOf(pair.second)]);
      const horizontal = pair.direction === 'horizontal';
      const similarity = edgeSimilarity(
        extractEdge(first, SAMPLE_SIZE, horizontal ? 'right' : 'bottom'),
        extractEdge(second, SAMPLE_SIZE, horizontal ? 'left' : 'top'),
      );
      return similarity >= EDGE_SIMILARITY_THRESHOLD ? pair : null;
    }),
  );
  return results.filter((pair) => pair !== null);
}
