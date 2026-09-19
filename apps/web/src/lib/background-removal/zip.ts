/**
 * A minimal ZIP writer, for "download all".
 *
 * There is no dependency on purpose: this needs only the "stored" method (no
 * compression), because everything going in is already a PNG, JPG or WebP and
 * deflating those saves next to nothing. That reduces a zip to headers around
 * the raw bytes, which is small enough to write and test here rather than pull
 * in a library for.
 *
 * Limits, all far beyond what this tool produces: no entry over 4 GB, no more
 * than 65,535 entries, no ZIP64.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Blob;
}

/** MS-DOS date and time, which is what the format stores. */
function dosDateTime(date: Date): { time: number; day: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export async function createZip(entries: ZipEntry[], now = new Date()): Promise<Blob> {
  if (entries.length > 0xffff) throw new Error('too many files for a zip');

  const encoder = new TextEncoder();
  const { time, day } = dosDateTime(now);
  const parts: BlobPart[] = [];
  const central: ArrayBuffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    if (entry.data.size > 0xffffffff) throw new Error('file too large for a zip');
    const name = encoder.encode(entry.name);
    // Read once for the checksum, then let the Blob itself go into the archive
    // so the bytes are not held twice.
    const crc = crc32(new Uint8Array(await entry.data.arrayBuffer()));
    const size = entry.data.size;

    const local = new DataView(new ArrayBuffer(30 + name.length));
    local.setUint32(0, 0x04034b50, true);   // local file header
    local.setUint16(4, 20, true);           // version needed
    local.setUint16(6, 0x0800, true);       // flags: names are UTF-8
    local.setUint16(8, 0, true);            // method: stored
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);        // compressed size
    local.setUint32(22, size, true);        // uncompressed size
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);           // extra length
    new Uint8Array(local.buffer).set(name, 30);

    const header = new DataView(new ArrayBuffer(46 + name.length));
    header.setUint32(0, 0x02014b50, true);  // central directory header
    header.setUint16(4, 20, true);          // version made by
    header.setUint16(6, 20, true);          // version needed
    header.setUint16(8, 0x0800, true);
    header.setUint16(10, 0, true);
    header.setUint16(12, time, true);
    header.setUint16(14, day, true);
    header.setUint32(16, crc, true);
    header.setUint32(20, size, true);
    header.setUint32(24, size, true);
    header.setUint16(28, name.length, true);
    // extra, comment, disk, internal and external attributes stay zero
    header.setUint32(42, offset, true);     // where the local header starts
    new Uint8Array(header.buffer).set(name, 46);

    parts.push(local.buffer, entry.data);
    central.push(header.buffer);
    offset += local.byteLength + size;
  }

  const centralSize = central.reduce((sum, part) => sum + part.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);       // end of central directory
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}
