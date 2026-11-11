import {
  ExtractData,
  ExtractResult,
  Sprite,
  extractSprites,
} from '../extractSprites';
import { existsSync, readFileSync } from 'fs';
import { expect } from 'chai';
import { join } from 'path';
import { GifImage } from '../GifImage';
import { withUnitNames } from '../rules';

// Runs against a real copy of Civilization II (Multiplayer Gold Edition 1.3)
// when `CIV2_PATH` points at its directory. Civ2's files are copyrighted, so
// they are never in this repository and CI skips this.
const source = process.env.CIV2_PATH;

(source ? describe : describe.skip)('a real copy of Civ2', (): void => {
  let extractData: ExtractData,
    rules = '',
    results: { [file: string]: ExtractResult } = {},
    sprites: Sprite[] = [];

  before((): void => {
    const rulesPath = join(source!, 'RULES.TXT');

    extractData = JSON.parse(
      readFileSync(join(__dirname, '..', 'extract-data.json')).toString()
    );

    rules = existsSync(rulesPath) ? readFileSync(rulesPath, 'latin1') : '';
    results = Object.fromEntries(
      Object.entries(extractData.files).map(([file, definition]) => [
        file,
        extractSprites(
          readFileSync(join(source!, file)),
          withUnitNames(definition, rules),
          () => undefined
        ),
      ])
    );
    sprites = Object.values(results).flatMap(({ sprites }) => sprites);
  });

  it('extracts every sprite, each with something drawn in it', (): void => {
    expect(sprites).to.have.length(287);

    const empty = sprites
      .filter(({ data }) => !data.some((value, i) => i % 4 === 3 && value > 0))
      .map(({ name }) => name);

    expect(empty).to.deep.equal([]);
  });

  // A grid that is a pixel out still extracts something, so check the layout
  // itself: the line just left of and just above every cell is a frame, nearly
  // all one opaque colour apart from any marker pixels. That is the sheet's
  // green border, or farmland's cyan outline. (A road from the cell before can
  // spill a pixel or two over the border.)
  it('lines every cell up inside its frame', (): void => {
    const misplaced: string[] = [];

    Object.entries(extractData.files).forEach(([file, { grids }]) => {
      const image = GifImage.fromBytes(readFileSync(join(source!, file))),
        size = image.palette().length,
        transparent = [size - 3, size - 1];

      grids.forEach((grid) => {
        const stepX = grid.stepX ?? grid.width + 1,
          stepY = grid.stepY ?? grid.height + 1,
          markers = Object.keys(grid.markers ?? {}).map((hex) =>
            hex.toLowerCase()
          ),
          isFrame = (indices: number[]) => {
            const counts = new Map<number, number>(),
              unmarked = indices.filter(
                (index) =>
                  !markers.includes(
                    '#' +
                      image
                        .colour(index)
                        .map((value) => value.toString(16).padStart(2, '0'))
                        .join('')
                  )
              );

            unmarked.forEach((index) =>
              counts.set(index, (counts.get(index) ?? 0) + 1)
            );

            const [colour, count] = [...counts.entries()].sort(
              ([, a], [, b]) => b - a
            )[0];

            return (
              !transparent.includes(colour) && count >= unmarked.length * 0.9
            );
          };

        grid.names.forEach((name, cell) => {
          if (name === null) {
            return;
          }

          const x = grid.x + (cell % grid.columns) * stepX,
            y = grid.y + Math.floor(cell / grid.columns) * stepY,
            left = Array.from({ length: grid.height }, (_, dy) =>
              image.index(x - 1, y + dy)
            ),
            top = Array.from({ length: grid.width }, (_, dx) =>
              image.index(x + dx, y - 1)
            );

          if (!isFrame(left) || !isFrame(top)) {
            misplaced.push(`${file} ${grid.path}${name}`);
          }
        });
      });
    });

    expect(misplaced).to.deep.equal([]);
  });

  it('finds a shield anchor on every unit, inside the cell', (): void => {
    const units = sprites.filter(
      ({ name, width }) => name.startsWith('units/') && width === 64
    );

    expect(units).to.have.length(62);
    units.forEach(({ name, anchors, width, height }) => {
      expect(anchors?.shield, name).to.not.equal(undefined);
      expect(anchors!.shield.x, name).to.be.within(0, width - 1);
      expect(anchors!.shield.y, name).to.be.within(0, height - 1);
    });
  });

  it('finds the flag and size anchors on every city', (): void => {
    sprites
      .filter(({ name }) => name.startsWith('city/'))
      .forEach(({ name, anchors }) => {
        expect(Object.keys(anchors ?? {}).sort(), name).to.deep.equal([
          'flag',
          'size',
        ]);
      });
  });

  it('reads nine distinct player colours from the flags', (): void => {
    const colours = results['CITIES.GIF'].colours!;

    expect(colours.flag).to.have.length(9);
    expect(
      new Set(colours.flag.map(({ primary }) => primary.join())).size
    ).to.equal(9);
  });

  it('names the units from RULES.TXT', function (): void {
    if (rules === '') {
      this.skip();
    }

    expect(sprites.map(({ name }) => name)).to.include('units/settlers');
  });
});
