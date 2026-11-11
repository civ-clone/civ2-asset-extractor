export type Colour = [r: number, g: number, b: number];

// Civ2 marks transparency and the sprite grid by palette index, so this keeps
// the indices rather than decoding straight to RGB like a browser would.
export class GifImage {
  #height: number;
  #palette: Colour[];
  #pixels: Uint8Array;
  #width: number;

  constructor(
    width: number,
    height: number,
    palette: Colour[],
    pixels: Uint8Array
  ) {
    this.#width = width;
    this.#height = height;
    this.#palette = palette;
    this.#pixels = pixels;
  }

  static fromBytes(bytes: Uint8Array): GifImage {
    const signature = String.fromCharCode(...bytes.subarray(0, 6));

    if (signature !== 'GIF87a' && signature !== 'GIF89a') {
      throw new TypeError(`Not a GIF file (${signature}).`);
    }

    // A half-copied file must fail, not leave the loops below reading
    //  `undefined` for ever.
    const need = (end: number) => {
        if (end > bytes.length) {
          throw new TypeError('Truncated GIF file.');
        }
      },
      readUint16 = (offset: number) => bytes[offset] | (bytes[offset + 1] << 8),
      readPalette = (flags: number) => {
        const size = 2 << (flags & 7),
          palette: Colour[] = [];

        need(offset + size * 3);

        for (let i = 0; i < size; i++) {
          palette.push([
            bytes[offset + i * 3],
            bytes[offset + i * 3 + 1],
            bytes[offset + i * 3 + 2],
          ]);
        }

        offset += size * 3;

        return palette;
      },
      width = (need(13), readUint16(6)),
      height = readUint16(8),
      screenFlags = bytes[10];

    let offset = 13,
      palette: Colour[] = [];

    if (screenFlags & 0x80) {
      palette = readPalette(screenFlags);
    }

    // Skip any extension blocks until the first image descriptor.
    while ((need(offset + 1), bytes[offset]) !== 0x2c) {
      if (bytes[offset] !== 0x21) {
        throw new TypeError(
          `Unexpected GIF block 0x${bytes[offset].toString(16)}.`
        );
      }

      offset += 2;

      while ((need(offset + 1), bytes[offset]) !== 0) {
        offset += bytes[offset] + 1;
      }

      offset++;
    }

    need(offset + 11);

    const imageFlags = bytes[offset + 9];

    offset += 10;

    if (imageFlags & 0x80) {
      palette = readPalette(imageFlags);
    }

    if (imageFlags & 0x40) {
      throw new TypeError('Interlaced GIFs are not supported.');
    }

    const minimumCodeSize = bytes[offset++],
      data: number[] = [];

    while ((need(offset + 1), bytes[offset]) !== 0) {
      need(offset + 1 + bytes[offset]);
      data.push(...bytes.subarray(offset + 1, offset + 1 + bytes[offset]));
      offset += bytes[offset] + 1;
    }

    return new GifImage(
      width,
      height,
      palette,
      GifImage.#decompress(data, minimumCodeSize, width * height)
    );
  }

  static #decompress(
    data: number[],
    minimumCodeSize: number,
    length: number
  ): Uint8Array {
    const pixels = new Uint8Array(length),
      clearCode = 1 << minimumCodeSize,
      endCode = clearCode + 1;

    let bit = 0,
      codeSize = minimumCodeSize + 1,
      dictionary: number[][] = [],
      previous: number[] | null = null,
      written = 0;

    const reset = () => {
        dictionary = [];

        for (let i = 0; i < clearCode; i++) {
          dictionary.push([i]);
        }

        dictionary.push([], []);
        codeSize = minimumCodeSize + 1;
        previous = null;
      },
      read = () => {
        let value = 0;

        for (let i = 0; i < codeSize; i++, bit++) {
          value |= ((data[bit >> 3] >> (bit & 7)) & 1) << i;
        }

        return value;
      };

    reset();

    while (bit < data.length * 8) {
      const code = read();

      if (code === clearCode) {
        reset();

        continue;
      }

      if (code === endCode) {
        break;
      }

      // A code may be the one about to be defined (`previous` plus its own
      //  first value), but never one further on.
      if (
        code > dictionary.length ||
        (previous === null && code >= clearCode)
      ) {
        throw new TypeError('Corrupt GIF image data.');
      }

      const entry: number[] =
        code < dictionary.length
          ? dictionary[code]
          : [...previous!, previous![0]];

      pixels.set(entry.slice(0, length - written), written);
      written += entry.length;

      // Anything after the last pixel is not part of the image.
      if (written >= length) {
        break;
      }

      if (previous !== null && dictionary.length < 4096) {
        dictionary.push([...previous, entry[0]]);

        if (dictionary.length === 1 << codeSize && codeSize < 12) {
          codeSize++;
        }
      }

      previous = entry;
    }

    return pixels;
  }

  colour(index: number): Colour {
    return this.#palette[index];
  }

  height(): number {
    return this.#height;
  }

  index(x: number, y: number): number {
    return this.#pixels[y * this.#width + x];
  }

  palette(): Colour[] {
    return this.#palette;
  }

  width(): number {
    return this.#width;
  }
}

export default GifImage;
