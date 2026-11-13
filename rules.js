"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readDifficulty = exports.readLeaders = exports.readGovernments = exports.readTerrain = exports.terrainCount = exports.isUnitAvailable = exports.readUnits = exports.UnitFlag = exports.UnitRole = exports.readEndWonder = exports.readImprovements = exports.wonderCount = exports.improvementCount = exports.isAdvanceAvailable = exports.readCivilize = exports.readCosmic = exports.cosmicLimits = exports.parseBits = exports.parseInteger = exports.withUnitNames = exports.readSection = exports.toSlug = void 0;
const toSlug = (name) => name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
exports.toSlug = toSlug;
// Reads the first field of each line in a `RULES.TXT` section, stopping at the
// first blank line.
const readSection = (rules, section) => {
    const lines = rules.split(/\r?\n/), start = lines.findIndex((line) => line.trim() === section);
    if (start === -1) {
        return [];
    }
    const end = lines.findIndex((line, index) => index > start && line.trim() === '');
    return lines
        .slice(start + 1, end === -1 ? undefined : end)
        .filter((line) => !line.startsWith(';'))
        .map((line) => (0, exports.toSlug)(line.split(',')[0]));
};
exports.readSection = readSection;
// Units are drawn in `@UNITS` order, so a scenario's own `RULES.TXT` names its
// own units. Terrain stays as defined, because scenarios rename it less often
// and the terrain layout doesn't follow the rules file.
// The unit grid is the one whose blue markers place the shield.
const isUnitGrid = ({ markers = {} }) => Object.entries(markers).some(([hex, name]) => hex.toLowerCase() === '#0000ff' && name === 'shield');
const withUnitNames = (definition, rules) => {
    const units = (0, exports.readSection)(rules, '@UNITS');
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
            const used = new Set();
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
exports.withUnitNames = withUnitNames;
// The game's integer parse (`text.cpp:1831`): `0x`, `0b` and `0d` prefixes for
//  hexadecimal, binary and decimal, otherwise C's `atoi`, which reads an
//  optional sign and digits and ignores the rest (so `1.`, `2h` and `0a` are 1,
//  2 and 0) and gives 0 for no digits.
const atoi = (text) => {
    const match = text.match(/^\s*[+-]?\d+/);
    return match ? parseInt(match[0], 10) : 0;
};
const parseInteger = (token) => {
    var _a;
    const text = token.trimStart();
    if (text[0] === '0') {
        const prefix = ((_a = text[1]) !== null && _a !== void 0 ? _a : '').toUpperCase(), rest = text.slice(2);
        if (prefix === 'X') {
            return parseInt(rest.match(/^[0-9a-f]*/i)[0] || '0', 16);
        }
        if (prefix === 'B') {
            return parseInt(rest.match(/^[01]*/)[0] || '0', 2);
        }
        if (prefix === 'D') {
            return atoi(rest);
        }
    }
    return atoi(text);
};
exports.parseInteger = parseInteger;
// A bit string read most significant bit first, stopping at the first
//  character that isn't `0` or `1` (`text.cpp:1148`).
const parseBits = (token) => {
    let value = 0;
    for (const character of token.trim()) {
        if (character !== '0' && character !== '1') {
            break;
        }
        value = value * 2 + (character === '1' ? 1 : 0);
    }
    return value;
};
exports.parseBits = parseBits;
// Splits a line into its comma-separated fields, each trimmed, and its comment.
//  The game splits at every comma and keeps any `;` text in the last field
//  (`text.cpp:1095`); taking the comment off first only differs for a text
//  field holding a `;`.
const toRow = (line) => {
    const index = line.indexOf(';'), body = index === -1 ? line : line.slice(0, index);
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
const sectionRows = (rules, section, limit) => {
    const lines = rules.split(/\r?\n/).map((line) => line.trim()), tag = section.toUpperCase(), start = lines.findIndex((line) => line.toUpperCase() === tag);
    if (start === -1) {
        return [];
    }
    const rows = [];
    for (let index = start + 1; index < lines.length && rows.length < limit; index++) {
        const line = lines[index];
        if (line === '' || line.startsWith(';') || line.startsWith('@')) {
            break;
        }
        rows.push(toRow(line));
    }
    return rows;
};
const field = (row, index) => { var _a; return (_a = row.fields[index]) !== null && _a !== void 0 ? _a : ''; };
const integer = (row, index) => (0, exports.parseInteger)(field(row, index));
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
// Each value's range as the game clamps it on loading (`civ.cpp:891` to `:925`).
exports.cosmicLimits = {
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
const readCosmic = (rules) => {
    const keys = Object.keys(exports.cosmicLimits), rows = sectionRows(rules, '@COSMIC', keys.length), raw = {}, effective = {};
    keys.forEach((key, index) => {
        const [min, max] = exports.cosmicLimits[key], row = rows[index];
        raw[key] = row ? integer(row, 0) : 0;
        effective[key] = clamp(raw[key], min, max);
    });
    if (effective.foodBoxRows % 2 === 1) {
        effective.foodBoxRows++;
    }
    return { raw, effective };
};
exports.readCosmic = readCosmic;
const readCivilize = (rules) => sectionRows(rules, '@CIVILIZE', 100).map((row) => ({
    name: field(row, 0),
    aiValue: integer(row, 1),
    civilizedModifier: integer(row, 2),
    prerequisites: [field(row, 3), field(row, 4)],
    epoch: integer(row, 5),
    category: integer(row, 6),
    comment: row.comment,
}));
exports.readCivilize = readCivilize;
const isAdvanceAvailable = ({ prerequisites }) => prerequisites[0] !== 'no';
exports.isAdvanceAvailable = isAdvanceAvailable;
// @IMPROVE (`civ.cpp:1061`): 67 rows, city improvements in rows 0 to 38 and
//  Wonders of the World in rows 39 to 66.
exports.improvementCount = 39;
exports.wonderCount = 28;
const readImprovements = (rules) => sectionRows(rules, '@IMPROVE', exports.improvementCount + exports.wonderCount).map((row) => ({
    name: field(row, 0),
    cost: integer(row, 1),
    upkeep: integer(row, 2),
    prerequisite: field(row, 3),
}));
exports.readImprovements = readImprovements;
const readEndWonder = (rules) => sectionRows(rules, '@ENDWONDER', exports.wonderCount).map((row) => ({
    expiresWith: field(row, 0),
    comment: row.comment,
}));
exports.readEndWonder = readEndWonder;
// OpenCiv2's names for the roles (`src/include/enums.h`).
var UnitRole;
(function (UnitRole) {
    UnitRole[UnitRole["Attack"] = 0] = "Attack";
    UnitRole[UnitRole["Defend"] = 1] = "Defend";
    UnitRole[UnitRole["NavalSuperiority"] = 2] = "NavalSuperiority";
    UnitRole[UnitRole["AirSuperiority"] = 3] = "AirSuperiority";
    UnitRole[UnitRole["SeaTransport"] = 4] = "SeaTransport";
    UnitRole[UnitRole["Settle"] = 5] = "Settle";
    UnitRole[UnitRole["Diplomacy"] = 6] = "Diplomacy";
    UnitRole[UnitRole["Trade"] = 7] = "Trade";
})(UnitRole = exports.UnitRole || (exports.UnitRole = {}));
// The bits of `UnitRecord.flags`, with the least significant (the last
//  character of the bit string) first.
var UnitFlag;
(function (UnitFlag) {
    UnitFlag[UnitFlag["SeesTwoSpaces"] = 1] = "SeesTwoSpaces";
    UnitFlag[UnitFlag["IgnoresZonesOfControl"] = 2] = "IgnoresZonesOfControl";
    UnitFlag[UnitFlag["Amphibious"] = 4] = "Amphibious";
    UnitFlag[UnitFlag["Submarine"] = 8] = "Submarine";
    UnitFlag[UnitFlag["AttacksAir"] = 16] = "AttacksAir";
    UnitFlag[UnitFlag["CoastBound"] = 32] = "CoastBound";
    UnitFlag[UnitFlag["IgnoresCityWalls"] = 64] = "IgnoresCityWalls";
    UnitFlag[UnitFlag["CarriesAir"] = 128] = "CarriesAir";
    UnitFlag[UnitFlag["Paradrops"] = 256] = "Paradrops";
    UnitFlag[UnitFlag["TreatsAllAsRoad"] = 512] = "TreatsAllAsRoad";
    UnitFlag[UnitFlag["DefenceBonusVsMounted"] = 1024] = "DefenceBonusVsMounted";
    UnitFlag[UnitFlag["FundamentalismFreeSupport"] = 2048] = "FundamentalismFreeSupport";
    UnitFlag[UnitFlag["DestroyedAfterAttacking"] = 4096] = "DestroyedAfterAttacking";
    UnitFlag[UnitFlag["DefenceBonusVsAir"] = 8192] = "DefenceBonusVsAir";
    UnitFlag[UnitFlag["DetectsSubmarines"] = 16384] = "DetectsSubmarines";
})(UnitFlag = exports.UnitFlag || (exports.UnitFlag = {}));
const readUnits = (rules) => sectionRows(rules, '@UNITS', 62).map((row) => ({
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
    flags: (0, exports.parseBits)(field(row, 13)),
}));
exports.readUnits = readUnits;
const isUnitAvailable = ({ prerequisite }) => prerequisite !== 'no';
exports.isUnitAvailable = isUnitAvailable;
// @TERRAIN (`civ.cpp:1251`): 33 rows. Rows 0 to 10 are the terrains; rows 11 to
//  21 are the first special resource of terrains 0 to 10, and rows 22 to 32 the
//  second. A special row holds only its name and first five values: it is
//  improved as its terrain is.
exports.terrainCount = 11;
const readTerrain = (rules) => sectionRows(rules, '@TERRAIN', exports.terrainCount * 3).map((row, index) => {
    const isTerrain = index < exports.terrainCount, change = (start) => isTerrain
        ? {
            result: field(row, start),
            bonus: integer(row, start + 1),
            turns: integer(row, start + 2),
            aiGovernment: integer(row, start + 3),
        }
        : null;
    return {
        name: field(row, 0),
        terrain: index % exports.terrainCount,
        special: Math.floor(index / exports.terrainCount),
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
exports.readTerrain = readTerrain;
const readGovernments = (rules) => sectionRows(rules, '@GOVERNMENTS', 7).map((row) => ({
    name: field(row, 0),
    maleTitle: field(row, 1),
    femaleTitle: field(row, 2),
}));
exports.readGovernments = readGovernments;
const readLeaders = (rules) => sectionRows(rules, '@LEADERS', 21).map((row) => {
    const titles = [];
    for (let index = 10;; index += 3) {
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
exports.readLeaders = readLeaders;
const readDifficulty = (rules) => sectionRows(rules, '@DIFFICULTY', 6).map((row) => ({
    name: row.line,
}));
exports.readDifficulty = readDifficulty;
//# sourceMappingURL=rules.js.map