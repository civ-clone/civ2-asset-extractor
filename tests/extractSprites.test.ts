import { GridDefinition, extractGrid, extractSprites } from '../extractSprites';
import { BORDER, Sheet, TRANSPARENT_2, palette } from './lib/sheet';
import { GifImage } from '../GifImage';
import { expect } from 'chai';

const BLUE = '#0000ff',
  ORANGE = '#ff9b00',
  pixel = (
    sprite: { width: number; data: Uint8ClampedArray },
    x: number,
    y: number
  ) => Array.from(sprite.data.subarray((y * sprite.width + x) * 4).slice(0, 4));

// Two 4×3 cells side by side at (1, 1) and (6, 1), each inside a 1px border.
const twoCells = () => {
  const sheet = new Sheet(12, 6);

  sheet.border(1, 1, 4, 3).border(6, 1, 4, 3);
  sheet.fill(1, 1, 4, 3, 10).fill(6, 1, 4, 3, 20);

  return sheet;
};

describe('extractGrid', (): void => {
  const grid: GridDefinition = {
    path: 'units/',
    x: 1,
    y: 1,
    width: 4,
    height: 3,
    columns: 2,
    names: ['first', 'second'],
  };

  it('cuts each named cell out of the sheet, stepping over the border', (): void => {
    const sheet = twoCells(),
      [first, second] = extractGrid(GifImage.fromBytes(sheet.gif()), grid);

    expect(first.name).to.equal('units/first');
    expect(second.name).to.equal('units/second');
    expect([first.width, first.height]).to.deep.equal([4, 3]);
    expect(pixel(first, 0, 0)).to.deep.equal([...sheet.colours[10], 255]);
    expect(pixel(second, 3, 2)).to.deep.equal([...sheet.colours[20], 255]);
  });

  it('skips cells named null', (): void => {
    const sprites = extractGrid(GifImage.fromBytes(twoCells().gif()), {
      ...grid,
      names: [null, 'second'],
    });

    expect(sprites.map(({ name }) => name)).to.deep.equal(['units/second']);
  });

  it('makes both transparent colours and the border colour transparent', (): void => {
    const sheet = twoCells()
        .set(1, 1, TRANSPARENT_2)
        .set(2, 1, BORDER)
        .set(3, 1, 253),
      [first] = extractGrid(GifImage.fromBytes(sheet.gif()), grid);

    expect(pixel(first, 0, 0)).to.deep.equal([0, 0, 0, 0]);
    expect(pixel(first, 1, 0)).to.deep.equal([0, 0, 0, 0]);
    expect(pixel(first, 2, 0)).to.deep.equal([0, 0, 0, 0]);
    expect(pixel(first, 3, 0)[3]).to.equal(255);
  });

  it('knocks out the colours in `clear`', (): void => {
    const sheet = twoCells(),
      label = sheet.indexOf([255, 255, 255], 100);

    sheet.set(2, 2, label);

    const [first] = extractGrid(GifImage.fromBytes(sheet.gif()), {
      ...grid,
      clear: ['#FFFFFF'],
    });

    expect(pixel(first, 1, 1)).to.deep.equal([0, 0, 0, 0]);
    expect(pixel(first, 0, 1)[3]).to.equal(255);
  });

  it('reads anchors from marker pixels on the top and left borders', (): void => {
    const sheet = twoCells(),
      blue = sheet.indexOf([0, 0, 255], 101),
      orange = sheet.indexOf([255, 155, 0], 102);

    // The first cell: flag at (2, 1), size at (0, 2).
    sheet.set(1 + 2, 0, blue).set(0, 1 + 1, blue);
    sheet.set(1 + 0, 0, orange).set(0, 1 + 2, orange);
    // The second cell: flag at (3, 0) and no size marker.
    sheet.set(6 + 3, 0, blue).set(5, 1 + 0, blue);

    const [first, second] = extractGrid(GifImage.fromBytes(sheet.gif()), {
      ...grid,
      markers: { [BLUE]: 'flag', [ORANGE.toUpperCase()]: 'size' },
    });

    expect(first.anchors).to.deep.equal({
      flag: { x: 2, y: 1 },
      size: { x: 0, y: 2 },
    });
    expect(second.anchors).to.deep.equal({ flag: { x: 3, y: 0 } });
  });

  it('refuses a grid that runs off the sheet', (): void => {
    expect(() =>
      extractGrid(GifImage.fromBytes(twoCells().gif()), {
        ...grid,
        columns: 3,
        names: ['a', 'b', 'c'],
      })
    ).to.throw(TypeError, /don't fit a 12×6 sheet/);
  });

  it('refuses a sheet without a 256-colour palette', (): void => {
    const sheet = new Sheet(12, 6, palette().slice(0, 128));

    sheet.pixels.fill(0);

    expect(() => extractGrid(GifImage.fromBytes(sheet.gif()), grid)).to.throw(
      TypeError,
      /256-colour/
    );
  });

  it('leaves `anchors` off sprites from grids without markers', (): void => {
    const [first] = extractGrid(GifImage.fromBytes(twoCells().gif()), grid);

    expect(first).not.to.have.property('anchors');
  });

  it('honours a step that differs from the size plus the border', (): void => {
    const sheet = new Sheet(12, 4);

    sheet.fill(1, 1, 2, 2, 30).fill(8, 1, 2, 2, 40);

    const [, second] = extractGrid(GifImage.fromBytes(sheet.gif()), {
      path: '',
      x: 1,
      y: 1,
      width: 2,
      height: 2,
      columns: 2,
      stepX: 7,
      names: ['a', 'b'],
    });

    expect(pixel(second, 0, 0)).to.deep.equal([...sheet.colours[40], 255]);
  });
});

describe('extractSprites', (): void => {
  it('reads the two player colours from each flag, ignoring what every flag shares', (): void => {
    const sheet = new Sheet(20, 8),
      pole = 1,
      outline = 2;

    // Three 5×6 flags at x = 1, 7 and 13: a pole column and outline row on
    // each, the rest split between the flag's two colours (more of the first).
    [
      [50, 51],
      [60, 61],
      [70, 50],
    ].forEach(([primary, secondary], flag) => {
      const x = 1 + flag * 6;

      sheet.fill(x, 1, 1, 6, pole).fill(x + 1, 1, 4, 1, outline);
      sheet.fill(x + 1, 2, 4, 3, primary).fill(x + 1, 5, 4, 2, secondary);
    });

    const { colours, sprites } = extractSprites(
      sheet.gif(),
      {
        grids: [],
        flags: {
          x: 1,
          width: 5,
          height: 6,
          count: 3,
          rows: [{ name: 'flag', y: 1 }],
        },
      },
      () => undefined
    );

    expect(sprites).to.deep.equal([]);
    expect(colours).to.deep.equal({
      flag: [
        { primary: sheet.colours[50], secondary: sheet.colours[51] },
        { primary: sheet.colours[60], secondary: sheet.colours[61] },
        { primary: sheet.colours[70], secondary: sheet.colours[50] },
      ],
    });
  });

  it('logs each grid it processes', (): void => {
    const messages: string[] = [];

    extractSprites(
      twoCells().gif(),
      {
        grids: [
          {
            path: 'units/',
            x: 1,
            y: 1,
            width: 4,
            height: 3,
            columns: 2,
            names: ['a', 'b'],
          },
        ],
      },
      (message) => messages.push(message)
    );

    expect(messages).to.deep.equal(['Processing units/...']);
  });
});
