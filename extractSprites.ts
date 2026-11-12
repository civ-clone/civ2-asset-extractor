import GifImage, { Colour } from './GifImage';

export type Point = { x: number; y: number };

// A block of equally-sized cells, read left to right then top to bottom. Each
// cell sits inside a 1px border, so the step defaults to the size plus one.
export type GridDefinition = {
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: number;
  stepX?: number;
  stepY?: number;
  // One name per cell, or `null` to skip the cell.
  names: (string | null)[];
  // Border pixels in these colours mark a point within the cell. The top
  // border gives x and the left border gives y.
  markers?: { [hex: string]: string };
  // Colours to knock out, such as labels drawn inside the cell.
  clear?: string[];
};

// Player colours, read from the flags in `CITIES.GIF`.
export type FlagDefinition = {
  x: number;
  width: number;
  height: number;
  count: number;
  stepX?: number;
  // The rows of flags; each gets its own set of colours.
  rows: { name: string; y: number }[];
};

export type FileDefinition = {
  // A sheet that only some sprites come from, such as `ICONS.GIF`. Without it
  //  the rest are still extracted.
  optional?: boolean;
  grids: GridDefinition[];
  flags?: FlagDefinition;
};

export type ExtractData = {
  files: { [filename: string]: FileDefinition };
};

export type Sprite = {
  name: string;
  width: number;
  height: number;
  // RGBA, ready for `new ImageData(data, width, height)`.
  data: Uint8ClampedArray;
  anchors?: { [name: string]: Point };
};

export type PlayerColours = {
  [row: string]: { primary: Colour; secondary: Colour }[];
};

export type ExtractResult = {
  sprites: Sprite[];
  colours?: PlayerColours;
};

const toHex = ([r, g, b]: Colour) =>
  '#' + [r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('');

// `RULES.TXT` documents the last three palette entries as two transparent
// colours either side of the border colour. Reading them by index copes with
// sheets that recolour them.
export const specialIndices = (image: GifImage) => {
  const size = image.palette().length;

  return {
    transparent: [size - 3, size - 1],
    border: size - 2,
  };
};

// Civ2's sheets have a 256-colour palette, and every cell (with the border
//  above and to the left that holds its markers) inside the image. A sheet
//  that isn't laid out that way is refused rather than cut up wrongly.
const checkGrid = (image: GifImage, grid: GridDefinition): void => {
  const stepX = grid.stepX ?? grid.width + 1,
    stepY = grid.stepY ?? grid.height + 1,
    rows = Math.ceil(grid.names.length / grid.columns),
    columns = Math.min(grid.columns, grid.names.length),
    right = grid.x + (columns - 1) * stepX + grid.width,
    bottom = grid.y + (rows - 1) * stepY + grid.height;

  if (image.palette().length !== 256) {
    throw new TypeError(
      `Expected a 256-colour sheet, not ${image.palette().length} colours.`
    );
  }

  if (
    grid.x < 1 ||
    grid.y < 1 ||
    right > image.width() ||
    bottom > image.height()
  ) {
    throw new TypeError(
      `The ${
        grid.path || 'sprite'
      } cells don't fit a ${image.width()}×${image.height()} sheet.`
    );
  }
};

export const extractGrid = (
  image: GifImage,
  grid: GridDefinition
): Sprite[] => {
  checkGrid(image, grid);

  const { transparent, border } = specialIndices(image),
    stepX = grid.stepX ?? grid.width + 1,
    stepY = grid.stepY ?? grid.height + 1,
    clear = (grid.clear ?? []).map((hex) => hex.toLowerCase()),
    markers = Object.fromEntries(
      Object.entries(grid.markers ?? {}).map(([hex, name]) => [
        hex.toLowerCase(),
        name,
      ])
    );

  return grid.names.flatMap((name, cell) => {
    if (name === null) {
      return [];
    }

    const originX = grid.x + (cell % grid.columns) * stepX,
      originY = grid.y + Math.floor(cell / grid.columns) * stepY,
      data = new Uint8ClampedArray(grid.width * grid.height * 4),
      anchors: { [name: string]: Point } = {};

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const index = image.index(originX + x, originY + y);

        if (
          transparent.includes(index) ||
          index === border ||
          clear.includes(toHex(image.colour(index)))
        ) {
          continue;
        }

        data.set([...image.colour(index), 255], (y * grid.width + x) * 4);
      }
    }

    const readMarker = (x: number, y: number, axis: keyof Point) => {
      const index = image.index(x, y),
        marker = markers[toHex(image.colour(index))];

      if (index === border || !marker) {
        return;
      }

      anchors[marker] ??= { x: 0, y: 0 };
      anchors[marker][axis] = axis === 'x' ? x - originX : y - originY;
    };

    if (grid.markers) {
      for (let x = 0; x < grid.width; x++) {
        readMarker(originX + x, originY - 1, 'x');
      }

      for (let y = 0; y < grid.height; y++) {
        readMarker(originX - 1, originY + y, 'y');
      }
    }

    return [
      {
        name: grid.path + name,
        width: grid.width,
        height: grid.height,
        data,
        ...(grid.markers ? { anchors } : {}),
      },
    ];
  });
};

// Each flag is drawn in two player colours plus a pole and outline that every
// flag shares. The two most common colours not shared by all flags are the
// player's.
export const extractFlagColours = (
  image: GifImage,
  flags: FlagDefinition
): PlayerColours => {
  const { transparent, border } = specialIndices(image),
    stepX = flags.stepX ?? flags.width + 1,
    result: PlayerColours = {};

  flags.rows.forEach(({ name, y: originY }) => {
    const counts = Array.from({ length: flags.count }, (_, flag) => {
        const count = new Map<number, number>();

        for (let y = 0; y < flags.height; y++) {
          for (let x = 0; x < flags.width; x++) {
            const index = image.index(flags.x + flag * stepX + x, originY + y);

            if (!transparent.includes(index) && index !== border) {
              count.set(index, (count.get(index) ?? 0) + 1);
            }
          }
        }

        return count;
      }),
      shared = [...counts[0].keys()].filter((index) =>
        counts.every((count) => count.has(index))
      );

    result[name] = counts.map((count) => {
      const [primary, secondary] = [...count.entries()]
        .filter(([index]) => !shared.includes(index))
        .sort(([, a], [, b]) => b - a)
        .map(([index]) => image.colour(index));

      return { primary, secondary: secondary ?? primary };
    });
  });

  return result;
};

export const extractSprites = (
  bytes: Uint8Array,
  definition: FileDefinition,
  logger: (message: string) => void = () => undefined
): ExtractResult => {
  const image = GifImage.fromBytes(bytes),
    sprites = definition.grids.flatMap((grid) => {
      logger(`Processing ${grid.path}...`);

      return extractGrid(image, grid);
    });

  return {
    sprites,
    ...(definition.flags
      ? { colours: extractFlagColours(image, definition.flags) }
      : {}),
  };
};

export default extractSprites;
