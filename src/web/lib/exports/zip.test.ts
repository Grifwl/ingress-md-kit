import { describe, expect, it } from 'vitest';
import { buildZip, crc32, missionImageName } from './zip';

const encoder = new TextEncoder();

/**
 * Reads the files of an archive through its central directory, as an
 * unzipping program would.
 *
 * @param archive - The archive.
 * @returns The name and contents of each file.
 */
function readZip(archive: Uint8Array<ArrayBuffer>): { name: string; content: string }[] {
  const view = new DataView(archive.buffer);
  const end = archive.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const files = [];
  for (let index = 0; index < count; index += 1) {
    expect(view.getUint32(cursor, true)).toBe(0x02014b50);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const local = view.getUint32(cursor + 42, true);
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const name = decoder.decode(archive.subarray(cursor + 46, cursor + 46 + nameLength));
    const start = local + 30 + view.getUint16(local + 26, true);
    files.push({ name, content: decoder.decode(archive.subarray(start, start + size)) });
    cursor += 46 + nameLength;
  }
  return files;
}

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('buildZip', () => {
  it('stores every file so that it can be read back', () => {
    const archive = buildZip([
      { name: 'a.txt', bytes: encoder.encode('first') },
      { name: 'món.txt', bytes: encoder.encode('second') },
    ]);
    expect(readZip(archive)).toEqual([
      { name: 'a.txt', content: 'first' },
      { name: 'món.txt', content: 'second' },
    ]);
  });

  it('builds a valid empty archive', () => {
    expect(readZip(buildZip([]))).toEqual([]);
  });
});

describe('missionImageName', () => {
  it('numbers the file and removes forbidden characters', () => {
    expect(missionImageName(3, 'MD 2027: Example City, Old Bridge')).toBe(
      '03 - MD 2027 Example City, Old Bridge.png',
    );
  });
});
