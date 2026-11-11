import { Colour } from '../../GifImage';
import encodeGif from './encodeGif';

// A synthetic 256-colour sheet laid out like Civ2's: the last three palette
// entries are "transparent 1, border, transparent 2", and everything starts
// as the first transparent colour.
export const TRANSPARENT_1 = 253;
export const BORDER = 254;
export const TRANSPARENT_2 = 255;

export const palette = (): Colour[] =>
  Array.from({ length: 256 }, (_, i): Colour => {
    switch (i) {
      case TRANSPARENT_1:
        return [255, 0, 255];
      case BORDER:
        return [0, 255, 0];
      case TRANSPARENT_2:
        return [255, 0, 254];
      default:
        return [i, (i * 7) % 256, (i * 13) % 256];
    }
  });

export class Sheet {
  readonly pixels: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly colours: Colour[] = palette()
  ) {
    this.pixels = new Uint8Array(width * height).fill(TRANSPARENT_1);
  }

  set(x: number, y: number, index: number): this {
    this.pixels[y * this.width + x] = index;

    return this;
  }

  fill(x: number, y: number, width: number, height: number, index: number) {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        this.set(x + dx, y + dy, index);
      }
    }

    return this;
  }

  // The 1px border around a cell whose top-left pixel is at (x, y).
  border(x: number, y: number, width: number, height: number) {
    for (let dx = -1; dx <= width; dx++) {
      this.set(x + dx, y - 1, BORDER).set(x + dx, y + height, BORDER);
    }

    for (let dy = -1; dy <= height; dy++) {
      this.set(x - 1, y + dy, BORDER).set(x + width, y + dy, BORDER);
    }

    return this;
  }

  // Finds (or makes) a palette index for `colour`, for marker pixels.
  indexOf(colour: Colour, fallback: number): number {
    const index = this.colours.findIndex(
      ([r, g, b]) => r === colour[0] && g === colour[1] && b === colour[2]
    );

    if (index !== -1) {
      return index;
    }

    this.colours[fallback] = colour;

    return fallback;
  }

  gif(): Uint8Array {
    return encodeGif({
      width: this.width,
      height: this.height,
      palette: this.colours,
      pixels: this.pixels,
    });
  }
}
