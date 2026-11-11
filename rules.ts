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
