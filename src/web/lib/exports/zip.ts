/**
 * A minimal ZIP writer. PNG files are already compressed, so entries are
 * simply stored, which needs no compression library.
 */

/** A file to put in the archive. */
export interface ZipEntry {
  name: string;
  bytes: Uint8Array<ArrayBuffer>;
}

const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_RECORD_SIZE = 22;
const ZIP_VERSION = 20;
// Bit 11 declares that file names are UTF-8.
const UTF8_FLAG = 0x0800;
// DOS date of 1980-01-01, the earliest a ZIP can hold: entries carry no
// meaningful date, and a fixed one makes the output reproducible.
const FIXED_DOS_DATE = 0x0021;

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

/**
 * Computes the CRC-32 checksum a ZIP stores for each file.
 *
 * @param bytes - Contents of the file.
 * @returns The checksum.
 */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Builds a ZIP archive.
 *
 * @param entries - Files to include.
 * @returns The bytes of the archive.
 */
export function buildZip(entries: readonly ZipEntry[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const files = entries.map((entry) => ({
    ...entry,
    nameBytes: encoder.encode(entry.name),
    crc: crc32(entry.bytes),
  }));
  const dataSize = files.reduce(
    (sum, file) => sum + LOCAL_HEADER_SIZE + file.nameBytes.length + file.bytes.length,
    0,
  );
  const directorySize = files.reduce(
    (sum, file) => sum + CENTRAL_HEADER_SIZE + file.nameBytes.length,
    0,
  );
  const archive = new Uint8Array(dataSize + directorySize + END_RECORD_SIZE);
  const view = new DataView(archive.buffer);

  /**
   * Writes the fields shared by the local and central headers.
   *
   * @param offset - Where the shared fields start.
   * @param file - File being described.
   */
  const writeCommonFields = (offset: number, file: (typeof files)[number]) => {
    view.setUint16(offset, ZIP_VERSION, true);
    view.setUint16(offset + 2, UTF8_FLAG, true);
    view.setUint16(offset + 4, 0, true); // Stored, without compression.
    view.setUint16(offset + 6, 0, true); // Time.
    view.setUint16(offset + 8, FIXED_DOS_DATE, true);
    view.setUint32(offset + 10, file.crc, true);
    view.setUint32(offset + 14, file.bytes.length, true);
    view.setUint32(offset + 18, file.bytes.length, true);
    view.setUint16(offset + 22, file.nameBytes.length, true);
  };

  let offset = 0;
  const localOffsets: number[] = [];
  for (const file of files) {
    localOffsets.push(offset);
    view.setUint32(offset, 0x04034b50, true);
    writeCommonFields(offset + 4, file);
    archive.set(file.nameBytes, offset + LOCAL_HEADER_SIZE);
    archive.set(file.bytes, offset + LOCAL_HEADER_SIZE + file.nameBytes.length);
    offset += LOCAL_HEADER_SIZE + file.nameBytes.length + file.bytes.length;
  }

  const directoryOffset = offset;
  files.forEach((file, index) => {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, ZIP_VERSION, true);
    writeCommonFields(offset + 6, file);
    view.setUint32(offset + 42, localOffsets[index]!, true);
    archive.set(file.nameBytes, offset + CENTRAL_HEADER_SIZE);
    offset += CENTRAL_HEADER_SIZE + file.nameBytes.length;
  });

  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 8, files.length, true);
  view.setUint16(offset + 10, files.length, true);
  view.setUint32(offset + 12, directorySize, true);
  view.setUint32(offset + 16, directoryOffset, true);
  return archive;
}

/**
 * Builds the name of a mission image inside the archive. Characters that
 * Windows forbids in file names are removed; the colon of the mission name
 * is one of them.
 *
 * @param order - Position of the mission.
 * @param name - Full name of the mission.
 * @returns The file name.
 */
export function missionImageName(order: number, name: string): string {
  const safe = name.replace(/[<>:"/\\|?*]/g, '').trim();
  return `${String(order).padStart(2, '0')} - ${safe}.png`;
}
