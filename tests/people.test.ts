import { ExtractData, Sprite, extractSprites } from '../extractSprites';
import { Sheet } from './lib/sheet';
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';

// A synthetic `PEOPLE.GIF` laid out as the game reads it: four eras of eleven
// 27×30 faces from (2, 6), then eleven 15×26 small citizens from (2, 137),
// each inside a 1px frame. Every cell is filled with its own palette index, so
// a sprite's colour says which cell it was cut from.
const extractData: ExtractData = JSON.parse(
    readFileSync(join(__dirname, '..', 'extract-data.json')).toString()
  ),
  FRAME = 192,
  faceIndex = (row: number, column: number) => 1 + row * 11 + column,
  smallIndex = (column: number) => 100 + column,
  sheet = new Sheet(640, 480);

for (let row = 0; row < 4; row++) {
  for (let column = 0; column < 11; column++) {
    const x = 2 + column * 28,
      y = 6 + row * 31;

    sheet.fill(x - 1, y - 1, 29, 32, FRAME);
    sheet.fill(x, y, 27, 30, faceIndex(row, column));
  }
}

for (let column = 0; column < 11; column++) {
  const x = 2 + column * 16;

  sheet.fill(x - 1, 136, 17, 28, FRAME);
  sheet.fill(x, 137, 15, 26, smallIndex(column));
}

describe('PEOPLE.GIF', (): void => {
  const { sprites } = extractSprites(
      sheet.gif(),
      extractData.files['PEOPLE.GIF']
    ),
    colourOf = (name: string) => {
      const sprite = sprites.find((sprite) => sprite.name === name) as Sprite;

      expect(sprite, name).to.not.equal(undefined);

      return Array.from(sprite.data.subarray(0, 3));
    },
    // The game's order: happy, content, unhappy and angry, each a man then a
    //  woman, then the entertainer, tax collector and scientist.
    columns = [
      'happy-male',
      'happy-female',
      'content-male',
      'content-female',
      'unhappy-male',
      'unhappy-female',
      'angry-male',
      'angry-female',
      'entertainer',
      'tax-collector',
      'scientist',
    ];

  it('cuts each era from its own row, each citizen from its column', (): void => {
    ['ancient', 'renaissance', 'industrial', 'modern'].forEach((era, row) =>
      columns.forEach((citizen, column) =>
        expect(
          colourOf(`people/${era}/${citizen}`),
          `${era} ${citizen}`
        ).to.deep.equal(sheet.colours[faceIndex(row, column)])
      )
    );
  });

  it('cuts the small citizens in the same order', (): void => {
    columns.forEach((citizen, column) =>
      expect(colourOf(`people/small/${citizen}`), citizen).to.deep.equal(
        sheet.colours[smallIndex(column)]
      )
    );
  });

  it('cuts whole cells and nothing of the frame', (): void => {
    sprites.forEach(({ name, width, height, data }) => {
      const small = name.startsWith('people/small/');

      expect([width, height], name).to.deep.equal(small ? [15, 26] : [27, 30]);

      for (let i = 0; i < data.length; i += 4) {
        expect(data[i + 3], name).to.equal(255);
        expect(Array.from(data.subarray(i, i + 3)), name).to.not.deep.equal(
          sheet.colours[FRAME]
        );
      }
    });
  });
});
