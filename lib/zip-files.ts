// Portable ZIP writer (stored entries, UTF-8 names); no network dependency.
export function zipFiles(parts: Record<string, string | Uint8Array>): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const crcTable = Array.from({ length: 256 }, (_, index) => { let crc = index; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; return crc >>> 0; });
  const files = Object.entries(parts).map(([path, content]) => {
    const name = encoder.encode(path), data = typeof content === "string" ? encoder.encode(content) : content;
    let crc = 0xffffffff; for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return { name, data, crc: (crc ^ 0xffffffff) >>> 0, offset: 0 };
  });
  const localSize = files.reduce((sum, file) => sum + 30 + file.name.length + file.data.length, 0);
  const centralSize = files.reduce((sum, file) => sum + 46 + file.name.length, 0);
  const result = new Uint8Array(localSize + centralSize + 22), view = new DataView(result.buffer);
  let offset = 0;
  for (const file of files) {
    file.offset = offset; view.setUint32(offset, 0x04034b50, true); view.setUint16(offset + 4, 20, true); view.setUint16(offset + 6, 0x800, true); view.setUint16(offset + 12, 0x21, true);
    view.setUint32(offset + 14, file.crc, true); view.setUint32(offset + 18, file.data.length, true); view.setUint32(offset + 22, file.data.length, true); view.setUint16(offset + 26, file.name.length, true);
    result.set(file.name, offset + 30); result.set(file.data, offset + 30 + file.name.length); offset += 30 + file.name.length + file.data.length;
  }
  for (const file of files) {
    view.setUint32(offset, 0x02014b50, true); view.setUint16(offset + 4, 20, true); view.setUint16(offset + 6, 20, true); view.setUint16(offset + 8, 0x800, true); view.setUint16(offset + 14, 0x21, true);
    view.setUint32(offset + 16, file.crc, true); view.setUint32(offset + 20, file.data.length, true); view.setUint32(offset + 24, file.data.length, true); view.setUint16(offset + 28, file.name.length, true); view.setUint32(offset + 42, file.offset, true);
    result.set(file.name, offset + 46); offset += 46 + file.name.length;
  }
  view.setUint32(offset, 0x06054b50, true); view.setUint16(offset + 8, files.length, true); view.setUint16(offset + 10, files.length, true); view.setUint32(offset + 12, centralSize, true); view.setUint32(offset + 16, localSize, true);
  return result;
}

