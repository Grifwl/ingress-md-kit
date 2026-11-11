import { describe, expect, it } from 'vitest';
import { crc32 } from './exports/zip';
import { withPixelDensity } from './pngDensity';

/**
 * Builds a PNG made of the signature, a header and an end chunk; enough
 * for the insertion, which never looks at the image data.
 *
 * @returns The file contents.
 */
function minimalPng(): Uint8Array {
  const bytes = new Uint8Array(8 + 25 + 12);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  bytes.set([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44], 33);
  return bytes;
}

describe('withPixelDensity', () => {
  it('inserts a valid pHYs chunk right after the header', () => {
    const result = withPixelDensity(minimalPng(), 300);
    const view = new DataView(result.buffer);
    expect(result.length).toBe(minimalPng().length + 21);
    expect(new TextDecoder().decode(result.subarray(37, 41))).toBe('pHYs');
    expect(view.getUint32(33)).toBe(9);
    // 300 dpi is 11811 pixels per metre.
    expect(view.getUint32(41)).toBe(11811);
    expect(view.getUint32(45)).toBe(11811);
    expect(result[49]).toBe(1);
    expect(view.getUint32(50)).toBe(crc32(result.subarray(37, 50)));
    expect(new TextDecoder().decode(result.subarray(58, 62))).toBe('IEND');
  });

  it('leaves a file that already has a resolution alone', () => {
    const once = withPixelDensity(minimalPng(), 300);
    expect(withPixelDensity(once, 600)).toEqual(once);
  });
});
