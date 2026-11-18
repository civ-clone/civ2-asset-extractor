import { ExtractData, Sprite, extractSprites } from '../extractSprites';
import { Sheet, TRANSPARENT_1, TRANSPARENT_2 } from './lib/sheet';
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';

// A synthetic `ICONS.GIF` laid out as the game reads it (OpenCiv2's
// `graphics.cpp`), every cell framed in the first transparent colour on a
// background of the second, independently of `extract-data.json`:
//
// - the improvements' pictures, 36×20 from (343, 1), eight to a row, stepping
//   37 across and 21 down, and the Wonders' from (343, 106), seven to a row;
// - the research meter, four 14×14 cells from (49, 290) stepping 15, and the
//   global warming meter below it from (49, 305);
// - the resource icons, 14×14 from (1, 305), three to a row, and 10×10 from
//   (49, 334), four to a row with the fourth and eighth unused.
//
// Each cell is filled with its own palette index, so a sprite's colour says
// which cell it was cut from.
const extractData: ExtractData = JSON.parse(
    readFileSync(join(__dirname, '..', 'extract-data.json')).toString()
  ),
  definition = extractData.files['ICONS.GIF']!,
  sheet = new Sheet(640, 480),
  layout: {
    [path: string]: [
      x: number,
      y: number,
      width: number,
      height: number,
      columns: number,
      cells: number
    ];
  } = {
    'buildings/': [343, 1, 36, 20, 8, 38],
    'wonders/': [343, 106, 36, 20, 7, 28],
    'icons/research/': [49, 290, 14, 14, 4, 4],
    'icons/warming/': [49, 305, 14, 14, 4, 4],
    'icons/': [1, 305, 14, 14, 3, 6],
    'icons/small/': [49, 334, 10, 10, 4, 8],
  },
  // The palette index each grid's cells start from, one per cell after it.
  firstIndex: { [path: string]: number } = {};

sheet.fill(0, 0, 640, 480, TRANSPARENT_2);

let next = 1;

Object.entries(layout).forEach(
  ([path, [x, y, width, height, columns, cells]]) => {
    firstIndex[path] = next;

    for (let cell = 0; cell < cells; cell++) {
      const left = x + (cell % columns) * (width + 1),
        top = y + Math.floor(cell / columns) * (height + 1);

      sheet.fill(left - 1, top - 1, width + 2, height + 2, TRANSPARENT_1);
      sheet.fill(left, top, width, height, next + cell);
    }

    next += cells;
  }
);

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

  it('cuts the resource icons from their cells, skipping the unused ones', (): void => {
    ['food', 'shield', 'trade', 'luxury', 'gold', 'science'].forEach(
      (name, cell) => {
        expect(colourOf(`icons/${name}`), name).to.deep.equal(
          sheet.colours[firstIndex['icons/']! + cell]
        );
        expect(colourOf(`icons/small/${name}`), `small ${name}`).to.deep.equal(
          sheet.colours[firstIndex['icons/small/']! + cell + (cell > 2 ? 1 : 0)]
        );
      }
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
