/**
 * Minimal PNG header inspection. Images are composed in the browser and
 * the Worker never decodes them; reading the fixed-position header fields
 * is enough to refuse anything that is not what the browser should send.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Dimensions read from a PNG header. */
export interface PngInfo {
  width: number;
  height: number;
}

/**
 * Reads the dimensions of a PNG.
 *
 * @param bytes - Contents of the file.
 * @returns The dimensions, or null when the content is not a PNG.
 */
export function readPngInfo(bytes: ArrayBuffer): PngInfo | null {
  // Signature (8) + chunk length (4) + "IHDR" (4) + width (4) + height (4).
  if (bytes.byteLength < 24) {
    return null;
  }
  const view = new DataView(bytes);
  const isPng = PNG_SIGNATURE.every((byte, index) => view.getUint8(index) === byte);
  const ihdr = String.fromCharCode(...new Uint8Array(bytes, 12, 4));
  if (!isPng || ihdr !== 'IHDR') {
    return null;
  }
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
