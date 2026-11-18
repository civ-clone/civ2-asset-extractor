import { ExtractData, Sprite, extractSprites } from '../extractSprites';
import { Sheet, TRANSPARENT_1, TRANSPARENT_2 } from './lib/sheet';
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';

// A synthetic `ICONS.GIF` laid out as the game reads it, every cell framed in
// the first transparent colour on a background of the second:
//
// - the improvements' pictures, 36×20 from (343, 1), eight to a row, and the
//   Wonders' below them from (343, 106), seven to a row;
// - the research and global warming meters, two rows of four 14×14 cells from
//   (49, 290);
// - the resource icons, 14×14 from (1, 305), and 10×10 from (49, 334).
//
// Each cell is filled with its own palette index, so a sprite's colour says
// which cell it was cut from.
const extractData: ExtractData = JSON.parse(
    readFileSync(join(__dirname, '..', 'extract-data.json')).toString()
  ),
  definition = extractData.files['ICONS.GIF']!,
  sheet = new Sheet(640, 480);

sheet.fill(0, 0, 640, 480, TRANSPARENT_2);

// The palette index each grid's cells start from, one per cell after it.
const firstIndex: { [path: string]: number } = {};
let next = 1;

definition.grids.forEach(({ path, x, y, width, height, columns, names }) => {
  firstIndex[path] = next;

  names.forEach((name, cell) => {
    const left = x + (cell % columns) * (width + 1),
      top = y + Math.floor(cell / columns) * (height + 1);

    sheet.fill(left - 1, top - 1, width + 2, height + 2, TRANSPARENT_1);
    sheet.fill(left, top, width, height, next + cell);
  });

  next += names.length;
});

describe('ICONS.GIF', (): void => {
  const { sprites } = extractSprites(sheet.gif(), definition),
    sprite = (name: string): Sprite => {
      const found = sprites.find((sprite) => sprite.name === name) as Sprite;

      expect(found, name).to.not.equal(undefined);

      return found;
    },
    colourOf = (name: string) => Array.from(sprite(name).data.subarray(0, 3));

  it('cuts each improvement and Wonder from its own cell', (): void => {
    ['buildings/', 'wonders/'].forEach((path) => {
      const { names } = definition.grids.find((grid) => grid.path === path)!;

      names.forEach((name, cell) =>
        expect(colourOf(path + name!), path + name).to.deep.equal(
          sheet.colours[firstIndex[path]! + cell]
        )
      );
    });

    expect(colourOf('buildings/palace')).to.deep.equal(
      sheet.colours[firstIndex['buildings/']!]
    );
    expect(colourOf('wonders/cure-for-cancer')).to.deep.equal(
      sheet.colours[firstIndex['wonders/']! + 27]
    );
  });

  it('cuts the meters in order, research above global warming', (): void => {
    ['research', 'warming'].forEach((meter) =>
      [0, 1, 2, 3].forEach((stage) =>
        expect(
          colourOf(`icons/${meter}/${stage}`),
          `${meter} ${stage}`
        ).to.deep.equal(sheet.colours[firstIndex[`icons/${meter}/`]! + stage])
      )
    );
  });

  it('cuts whole cells, at their sizes, and nothing of the frame', (): void => {
    sprites.forEach(({ name, width, height, data }) => {
      const size = name.startsWith('icons/small/')
        ? [10, 10]
        : name.startsWith('icons/')
        ? [14, 14]
        : [36, 20];

      expect([width, height], name).to.deep.equal(size);

      for (let i = 0; i < data.length; i += 4) {
        expect(data[i + 3], name).to.equal(255);
      }
    });
  });
});
