import {
  UnitFlag,
  cosmicLimits,
  isAdvanceAvailable,
  isUnitAvailable,
  parseBits,
  parseInteger,
  readCivilize,
  readCosmic,
  readDifficulty,
  readEndWonder,
  readGovernments,
  readImprovements,
  readLeaders,
  readTerrain,
  readUnits,
} from '../rules';
import { expect } from 'chai';

// Every section here is made up: RULES.TXT's layout, with invented names,
//  abbreviations and values.
const file = (...lines: string[]): string => lines.join('\r\n');

describe('parseInteger', (): void => {
  it('reads a leading number and ignores what follows, as atoi does', (): void => {
    expect(parseInteger('7')).to.equal(7);
    expect(parseInteger(' -3')).to.equal(-3);
    expect(parseInteger('2.')).to.equal(2);
    expect(parseInteger('5q')).to.equal(5);
    expect(parseInteger('0a')).to.equal(0);
    expect(parseInteger('')).to.equal(0);
    expect(parseInteger('zz')).to.equal(0);
  });

  it('reads the 0x, 0b and 0d prefixes', (): void => {
    expect(parseInteger('0x1F')).to.equal(31);
    expect(parseInteger('0b101')).to.equal(5);
    expect(parseInteger('0d12')).to.equal(12);
    expect(parseInteger('0d')).to.equal(0);
    expect(parseInteger('0d0x10')).to.equal(0);
  });
});

describe('parseBits', (): void => {
  it('reads most significant bit first, up to the first other character', (): void => {
    expect(parseBits('000')).to.equal(0);
    expect(parseBits('110')).to.equal(6);
    expect(parseBits('101x11')).to.equal(5);
    expect(parseBits('')).to.equal(0);
  });
});

describe('readCosmic', (): void => {
  const values = [
      4, 3, 1, 7, 6, 2, 1, 5, 12, 9, 15, 8, 30, 2, 2, 6, 99, 25, 40, 7, 1, 3,
    ],
    rules = file(
      '; a made-up cosmic section',
      '@cosmic',
      ...values.map((value) => `${value}     ; note ${value}`),
      '',
      '@CIVILIZE'
    );

  it('reads one value per line in the loader order', (): void => {
    const { raw } = readCosmic(rules);

    expect(Object.values(raw)).to.deep.equal(values);
    expect(raw.roadMoveMultiplier).to.equal(4);
    expect(raw.fundamentalismMaxScience).to.equal(3);
  });

  it('clamps the effective values and rounds odd food box rows up', (): void => {
    const { raw, effective } = readCosmic(rules);

    expect(effective.foodBoxRows).to.equal(8);
    expect(effective.communismPalaceDistance).to.equal(20);
    expect(effective.massThrustParadigm).to.equal(25);
    expect(effective.shieldBoxRows).to.equal(6);
    (Object.keys(raw) as (keyof typeof raw)[])
      .filter(
        (key) =>
          ![
            'foodBoxRows',
            'communismPalaceDistance',
            'massThrustParadigm',
          ].includes(key)
      )
      .forEach((key) => expect(effective[key], key).to.equal(raw[key]));
  });

  it('reads missing lines as 0, and clamps them', (): void => {
    const { raw, effective } = readCosmic(file('@COSMIC', '2', '3'));

    expect(raw.foodPerCitizen).to.equal(0);
    expect(effective.foodBoxRows).to.equal(cosmicLimits.foodBoxRows[0]);
    expect(effective.roadMoveMultiplier).to.equal(2);
  });
});

describe('readCivilize', (): void => {
  const rules = file(
    '@CIVILIZE',
    'Stone Lore,      3, 1,  nil, nil, 0, 2    ; StL',
    'Kite Making,     5,-2,  StL, nil, 1, 0    ; Kit',
    'Cloud Reading,   2, 0,  Kit, StL, 3, 4',
    'Spare Idea,      1, 0,  no,  no,  0, 0    ; S1',
    '; comment line: the game stops here',
    'Lost Idea,       1, 0,  nil, nil, 0, 0'
  );

  it('reads every row up to a comment line, with its fields', (): void => {
    const advances = readCivilize(rules);

    expect(advances.map(({ name }) => name)).to.deep.equal([
      'Stone Lore',
      'Kite Making',
      'Cloud Reading',
      'Spare Idea',
    ]);
    expect(advances[1]).to.deep.equal({
      name: 'Kite Making',
      aiValue: 5,
      civilizedModifier: -2,
      prerequisites: ['StL', 'nil'],
      epoch: 1,
      category: 0,
      comment: 'Kit',
    });
    expect(advances[2]!.comment).to.equal(null);
  });

  it('marks an advance whose first prerequisite is `no` as never available', (): void => {
    expect(readCivilize(rules).map(isAdvanceAvailable)).to.deep.equal([
      true,
      true,
      true,
      false,
    ]);
  });

  it('stops at a blank line', (): void => {
    expect(
      readCivilize(file('@CIVILIZE', 'Aa, 1, 1, nil, nil, 0, 0', '', 'Bb'))
    ).to.have.length(1);
  });
});

describe('readImprovements and readEndWonder', (): void => {
  const rules = file(
    '@IMPROVE',
    'Nothing Much,        1,  0,    nil,',
    'Hut Circle,          6,  1,    StL,',
    'Big Kite,            25, 0,    Kit,',
    '',
    '; the wonders expire',
    '@ENDWONDER',
    'Cld,        ; Big Kite',
    'nil,',
    ''
  );

  it('reads cost, upkeep and prerequisite, ignoring the trailing comma', (): void => {
    expect(readImprovements(rules)).to.deep.equal([
      { name: 'Nothing Much', cost: 1, upkeep: 0, prerequisite: 'nil' },
      { name: 'Hut Circle', cost: 6, upkeep: 1, prerequisite: 'StL' },
      { name: 'Big Kite', cost: 25, upkeep: 0, prerequisite: 'Kit' },
    ]);
  });

  it('reads each expiry and its comment', (): void => {
    expect(readEndWonder(rules)).to.deep.equal([
      { expiresWith: 'Cld', comment: 'Big Kite' },
      { expiresWith: 'nil', comment: null },
    ]);
  });

  it('reads at most the 67 improvements and 28 wonders', (): void => {
    const many = (header: string, line: string) =>
      file(header, ...Array.from({ length: 80 }, () => line));

    expect(readImprovements(many('@IMPROVE', 'X, 1, 0, nil,'))).to.have.length(
      67
    );
    expect(readEndWonder(many('@ENDWONDER', 'nil,'))).to.have.length(28);
  });
});

describe('readUnits', (): void => {
  const rules = file(
    '@UNITS',
    'Pebble Thrower, Kit, 0,  1.,0,  2a,1d,  1h,1f,  3,0,  0, StL, 000000000000000',
    'Sky Barge,      nil, 1, 10.,2,  4a,2d,  2h,2f, 12,3,  4, Cld, 000000010010001 ; a note',
    'Mud Wader,      nil, 2,  3.,0,  0a,1d,  1h,1f,  2,0,  1, no,  10',
    '; comment line: the game stops here',
    'Lost Unit,      nil, 0,  1.,0,  1a,1d,  1h,1f,  1,0,  0, nil, 0'
  );

  it('reads every field, ignoring the letters after the numbers', (): void => {
    const units = readUnits(rules);

    expect(units).to.have.length(3);
    expect(units[1]).to.deep.equal({
      name: 'Sky Barge',
      obsoleteBy: 'nil',
      domain: 1,
      move: 10,
      range: 2,
      attack: 4,
      defence: 2,
      hitPoints: 2,
      firepower: 2,
      cost: 12,
      hold: 3,
      role: 4,
      prerequisite: 'Cld',
      flags: UnitFlag.CarriesAir | UnitFlag.AttacksAir | UnitFlag.SeesTwoSpaces,
    });
  });

  it('reads a short bit string from its last character', (): void => {
    expect(readUnits(rules)[2]!.flags).to.equal(UnitFlag.IgnoresZonesOfControl);
  });

  it('marks a unit whose prerequisite is `no` as never available', (): void => {
    expect(readUnits(rules).map(isUnitAvailable)).to.deep.equal([
      true,
      true,
      false,
    ]);
  });
});

describe('readTerrain', (): void => {
  const base = (name: string, i: number) =>
      `${name}, ${1 + (i % 3)},${2 + (i % 2)},  ${i % 4},${i % 3},${
        i % 2
      },   yes, 1, ${i}, ${i % 7},   No, 0,${i + 1},  0,  Ab${i},   ; T${i}`,
    special = (name: string, i: number) =>
      `${name}, 2,3,  ${i % 5},${i % 4},${i % 3},`,
    rows = [
      ...Array.from({ length: 11 }, (_, i) => base(`Land ${i}`, i)),
      ...Array.from({ length: 11 }, (_, i) => special(`First ${i}`, i)),
      ...Array.from({ length: 11 }, (_, i) => special(`Second ${i}`, i)),
    ],
    rules = file('@TERRAIN', ...rows, '', '', '@GOVERNMENTS');

  it('reads the 33 rows: 11 terrains, then a first and a second special for each', (): void => {
    const terrain = readTerrain(rules);

    expect(terrain).to.have.length(33);
    expect(terrain.map(({ terrain }) => terrain)).to.deep.equal(
      [0, 1, 2].flatMap(() => Array.from({ length: 11 }, (_, i) => i))
    );
    expect(terrain.map(({ special }) => special)).to.deep.equal(
      [0, 1, 2].flatMap((special) => Array(11).fill(special))
    );
    expect(terrain[14]!.name).to.equal('First 3');
    expect(terrain[25]!.name).to.equal('Second 3');
  });

  it('reads all 16 fields of a terrain row', (): void => {
    expect(readTerrain(rules)[5]).to.deep.equal({
      name: 'Land 5',
      terrain: 5,
      special: 0,
      moveCost: 3,
      defence: 3,
      food: 1,
      shields: 2,
      trade: 1,
      irrigation: { result: 'yes', bonus: 1, turns: 5, aiGovernment: 5 },
      mining: { result: 'No', bonus: 0, turns: 6, aiGovernment: 0 },
      transform: 'Ab5',
      comment: 'T5',
    });
  });

  it('reads only the yields of a special, which has no changes of its own', (): void => {
    expect(readTerrain(rules)[29]).to.deep.equal({
      name: 'Second 7',
      terrain: 7,
      special: 2,
      moveCost: 2,
      defence: 3,
      food: 2,
      shields: 3,
      trade: 1,
      irrigation: null,
      mining: null,
      transform: null,
      comment: null,
    });
  });
});

describe('readGovernments', (): void => {
  it('reads the name and the two default titles', (): void => {
    expect(
      readGovernments(
        file(
          '@GOVERNMENTS',
          'Muddle,   Boss,  Bossess',
          'Council, Elder, Elder'
        )
      )
    ).to.deep.equal([
      { name: 'Muddle', maleTitle: 'Boss', femaleTitle: 'Bossess' },
      { name: 'Council', maleTitle: 'Elder', femaleTitle: 'Elder' },
    ]);
  });
});

describe('readLeaders', (): void => {
  const rules = file(
    '@LEADERS',
    'Arno,   Bettina,  1, 3, 2, Pebblers, Pebbly,  1, -1,  0,     2, Big Arno, Big Bettina, 5, Moot Chair, Moot Chair',
    'Cato,   Dora,     0, 4, 1, Kiters,   Kitish, -1,  0,  1,',
    'Emil,   Freya,    0, 7, 0, Waders,   Wadish,  0,  1, -1,     3, Gaffer, Gaffer',
    'Gus,    Hilde,    0, 1, 3, Muddlers, Muddly,  0,  0,  0',
    'Ivo,    Jutta,    0, 2, 0, Others,   Other,   0,  0,  0,     0, Never, Never, 4, Lost, Lost',
    '',
    'Kurt,   Lena,     0, 5, 0, Extras,   Extra,   0,  0,  0'
  );

  it('reads the names, numbers and replacement titles', (): void => {
    expect(readLeaders(rules)[0]).to.deep.equal({
      maleName: 'Arno',
      femaleName: 'Bettina',
      female: 1,
      colour: 3,
      cityStyle: 2,
      plural: 'Pebblers',
      adjective: 'Pebbly',
      attack: 1,
      expand: -1,
      civilize: 0,
      titles: [
        { government: 2, male: 'Big Arno', female: 'Big Bettina' },
        { government: 5, male: 'Moot Chair', female: 'Moot Chair' },
      ],
    });
  });

  it('ends the titles at a government not above 0, or at the end of the row', (): void => {
    expect(readLeaders(rules).map(({ titles }) => titles.length)).to.deep.equal(
      [2, 0, 1, 0, 0]
    );
  });

  it('reads at most 21 rows', (): void => {
    expect(
      readLeaders(
        file(
          '@LEADERS',
          ...Array.from({ length: 25 }, () => 'A, B, 0, 1, 0, Cs, C, 0, 0, 0')
        )
      )
    ).to.have.length(21);
  });
});

describe('readDifficulty', (): void => {
  it('takes each whole line as a name', (): void => {
    expect(
      readDifficulty(file('@DIFFICULTY', 'Pebble', 'Kite, High', 'Cloud', ''))
    ).to.deep.equal([
      { name: 'Pebble' },
      { name: 'Kite, High' },
      { name: 'Cloud' },
    ]);
  });
});

describe('a missing section', (): void => {
  it('gives no rows', (): void => {
    expect(readUnits('@TERRAIN\nMarsh, 1')).to.deep.equal([]);
    expect(readCosmic('').raw.roadMoveMultiplier).to.equal(0);
  });
});
