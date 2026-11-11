import { describe, expect, it } from 'vitest';
import { detectFileType, detectFontType, readJpegSize, readPngInfo } from './png';

/**
 * Builds a PNG made of a header and the given extra chunks.
 *
 * @param colourType - PNG colour type.
 * @param chunks - Types of the empty chunks that follow the header.
 * @returns The file contents.
 */
function png(colourType: number, chunks: string[] = []): ArrayBuffer {
  const bytes = new Uint8Array(33 + chunks.length * 12);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 512);
  view.setUint32(20, 256);
  bytes[25] = colourType;
  chunks.forEach((type, index) => {
    bytes.set(new TextEncoder().encode(type), 33 + index * 12 + 4);
  });
  return bytes.buffer;
}

/**
 * Builds the start of a JPEG: an APP0 segment, then a baseline
 * start-of-frame segment with the given dimensions.
 *
 * @param width - Width in pixels.
 * @param height - Height in pixels.
 * @returns The file contents.
 */
function jpegHeader(width: number, height: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(2 + 18 + 19);
  bytes.set([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
  bytes.set([0xff, 0xc0, 0, 17, 8], 20);
  const view = new DataView(bytes.buffer);
  view.setUint16(25, height);
  view.setUint16(27, width);
  return bytes;
}

/**
 * Builds a file starting with the given ASCII text.
 *
 * @param start - First characters.
 * @returns The file contents.
 */
function ascii(start: string): ArrayBuffer {
  const bytes = new Uint8Array(40);
  bytes.set(new TextEncoder().encode(start));
  return bytes.buffer;
}

describe('readPngInfo', () => {
  it('reads the dimensions', () => {
    expect(readPngInfo(png(6))).toMatchObject({ width: 512, height: 256 });
  });

  it.each([
    ['RGBA', 6, [], true],
    ['greyscale with alpha', 4, [], true],
    ['RGB', 2, [], false],
    ['indexed with transparency', 3, ['PLTE', 'tRNS', 'IDAT'], true],
    ['indexed without transparency', 3, ['PLTE', 'IDAT'], false],
  ])('detects transparency in %s', (_name, colourType, chunks, expected) => {
    expect(readPngInfo(png(colourType, chunks))?.hasAlpha).toBe(expected);
  });

  it('rejects other content', () => {
    expect(readPngInfo(ascii('not a png at all, really'))).toBeNull();
    expect(readPngInfo(new ArrayBuffer(4))).toBeNull();
  });
});

describe('detectFileType', () => {
  it('recognises each accepted type', () => {
    expect(detectFileType(png(6))).toBe('image/png');
    expect(detectFileType(new Uint8Array([0xff, 0xd8, 0xff, ...Array(20).fill(0)]).buffer)).toBe(
      'image/jpeg',
    );
    expect(detectFileType(ascii('RIFF0000WEBP'))).toBe('image/webp');
    expect(detectFileType(ascii('%PDF-1.7'))).toBe('application/pdf');
  });

  it('refuses anything else, including SVG', () => {
    expect(detectFileType(ascii('<svg xmlns="x">'))).toBeNull();
    expect(detectFileType(new ArrayBuffer(2))).toBeNull();
  });
});

describe('detectFontType', () => {
  /**
   * Builds a file starting with the given bytes.
   *
   * @param start - First bytes.
   * @returns The file contents.
   */
  const file = (start: number[]) => {
    const bytes = new Uint8Array(16);
    bytes.set(start);
    return bytes.buffer;
  };
  const ascii = (tag: string) => [...tag].map((character) => character.charCodeAt(0));

  it('recognises the font formats browsers load', () => {
    expect(detectFontType(file([0, 1, 0, 0]))).toBe('font/ttf');
    expect(detectFontType(file(ascii('OTTO')))).toBe('font/otf');
    expect(detectFontType(file(ascii('wOFF')))).toBe('font/woff');
    expect(detectFontType(file(ascii('wOF2')))).toBe('font/woff2');
  });

  it('refuses anything else', () => {
    expect(detectFontType(file([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(detectFontType(new ArrayBuffer(4))).toBeNull();
  });
});

describe('readJpegSize', () => {
  it('reads the dimensions from the start-of-frame segment', () => {
    expect(readJpegSize(jpegHeader(2048, 1536).buffer)).toEqual({ width: 2048, height: 1536 });
  });

  it('refuses files that are not JPEG or have no frame header', () => {
    expect(readJpegSize(png(6))).toBeNull();
    expect(readJpegSize(jpegHeader(10, 10).buffer.slice(0, 24))).toBeNull();
    const scanFirst = jpegHeader(10, 10);
    scanFirst[21] = 0xda;
    expect(readJpegSize(scanFirst.buffer)).toBeNull();
  });
});
