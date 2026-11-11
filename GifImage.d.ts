export type Colour = [r: number, g: number, b: number];
export declare class GifImage {
  #private;
  constructor(
    width: number,
    height: number,
    palette: Colour[],
    pixels: Uint8Array
  );
  static fromBytes(bytes: Uint8Array): GifImage;
  colour(index: number): Colour;
  height(): number;
  index(x: number, y: number): number;
  palette(): Colour[];
  width(): number;
}
export default GifImage;
