import { deflateSync } from 'zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let crc = n;

  for (let k = 0; k < 8; k++) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

const crc32 = (bytes: Buffer): number => {
  let crc = ~0;

  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return ~crc >>> 0;
};

const chunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4),
    body = Buffer.concat([Buffer.from(type, 'ascii'), data]),
    crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, crc]);
};

// Encodes RGBA pixels as a PNG in Node, so extraction doesn't need `canvas`.
export const encodePng = (
  width: number,
  height: number,
  rgba: Uint8ClampedArray
): Buffer => {
  const rowLength = width * 4 + 1,
    raw = Buffer.alloc(rowLength * height),
    header = Buffer.alloc(13);

  for (let y = 0; y < height; y++) {
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(
      raw,
      y * rowLength + 1
    );
  }

  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

export default encodePng;
