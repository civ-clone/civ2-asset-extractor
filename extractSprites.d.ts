import GifImage, { Colour } from './GifImage';
export type Point = {
  x: number;
  y: number;
};
export type GridDefinition = {
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: number;
  stepX?: number;
  stepY?: number;
  names: (string | null)[];
  markers?: {
    [hex: string]: string;
  };
  clear?: string[];
};
export type FlagDefinition = {
  x: number;
  width: number;
  height: number;
  count: number;
  stepX?: number;
  rows: {
    name: string;
    y: number;
  }[];
};
export type FileDefinition = {
  grids: GridDefinition[];
  flags?: FlagDefinition;
};
export type ExtractData = {
  files: {
    [filename: string]: FileDefinition;
  };
};
export type Sprite = {
  name: string;
  width: number;
  height: number;
  data: Uint8ClampedArray;
  anchors?: {
    [name: string]: Point;
  };
};
export type PlayerColours = {
  [row: string]: {
    primary: Colour;
    secondary: Colour;
  }[];
};
export type ExtractResult = {
  sprites: Sprite[];
  colours?: PlayerColours;
};
export declare const specialIndices: (image: GifImage) => {
  transparent: number[];
  border: number;
};
export declare const extractGrid: (
  image: GifImage,
  grid: GridDefinition
) => Sprite[];
export declare const extractFlagColours: (
  image: GifImage,
  flags: FlagDefinition
) => PlayerColours;
export declare const extractSprites: (
  bytes: Uint8Array,
  definition: FileDefinition,
  logger?: (message: string) => void
) => ExtractResult;
export default extractSprites;
