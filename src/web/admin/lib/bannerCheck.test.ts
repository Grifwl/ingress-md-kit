import { describe, expect, it } from 'vitest';
import { edgeSimilarity, extractEdge } from './bannerCheck';

describe('extractEdge', () => {
  // Pixels numbered 0 to 3, laid out as [0 1] over [2 3]; R holds the number.
  const data = new Uint8ClampedArray([0, 0, 0, 255, 1, 0, 0, 255, 2, 0, 0, 255, 3, 0, 0, 255]);

  /**
   * Extracts the red value of each pixel along an edge.
   *
   * @param edge - Side to read.
   * @returns The pixel numbers.
   */
  function reds(edge: Parameters<typeof extractEdge>[2]): number[] {
    return extractEdge(data, 2, edge).filter((_, index) => index % 3 === 0);
  }

  it('reads each side in order', () => {
    expect(reds('top')).toEqual([0, 1]);
    expect(reds('bottom')).toEqual([2, 3]);
    expect(reds('left')).toEqual([0, 2]);
    expect(reds('right')).toEqual([1, 3]);
  });
});

describe('edgeSimilarity', () => {
  it('is 1 for identical edges', () => {
    expect(edgeSimilarity([10, 20, 30], [10, 20, 30])).toBe(1);
  });

  it('is 0 for opposite edges', () => {
    expect(edgeSimilarity([0, 255], [255, 0])).toBe(0);
  });

  it('is 0 when there is nothing comparable', () => {
    expect(edgeSimilarity([], [])).toBe(0);
    expect(edgeSimilarity([1], [1, 2])).toBe(0);
  });
});
