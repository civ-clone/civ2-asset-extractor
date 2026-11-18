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
  it('describes the four map sheets, the icons and the people', (): void => {
    expect(Object.keys(extractData.files)).to.deep.equal([
      'TERRAIN1.GIF',
      'TERRAIN2.GIF',
      'UNITS.GIF',
      'CITIES.GIF',
      'ICONS.GIF',
      'PEOPLE.GIF',
    ]);
  });

  it('needs only the map sheets', (): void => {
    expect(
      Object.entries(extractData.files)
        .filter(([, { optional }]) => optional)
        .map(([file]) => file)
    ).to.deep.equal(['ICONS.GIF', 'PEOPLE.GIF']);
  });

  it('cuts each resource icon in both sizes', (): void => {
    const icons = grids
        .filter(
          ({ file, path }) =>
            file === 'ICONS.GIF' && ['icons/', 'icons/small/'].includes(path)
        )
        .flatMap(({ path, names }) =>
          names.flatMap((name) => (name === null ? [] : [path + name]))
        ),
      resources = ['food', 'shield', 'trade', 'luxury', 'gold', 'science'];

    expect(icons).to.have.members([
      ...resources.map((name) => `icons/${name}`),
      ...resources.map((name) => `icons/small/${name}`),
    ]);
  });

  it('cuts the research and global warming meters, four stages each', (): void => {
    expect(
      grids
        .filter(({ path }) =>
          ['icons/research/', 'icons/warming/'].includes(path)
        )
        .map(({ file, path, width, height, names }) => [
          file,
          path,
          width,
          height,
          names,
        ])
    ).to.deep.equal([
      ['ICONS.GIF', 'icons/research/', 14, 14, ['0', '1', '2', '3']],
      ['ICONS.GIF', 'icons/warming/', 14, 14, ['0', '1', '2', '3']],
    ]);
  });

  // In RULES.TXT's order, as `toSlug` names them: the improvements after
  //  "Nothing", then the Wonders.
  it('cuts every improvement and Wonder picture from ICONS.GIF', (): void => {
    const pictures = (path: string) =>
      grids
        .filter((grid) => grid.path === path)
        .map(({ file, width, height, names }) => ({
          file,
          width,
          height,
          names: names.length,
          first: names[0],
          last: names[names.length - 1],
        }));

    expect(pictures('buildings/')).to.deep.equal([
      {
        file: 'ICONS.GIF',
        width: 36,
        height: 20,
        names: 38,
        first: 'palace',
        last: 'capitalization',
      },
    ]);
    expect(pictures('wonders/')).to.deep.equal([
      {
        file: 'ICONS.GIF',
        width: 36,
        height: 20,
        names: 28,
        first: 'pyramids',
        last: 'cure-for-cancer',
      },
    ]);
  });

  it('cuts every citizen and specialist for each era, and the small ones', (): void => {
    const people = grids
        .filter(({ file }) => file === 'PEOPLE.GIF')
        .flatMap(({ path, names }) =>
          names.flatMap((name) => (name === null ? [] : [path + name]))
        ),
      citizens = [
        ...['happy', 'content', 'unhappy', 'angry'].flatMap((mood) => [
          `${mood}-male`,
          `${mood}-female`,
        ]),
        'entertainer',
        'tax-collector',
        'scientist',
      ];

    expect(people).to.have.members([
      ...['ancient', 'renaissance', 'industrial', 'modern'].flatMap((era) =>
        citizens.map((citizen) => `people/${era}/${citizen}`)
      ),
      ...citizens.map((citizen) => `people/small/${citizen}`),
    ]);
  });

  it('cuts each city style, walled and not, at every size', (): void => {
    const cities = grids
      .filter(({ file, path }) => file === 'CITIES.GIF' && path === 'city/')
      .flatMap(({ names }) =>
        names.filter((name) => name !== null && !name.startsWith('flag'))
      );

    expect(cities).to.have.members(
      [
        'stone-bronze',
        'ancient-classical',
        'far-east',
        'medieval',
        'early-industrial',
        'modern',
        'modern-alt',
      ].flatMap((style) =>
        [0, 1, 2, 3].flatMap((size) => [
          `${style}/${size}`,
          `${style}/walled-${size}`,
        ])
      )
    );
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
    expect(names).to.have.length(430);
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
