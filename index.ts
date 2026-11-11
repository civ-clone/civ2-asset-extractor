// The library: `extractSprites` and the GIF decoder have no Node dependency, so
//  a browser can import them (and `extract-data.json`) directly. `cli.ts` is the
//  Node command that writes `.png` files.
export * from './GifImage';
export * from './extractSprites';
export * from './rules';
export { default } from './extractSprites';
