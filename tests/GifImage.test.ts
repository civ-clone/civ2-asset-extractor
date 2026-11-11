import { Colour, GifImage } from '../GifImage';
import { expect } from 'chai';
import encodeGif from './lib/encodeGif';

const random = (seed: number) => () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;

    return seed;
  },
  greys = (size: number): Colour[] =>
    Array.from({ length: size }, (_, i): Colour => [i, i, i]),
  pixelsOf = (image: GifImage) =>
    Array.from({ length: image.width() * image.height() }, (_, i) =>
      image.index(i % image.width(), Math.floor(i / image.width()))
    );

describe('GifImage', (): void => {
  it('keeps the palette indices and the palette', (): void => {
    const pixels = [0, 1, 2, 3, 3, 2, 1, 0, 1, 1, 1, 1],
      image = GifImage.fromBytes(
        encodeGif({ width: 4, height: 3, palette: greys(4), pixels })
      );

    expect(image.width()).to.equal(4);
    expect(image.height()).to.equal(3);
    expect(pixelsOf(image)).to.deep.equal(pixels);
    expect(image.palette()).to.deep.equal(greys(4));
    expect(image.colour(3)).to.deep.equal([3, 3, 3]);
  });

  it('decodes a 256-colour image large enough to fill the dictionary', (): void => {
    const next = random(1),
      pixels = Array.from({ length: 200 * 150 }, () => next() % 256),
      image = GifImage.fromBytes(
        encodeGif({ width: 200, height: 150, palette: greys(256), pixels })
      );

    expect(pixelsOf(image)).to.deep.equal(pixels);
  });

  it('keeps decoding when a full dictionary is not cleared', (): void => {
    const next = random(2),
      pixels = Array.from({ length: 120 * 120 }, () => next() % 256),
      image = GifImage.fromBytes(
        encodeGif({
          width: 120,
          height: 120,
          palette: greys(256),
          pixels,
          noClearWhenFull: true,
        })
      );

    expect(pixelsOf(image)).to.deep.equal(pixels);
  });

  it('decodes long runs (codes defined by the code that uses them)', (): void => {
    const pixels = new Array(64 * 64).fill(5),
      image = GifImage.fromBytes(
        encodeGif({ width: 64, height: 64, palette: greys(16), pixels })
      );

    expect(pixelsOf(image)).to.deep.equal(pixels);
  });

  it('skips extension blocks and reads a local palette', (): void => {
    const pixels = [1, 0, 0, 1],
      palette: Colour[] = [
        [10, 20, 30],
        [40, 50, 60],
      ],
      image = GifImage.fromBytes(
        encodeGif({
          width: 2,
          height: 2,
          palette,
          pixels,
          version: 'GIF89a',
          localPalette: true,
          extensions: [
            [0xf9, [0, 0, 0, 0]],
            [0xfe, Array.from('a comment', (c) => c.charCodeAt(0)), [1, 2]],
          ],
        })
      );

    expect(pixelsOf(image)).to.deep.equal(pixels);
    expect(image.colour(1)).to.deep.equal([40, 50, 60]);
  });

  it('ignores data beyond the image', (): void => {
    const image = GifImage.fromBytes(
      encodeGif({
        width: 2,
        height: 2,
        palette: greys(4),
        pixels: [1, 2, 3, 1, 2, 3, 1, 2, 3, 3, 3, 3],
      })
    );

    expect(pixelsOf(image)).to.deep.equal([1, 2, 3, 1]);
  });

  it('refuses a truncated file rather than reading past its end', (): void => {
    const bytes = encodeGif({
      width: 16,
      height: 16,
      palette: greys(4),
      pixels: new Array(256).fill(0).map((_, i) => i % 4),
    });

    [6, 12, 20, 30, bytes.length - 2].forEach((length) =>
      expect(() => GifImage.fromBytes(bytes.subarray(0, length))).to.throw(
        TypeError,
        /Truncated/
      )
    );
  });

  it('refuses image data with a code that is not defined yet', (): void => {
    const bytes = encodeGif({
        width: 2,
        height: 1,
        palette: greys(4),
        pixels: [1, 2],
      }),
      corrupt = Uint8Array.from(bytes);

    // The image data is one 2-byte block: clear (4), 1, 2, end (5) as 3-bit
    // codes. Replace it with clear, 7, end: 7 isn't defined until two more
    // codes have been read.
    expect([...bytes.subarray(-6, -4)]).to.deep.equal([2, 2]);
    corrupt.set([0b01111100, 0b00000001], bytes.length - 4);

    expect(() => GifImage.fromBytes(corrupt)).to.throw(TypeError, /Corrupt/);
  });

  it('names an unexpected block in hexadecimal', (): void => {
    const bytes = encodeGif({
      width: 1,
      height: 1,
      palette: greys(2),
      pixels: [0],
    });

    // Put a trailer (0x3b) where the image descriptor should be.
    const index = bytes.indexOf(0x2c),
      corrupt = Uint8Array.from(bytes);

    corrupt[index] = 0x3b;

    expect(() => GifImage.fromBytes(corrupt)).to.throw(TypeError, /0x3b/);
  });

  it('refuses files that are not GIFs', (): void => {
    expect(() =>
      GifImage.fromBytes(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0]))
    ).to.throw(TypeError, /Not a GIF/);
  });

  it('refuses interlaced images', (): void => {
    expect(() =>
      GifImage.fromBytes(
        encodeGif({
          width: 2,
          height: 2,
          palette: greys(2),
          pixels: [0, 1, 1, 0],
          interlaced: true,
        })
      )
    ).to.throw(TypeError, /Interlaced/);
  });
});
