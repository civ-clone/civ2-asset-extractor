import { FileDefinition, GridDefinition } from './extractSprites';

export const toSlug = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Reads the first field of each line in a `RULES.TXT` section, stopping at the
// first blank line.
export const readSection = (rules: string, section: string): string[] => {
  const lines = rules.split(/\r?\n/),
    start = lines.findIndex((line) => line.trim() === section);

  if (start === -1) {
    return [];
  }

  const end = lines.findIndex(
    (line, index) => index > start && line.trim() === ''
  );

  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .filter((line) => !line.startsWith(';'))
    .map((line) => toSlug(line.split(',')[0]));
};

// Units are drawn in `@UNITS` order, so a scenario's own `RULES.TXT` names its
// own units. Terrain stays as defined, because scenarios rename it less often
// and the terrain layout doesn't follow the rules file.
// The unit grid is the one whose blue markers place the shield.
const isUnitGrid = ({ markers = {} }: GridDefinition): boolean =>
  Object.entries(markers).some(
    ([hex, name]) => hex.toLowerCase() === '#0000ff' && name === 'shield'
  );

export const withUnitNames = (
  definition: FileDefinition,
  rules: string
): FileDefinition => {
  const units = readSection(rules, '@UNITS');

  if (units.length === 0) {
    return definition;
  }

  return {
    ...definition,
    grids: definition.grids.map((grid) => {
      if (!isUnitGrid(grid)) {
        return grid;
      }

      // Two units whose names make the same slug (or none) would overwrite
      //  each other's sprite, so those keep the sheet's own name.
      const used = new Set<string>();

      return {
        ...grid,
        names: grid.names.map((name, i) => {
          const unit = units[i];

          if (!unit || used.has(unit)) {
            return name;
          }

          used.add(unit);

          return unit;
        }),
      };
    }),
  };
};

// RULES.TXT section parsers. Each follows the loader for its section in
//  OpenCiv2 (https://github.com/richardpenman/civ2, MIT), the reconstruction of
//  Civilization II: Multiplayer Gold Edition, and is cited by `civ.cpp:line`
//  (`src/auto/civ.cpp`) or `text.cpp:line` (`src/auto/text.cpp`).
// The records hold the values as the file writes them. Where the game scales
//  or clamps a value as it loads it, the field's comment says so; only
//  `readCosmic` also gives the effective values.

// A prerequisite or expiry token: an advance's abbreviation as written, or
//  `nil` (needs nothing) or `no` (never available). The game resolves the
//  abbreviation against its own built-in list (`civ.cpp:4945`), so it is left
//  for the caller to resolve. `nil` and `no` match case-sensitively.
export type AdvanceReference = string;

// The text after a row's `;`, trimmed, or `null` when there is none.
export type Comment = string | null;

// The game's integer parse (`text.cpp:1831`): `0x`, `0b` and `0d` prefixes for
//  hexadecimal, binary and decimal, otherwise C's `atoi`, which reads an
//  optional sign and digits and ignores the rest (so `1.`, `2h` and `0a` are 1,
//  2 and 0) and gives 0 for no digits.
export const parseInteger = (token: string): number => {
  const text = token.trimStart();

  if (text[0] === '0') {
    const prefix = (text[1] ?? '').toUpperCase(),
      rest = text.slice(2);

    if (prefix === 'X') {
      return parseInt(rest.match(/^[0-9a-f]*/i)![0] || '0', 16);
    }

    if (prefix === 'B') {
      return parseInt(rest.match(/^[01]*/)![0] || '0', 2);
    }

    if (prefix === 'D') {
      return parseInteger(rest);
    }
  }

  const match = text.match(/^[+-]?\d+/);

  return match ? parseInt(match[0], 10) : 0;
};

// A bit string read most significant bit first, stopping at the first
//  character that isn't `0` or `1` (`text.cpp:1148`).
export const parseBits = (token: string): number => {
  let value = 0;

  for (const character of token.trim()) {
    if (character !== '0' && character !== '1') {
      break;
    }

    value = value * 2 + (character === '1' ? 1 : 0);
  }

  return value;
};

interface Row {
  line: string;
  fields: string[];
  comment: Comment;
}

// Splits a line into its comma-separated fields, each trimmed, and its comment.
//  The game splits at every comma and keeps any `;` text in the last field
//  (`text.cpp:1095`); taking the comment off first only differs for a text
//  field holding a `;`.
const toRow = (line: string): Row => {
  const index = line.indexOf(';'),
    body = index === -1 ? line : line.slice(0, index);

  return {
    line,
    fields: body.split(',').map((field) => field.trim()),
    comment: index === -1 ? null : line.slice(index + 1).trim() || null,
  };
};

// The lines of a section, trimmed, from the line after its `@NAME` header (found
//  case-insensitively, as `text.cpp:1007` does) up to the first blank line,
//  line starting with `;` or `@`, or the end of the file, and at most `limit`.
//  The game reads `@CIVILIZE` and `@UNITS` up to a blank or `;` line
//  (`civ.cpp:982`, `:1183`). For the other sections it reads exactly as many
//  lines as it has slots, whatever they hold; here a section that is short
//  gives fewer rows instead.
const sectionRows = (rules: string, section: string, limit: number): Row[] => {
  const lines = rules.split(/\r?\n/).map((line) => line.trim()),
    tag = section.toUpperCase(),
    start = lines.findIndex((line) => line.toUpperCase() === tag);

  if (start === -1) {
    return [];
  }

  const rows: Row[] = [];

  for (
    let index = start + 1;
    index < lines.length && rows.length < limit;
    index++
  ) {
    const line = lines[index]!;

    if (line === '' || line.startsWith(';') || line.startsWith('@')) {
      break;
    }

    rows.push(toRow(line));
  }

  return rows;
};

const field = (row: Row, index: number): string => row.fields[index] ?? '';

const integer = (row: Row, index: number): number =>
  parseInteger(field(row, index));

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

// @COSMIC: one value per line, in this order (`civ.cpp:891`). Names follow
//  OpenCiv2's `Cosmic` struct.
export interface CosmicRecord {
  roadMoveMultiplier: number;
  triremeLossChance: number;
  foodPerCitizen: number;
  foodBoxRows: number;
  shieldBoxRows: number;
  settlerFoodLow: number;
  settlerFoodHigh: number;
  unhappySize: number;
  riotFactor: number;
  aqueductSize: number;
  sewerSize: number;
  techParadigm: number;
  transformTime: number;
  monarchyFreeSupport: number;
  communismFreeSupport: number;
  fundamentalismFreeSupport: number;
  communismPalaceDistance: number;
  fundamentalismScienceLoss: number;
  changePenalty: number;
  paradropRange: number;
  massThrustParadigm: number;
  fundamentalismMaxScience: number;
}

// Each value's range as the game clamps it on loading (`civ.cpp:891` to `:925`).
export const cosmicLimits: {
  [K in keyof CosmicRecord]: [min: number, max: number];
} = {
  roadMoveMultiplier: [1, 10],
  triremeLossChance: [1, 100],
  foodPerCitizen: [0, 10],
  foodBoxRows: [4, 20],
  shieldBoxRows: [4, 20],
  settlerFoodLow: [0, 10],
  settlerFoodHigh: [0, 10],
  unhappySize: [4, 12],
  riotFactor: [10, 100],
  aqueductSize: [4, 50],
  sewerSize: [4, 50],
  techParadigm: [3, 10],
  transformTime: [5, 100],
  monarchyFreeSupport: [0, 8],
  communismFreeSupport: [0, 8],
  fundamentalismFreeSupport: [0, 8],
  communismPalaceDistance: [1, 20],
  fundamentalismScienceLoss: [0, 100],
  changePenalty: [0, 100],
  paradropRange: [4, 100],
  massThrustParadigm: [25, 200],
  fundamentalismMaxScience: [0, 10],
};

export interface Cosmic {
  // The values as written. A missing line reads as 0.
  raw: CosmicRecord;
  // The values the game uses: each clamped to `cosmicLimits`, and an odd number
  //  of food box rows rounded up to the next even one (`civ.cpp:906`).
  effective: CosmicRecord;
}

export const readCosmic = (rules: string): Cosmic => {
  const keys = Object.keys(cosmicLimits) as (keyof CosmicRecord)[],
    rows = sectionRows(rules, '@COSMIC', keys.length),
    raw = {} as CosmicRecord,
    effective = {} as CosmicRecord;

  keys.forEach((key, index) => {
    const [min, max] = cosmicLimits[key],
      row = rows[index];

    raw[key] = row ? integer(row, 0) : 0;
    effective[key] = clamp(raw[key], min, max);
  });

  if (effective.foodBoxRows % 2 === 1) {
    effective.foodBoxRows++;
  }

  return { raw, effective };
};

// @CIVILIZE (`civ.cpp:930`): every row in file order, at most 100. The game
//  stops at a blank line or a line starting with `;`. An advance whose first
//  prerequisite is `no` is never available (`civ.cpp:1013`).
export interface AdvanceRecord {
  name: string;
  aiValue: number;
  // Added to `aiValue` for a civilized leader, taken off for a militaristic one.
  civilizedModifier: number;
  prerequisites: [AdvanceReference, AdvanceReference];
  // 0 to 3, ancient to modern.
  epoch: number;
  // 0 to 4: military, economic, social, academic, applied.
  category: number;
  // In the shipped file this is usually the advance's abbreviation, but the
  //  game doesn't read it (`civ.cpp:4945` uses a built-in list), so it can't be
  //  relied on.
  comment: Comment;
}

export const readCivilize = (rules: string): AdvanceRecord[] =>
  sectionRows(rules, '@CIVILIZE', 100).map((row) => ({
    name: field(row, 0),
    aiValue: integer(row, 1),
    civilizedModifier: integer(row, 2),
    prerequisites: [field(row, 3), field(row, 4)],
    epoch: integer(row, 5),
    category: integer(row, 6),
    comment: row.comment,
  }));

export const isAdvanceAvailable = ({ prerequisites }: AdvanceRecord): boolean =>
  prerequisites[0] !== 'no';

// @IMPROVE (`civ.cpp:1061`): 67 rows, city improvements in rows 0 to 38 and
//  Wonders of the World in rows 39 to 66.
export const improvementCount = 39;
export const wonderCount = 28;

export interface ImprovementRecord {
  name: string;
  // In rows of 10 shields.
  cost: number;
  // Gold per turn.
  upkeep: number;
  prerequisite: AdvanceReference;
}

export const readImprovements = (rules: string): ImprovementRecord[] =>
  sectionRows(rules, '@IMPROVE', improvementCount + wonderCount).map((row) => ({
    name: field(row, 0),
    cost: integer(row, 1),
    upkeep: integer(row, 2),
    prerequisite: field(row, 3),
  }));

// @ENDWONDER (`civ.cpp:1119`): 28 rows, one per wonder in @IMPROVE order.
export interface EndWonderRecord {
  // The advance after which the wonder stops working, or `nil`.
  expiresWith: AdvanceReference;
  comment: Comment;
}

export const readEndWonder = (rules: string): EndWonderRecord[] =>
  sectionRows(rules, '@ENDWONDER', wonderCount).map((row) => ({
    expiresWith: field(row, 0),
    comment: row.comment,
  }));

// @UNITS (`civ.cpp:1133`): every row in file order, at most 62. The game stops
//  at a blank line or a line starting with `;`. A unit whose prerequisite is
//  `no` is never available.
export interface UnitRecord {
  name: string;
  // The advance that makes the unit obsolete, or `nil`.
  obsoleteBy: AdvanceReference;
  // 0 land, 1 air, 2 sea.
  domain: number;
  // In whole squares; the game multiplies it by @COSMIC's road movement
  //  multiplier (`civ.cpp:1198`).
  move: number;
  // Turns of fuel for air units.
  range: number;
  attack: number;
  defence: number;
  // As written; the game multiplies it by 10 (`civ.cpp:1206`).
  hitPoints: number;
  firepower: number;
  // In rows of shields; the game clamps it to 1 to 200 (`civ.cpp:1209`).
  cost: number;
  // How many units it carries.
  hold: number;
  // The AI's role for it, 0 to 7; see `UnitRole`.
  role: number;
  prerequisite: AdvanceReference;
  // The bit string as a number; see `UnitFlag`.
  flags: number;
}

// OpenCiv2's names for the roles (`src/include/enums.h`).
export enum UnitRole {
  Attack = 0,
  Defend = 1,
  NavalSuperiority = 2,
  AirSuperiority = 3,
  SeaTransport = 4,
  Settle = 5,
  Diplomacy = 6,
  Trade = 7,
}

// The bits of `UnitRecord.flags`, with the least significant (the last
//  character of the bit string) first.
export enum UnitFlag {
  SeesTwoSpaces = 1 << 0,
  IgnoresZonesOfControl = 1 << 1,
  Amphibious = 1 << 2,
  Submarine = 1 << 3,
  AttacksAir = 1 << 4,
  CoastBound = 1 << 5,
  IgnoresCityWalls = 1 << 6,
  CarriesAir = 1 << 7,
  Paradrops = 1 << 8,
  TreatsAllAsRoad = 1 << 9,
  DefenceBonusVsMounted = 1 << 10,
  FundamentalismFreeSupport = 1 << 11,
  DestroyedAfterAttacking = 1 << 12,
  DefenceBonusVsAir = 1 << 13,
  DetectsSubmarines = 1 << 14,
}

export const readUnits = (rules: string): UnitRecord[] =>
  sectionRows(rules, '@UNITS', 62).map((row) => ({
    name: field(row, 0),
    obsoleteBy: field(row, 1),
    domain: integer(row, 2),
    move: integer(row, 3),
    range: integer(row, 4),
    attack: integer(row, 5),
    defence: integer(row, 6),
    hitPoints: integer(row, 7),
    firepower: integer(row, 8),
    cost: integer(row, 9),
    hold: integer(row, 10),
    role: integer(row, 11),
    prerequisite: field(row, 12),
    flags: parseBits(field(row, 13)),
  }));

export const isUnitAvailable = ({ prerequisite }: UnitRecord): boolean =>
  prerequisite !== 'no';

// @TERRAIN (`civ.cpp:1251`): 33 rows. Rows 0 to 10 are the terrains; rows 11 to
//  21 are the first special resource of terrains 0 to 10, and rows 22 to 32 the
//  second. A special row holds only its name and first five values: it is
//  improved as its terrain is.
export const terrainCount = 11;

// Irrigating or mining a terrain.
export interface TerrainChange {
  // `yes` (improves the square in place), `no` (can't be done), or the
  //  abbreviation of the terrain it changes the square to. `yes` and `no` match
  //  case-insensitively (`civ.cpp:4977`).
  result: string;
  // The extra food (irrigating) or shields (mining) it gives.
  bonus: number;
  // Turns for Settlers to do it.
  turns: number;
  // The lowest government, 0 (never) to 6, under which the AI wants it done.
  aiGovernment: number;
}

export interface TerrainRecord {
  name: string;
  // Which terrain (0 to 10) the row is, or is a special resource of.
  terrain: number;
  // 0 for the terrain itself, 1 or 2 for its special resources.
  special: 0 | 1 | 2;
  moveCost: number;
  // In halves: 3 defends at 150%.
  defence: number;
  food: number;
  shields: number;
  trade: number;
  // Rows 0 to 10 only, `null` on the special resources.
  irrigation: TerrainChange | null;
  mining: TerrainChange | null;
  // The abbreviation of the terrain Engineers transform it to, or `no`.
  transform: string | null;
  comment: Comment;
}

export const readTerrain = (rules: string): TerrainRecord[] =>
  sectionRows(rules, '@TERRAIN', terrainCount * 3).map((row, index) => {
    const isTerrain = index < terrainCount,
      change = (start: number): TerrainChange | null =>
        isTerrain
          ? {
              result: field(row, start),
              bonus: integer(row, start + 1),
              turns: integer(row, start + 2),
              aiGovernment: integer(row, start + 3),
            }
          : null;

    return {
      name: field(row, 0),
      terrain: index % terrainCount,
      special: Math.floor(index / terrainCount) as 0 | 1 | 2,
      moveCost: integer(row, 1),
      defence: integer(row, 2),
      food: integer(row, 3),
      shields: integer(row, 4),
      trade: integer(row, 5),
      irrigation: change(6),
      mining: change(10),
      transform: isTerrain ? field(row, 14) : null,
      comment: row.comment,
    };
  });

// @GOVERNMENTS (`civ.cpp:1446`): 7 rows, Anarchy (0) to Democracy (6).
export interface GovernmentRecord {
  name: string;
  // The default titles of a male and a female leader.
  maleTitle: string;
  femaleTitle: string;
}

export const readGovernments = (rules: string): GovernmentRecord[] =>
  sectionRows(rules, '@GOVERNMENTS', 7).map((row) => ({
    name: field(row, 0),
    maleTitle: field(row, 1),
    femaleTitle: field(row, 2),
  }));

// @LEADERS (`civ.cpp:1472`; `:1327` loads the same fields from the built-in rules): 21 rows, one per civilization.
export interface LeaderTitle {
  // The government (1 to 6) whose default titles these replace.
  government: number;
  male: string;
  female: string;
}

export interface LeaderRecord {
  maleName: string;
  femaleName: string;
  // 1 when the leader is female. The game clamps it to 0 or 1.
  female: number;
  // The colour set; the game clamps it to 1 to 7.
  colour: number;
  // The city style; the game clamps it to 0 to 3.
  cityStyle: number;
  plural: string;
  adjective: string;
  // Each -1, 0 or 1: rational to aggressive, perfectionist to expansionist and
  //  militaristic to civilized.
  attack: number;
  expand: number;
  civilize: number;
  // The game reads a government and two titles at a time until the government
  //  isn't above 0 (`civ.cpp:1555` to `:1568`), so Anarchy's titles can't be replaced and
  //  a missing or trailing field ends the list.
  titles: LeaderTitle[];
}

export const readLeaders = (rules: string): LeaderRecord[] =>
  sectionRows(rules, '@LEADERS', 21).map((row) => {
    const titles: LeaderTitle[] = [];

    for (let index = 10; ; index += 3) {
      const government = integer(row, index);

      if (government <= 0) {
        break;
      }

      titles.push({
        government,
        male: field(row, index + 1),
        female: field(row, index + 2),
      });
    }

    return {
      maleName: field(row, 0),
      femaleName: field(row, 1),
      female: integer(row, 2),
      colour: integer(row, 3),
      cityStyle: integer(row, 4),
      plural: field(row, 5),
      adjective: field(row, 6),
      attack: integer(row, 7),
      expand: integer(row, 8),
      civilize: integer(row, 9),
      titles,
    };
  });

// @DIFFICULTY (`civ.cpp:1624`): 6 rows, easiest first. The game takes each
//  whole line as the name (`text.cpp:1126`), commas, `;` and all.
export interface DifficultyRecord {
  name: string;
}

export const readDifficulty = (rules: string): DifficultyRecord[] =>
  sectionRows(rules, '@DIFFICULTY', 6).map((row) => ({
    name: row.line,
  }));
