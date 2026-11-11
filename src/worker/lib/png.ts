/**
 * Minimal inspection of uploaded files. Images are composed in the browser
 * and the Worker never decodes them; reading a few header bytes is enough
 * to refuse anything that is not what it should be. The type is worked out
 * from the content because the name or header sent by a client can lie.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// PNG colour types that carry an alpha channel: greyscale + alpha, RGBA.
const PNG_ALPHA_COLOUR_TYPES = [4, 6];
const PNG_INDEXED_COLOUR_TYPE = 3;
const PNG_FIRST_CHUNK_OFFSET = 8;

/** Data read from a PNG header. */
export interface PngInfo {
  width: number;
  height: number;
  hasAlpha: boolean;
}

/** File types the application stores. */
export type FileType = 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';

/**
 * Reads four bytes as ASCII text.
 *
 * @param view - The file.
 * @param offset - Position of the first byte.
 * @returns The text.
 */
function fourCharacters(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

/**
 * Tells whether an indexed PNG declares transparency. That lives in a
 * `tRNS` chunk, which always comes before the image data.
 *
 * @param view - The file.
 * @returns True when the chunk is present.
 */
function hasTransparencyChunk(view: DataView): boolean {
  let offset = PNG_FIRST_CHUNK_OFFSET;
  while (offset + 8 <= view.byteLength) {
    const type = fourCharacters(view, offset + 4);
    if (type === 'tRNS') {
      return true;
    }
    if (type === 'IDAT') {
      return false;
    }
    // Length field + type + data + checksum.
    offset += 12 + view.getUint32(offset);
  }
  return false;
}

/**
 * Reads the header of a PNG.
 *
 * @param bytes - Contents of the file.
 * @returns Its dimensions and transparency, or null when it is not a PNG.
 */
export function readPngInfo(bytes: ArrayBuffer): PngInfo | null {
  // Signature (8) + chunk length (4) + "IHDR" (4) + width (4) + height (4)
  // + bit depth (1) + colour type (1).
  if (bytes.byteLength < 26) {
    return null;
  }
  const view = new DataView(bytes);
  const isPng = PNG_SIGNATURE.every((byte, index) => view.getUint8(index) === byte);
  if (!isPng || fourCharacters(view, 12) !== 'IHDR') {
    return null;
  }
  const colourType = view.getUint8(25);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
    hasAlpha:
      PNG_ALPHA_COLOUR_TYPES.includes(colourType) ||
      (colourType === PNG_INDEXED_COLOUR_TYPE && hasTransparencyChunk(view)),
  };
}

/**
 * Works out the type of a file from its first bytes.
 *
 * @param bytes - Contents of the file.
 * @returns The type, or null when it is not one the application accepts.
 */
export function detectFileType(bytes: ArrayBuffer): FileType | null {
  if (bytes.byteLength < 12) {
    return null;
  }
  const view = new DataView(bytes);
  if (readPngInfo(bytes) !== null) {
    return 'image/png';
  }
  if (view.getUint8(0) === 0xff && view.getUint8(1) === 0xd8 && view.getUint8(2) === 0xff) {
    return 'image/jpeg';
  }
  if (fourCharacters(view, 0) === 'RIFF' && fourCharacters(view, 8) === 'WEBP') {
    return 'image/webp';
  }
  return fourCharacters(view, 0) === '%PDF' ? 'application/pdf' : null;
}

/** Font file types accepted for Biocards. */
export type FontType = 'font/ttf' | 'font/otf' | 'font/woff' | 'font/woff2';

/**
 * Works out the type of a font file from its first four bytes.
 *
 * @param bytes - Contents of the file.
 * @returns The type, or null when it is not a font the browser can load.
 */
export function detectFontType(bytes: ArrayBuffer): FontType | null {
  if (bytes.byteLength < 12) {
    return null;
  }
  const view = new DataView(bytes);
  const tag = fourCharacters(view, 0);
  if (view.getUint32(0) === 0x00010000 || tag === 'true') {
    return 'font/ttf';
  }
  if (tag === 'OTTO') {
    return 'font/otf';
  }
  if (tag === 'wOFF') {
    return 'font/woff';
  }
  return tag === 'wOF2' ? 'font/woff2' : null;
}
