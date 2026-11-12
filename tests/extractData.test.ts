import { ExtractData } from '../extractSprites';
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';

// Every Civ2 sheet is 640×480.
const SHEET_WIDTH = 640,
  SHEET_HEIGHT = 480,
  extractData: ExtractData = JSON.parse(
    readFileSync(join(__dirname, '..', 'extract-data.json')).toString()
  ),
  grids = Object.entries(extractData.files).flatMap(([file, { grids }]) =>
    grids.map((grid) => ({ file, ...grid }))
  );

describe('extract-data.json', (): void => {
  it('describes the four map sheets', (): void => {
    expect(Object.keys(extractData.files)).to.deep.equal([
      'TERRAIN1.GIF',
      'TERRAIN2.GIF',
      'UNITS.GIF',
      'CITIES.GIF',
    ]);
  });

  it('keeps every cell, and its marker border, inside the sheet', (): void => {
    grids.forEach(
      ({ file, path, x, y, width, height, columns, stepX, stepY, names }) => {
        const rows = Math.ceil(names.length / columns),
          right = x + (columns - 1) * (stepX ?? width + 1) + width,
          bottom = y + (rows - 1) * (stepY ?? height + 1) + height;

        expect(x, `${file} ${path}`).to.be.at.least(1);
        expect(y, `${file} ${path}`).to.be.at.least(1);
        expect(right, `${file} ${path}`).to.be.at.most(SHEET_WIDTH);
        expect(bottom, `${file} ${path}`).to.be.at.most(SHEET_HEIGHT);
      }
    );
  });

  it('names every sprite once', (): void => {
    const names = grids.flatMap(({ path, names }) =>
        names.flatMap((name) => (name === null ? [] : [path + name]))
      ),
      duplicates = names.filter((name, i) => names.indexOf(name) !== i);

    expect(duplicates).to.deep.equal([]);
    expect(names).to.have.length(289);
  });

  it('marks the unit grid with the shield marker that `withUnitNames` looks for', (): void => {
    const units = grids.filter(
      ({ markers }) => markers?.['#0000ff'] === 'shield'
    );

    expect(units).to.have.length(1);
    expect(units[0].names).to.have.length(62);
  });

  it('reads nine flags in two rows of player colours', (): void => {
    const flags = extractData.files['CITIES.GIF'].flags!;

    expect(flags.count).to.equal(9);
    expect(flags.rows.map(({ name }) => name)).to.deep.equal([
      'flag',
      'flag-2',
    ]);
  });
});
