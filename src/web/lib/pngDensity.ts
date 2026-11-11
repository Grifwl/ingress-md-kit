/**
 * Records the print resolution inside a PNG. Browsers write PNGs without
 * it, and printers then guess; with it, a card template of 744 px wide
 * opens as 63 mm wide in any program that respects it.
 */
import { crc32 } from './exports/zip';

const SIGNATURE_LENGTH = 8;
// Length (4) + "IHDR" (4) + 13 bytes of data + checksum (4).
const HEADER_CHUNK_LENGTH = 25;
const METRES_PER_INCH = 0.0254;

/**
 * Builds a `pHYs` chunk, which gives pixels per metre on both axes.
 *
 * @param dpi - Resolution in dots per inch.
 * @returns The chunk, ready to insert.
 */
function densityChunk(dpi: number): Uint8Array {
  const pixelsPerMetre = Math.round(dpi / METRES_PER_INCH);
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, pixelsPerMetre);
  view.setUint32(12, pixelsPerMetre);
  chunk[16] = 1; // The unit is the metre.
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  return chunk;
}

/**
 * Tells whether a PNG already states its resolution. Chunks are walked
 * one by one rather than searched for, because compressed image data can
 * contain any four bytes; `pHYs` must come before the image data.
 *
 * @param png - Contents of a PNG.
 * @returns True when a `pHYs` chunk is present.
 */
function hasDensityChunk(png: Uint8Array): boolean {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let offset = SIGNATURE_LENGTH;
  while (offset + 8 <= png.length) {
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    if (type === 'pHYs') {
      return true;
    }
    if (type === 'IDAT' || type === 'IEND') {
      return false;
    }
    // Length field + type + data + checksum.
    offset += 12 + view.getUint32(offset);
  }
  return false;
}

/**
 * Inserts the print resolution right after the header of a PNG, where the
 * format requires it to be. A file that already has one is left alone.
 *
 * @param png - Contents of a PNG as a browser writes it.
 * @param dpi - Resolution in dots per inch.
 * @returns The new contents.
 */
export function withPixelDensity(png: Uint8Array, dpi: number): Uint8Array<ArrayBuffer> {
  const insertAt = SIGNATURE_LENGTH + HEADER_CHUNK_LENGTH;
  if (hasDensityChunk(png)) {
    return new Uint8Array(png);
  }
  const chunk = densityChunk(dpi);
  const result = new Uint8Array(png.length + chunk.length);
  result.set(png.subarray(0, insertAt));
  result.set(chunk, insertAt);
  result.set(png.subarray(insertAt), insertAt + chunk.length);
  return result;
}
