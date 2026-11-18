# civ2-asset-extractor

Extracts the map graphics, resource icons, improvement and Wonder pictures and citizens from a copy of Civilization II (tested with Multiplayer Gold Edition, patch 1.3) and writes them as `.png` files, named the Civ2 way. The art is copyrighted, so players supply their own files; nothing here contains any of it.

Needed files: `TERRAIN1.GIF`, `TERRAIN2.GIF`, `UNITS.GIF`, `CITIES.GIF`, plus `RULES.TXT` (optional) to name units, `ICONS.GIF` (optional) for the resource icons, the research and global warming meters and the improvement and Wonder pictures, and `PEOPLE.GIF` (optional) for the citizens. Without the optional sheets the map sprites are still extracted.

Run:

- `npx civ2-asset-extractor <civ2 directory> [output directory]` (or `node cli.js …` in a checkout)

This writes the sprites and a `metadata.json` holding each unit's shield anchor, each city's flag and size-label anchors, and the player colours read from the flags.

`extractSprites` has no Node or `canvas` dependency: it returns RGBA data that a browser can put straight into `ImageData`. The package's `index` exports the library (`extractSprites`, `GifImage`, `withUnitNames`); `extract-data.json` describes where each sprite is on the sheets.

`rules.ts` also reads `RULES.TXT`'s sections into typed records: `readCosmic`, `readCivilize`, `readImprovements`, `readEndWonder`, `readUnits`, `readTerrain`, `readGovernments`, `readLeaders` and `readDifficulty`. They follow the loaders in [OpenCiv2](https://github.com/richardpenman/civ2)'s `src/auto/civ.cpp`, and give the values as written; `readCosmic` also gives the clamped values the game uses. Pass them the file's text (it's Latin-1).

## How the sheets work

- Every sheet is a grid with a 1px border. The last three palette entries are "transparent 1, border, transparent 2" (see `RULES.TXT`), so transparency is read by palette index, not by colour.
- Terrain tiles are 64×32 isometric diamonds. Units and cities are 64×48, with the diamond at the bottom.
- Blue pixels on a unit or city cell's top and left border mark where the shield or flag goes; orange ones on a city mark the size label.
- Units are in `@UNITS` order, so a scenario's `RULES.TXT` names its own units.
- Forest, hills, mountains and rivers have 16 sprites each, one per combination of matching neighbours. They're named by the neighbours that match (`river/ne-sw`, `hills/isolated`).
- Coasts are drawn in quarter tiles: 32×16 diamonds at the top, right, bottom and left of the tile (`n`, `e`, `s`, `w`). Each quarter picks one of eight sprites by the three neighbours it touches, where `1` is land. The digits run anticlockwise round the quarter: for `n` they are NE, N, NW; for `e` SE, E, NE; for `s` SW, S, SE; for `w` NW, W, SW. So `coast/n-011` is the top quarter with land to the N and NW, and `coast/n-001` has land along its NW edge only.
- Roads and railroads are one overlay per connected direction, plus `isolated`.
- River mouths are drawn on the ocean tile next to a river, one per edge (`river-mouth/ne`, `se`, `sw`, `nw`). Each points at the land the river comes from.
- Cities show the player's colour on a flag at their `flag` anchor. `city/flag` and `city/flag-2` are the first (red) flag from each of the sheet's two rows, light and dark. To colour one for a player, swap the red flag's two colours (`colours.flag[0]` or `colours['flag-2'][0]` in `metadata.json`) for that player's.
- Units carry no player colour. The shield (`units/shield`, pure red) is recoloured with the player's colour and drawn at the unit's anchor.
- Cities have seven rows of styles: `stone-bronze`, `ancient-classical`, `far-east` and `medieval`, which a civilization starts in, then `early-industrial` and `modern`, which every civilization moves on to as it learns the advances. The game itself only reads the first six; `modern-alt` is on the sheet but unused. Each has four sizes, `0` to `3`, plain and `walled-0` to `walled-3`.
- The citizens come in four eras, `people/ancient`, `renaissance`, `industrial` and `modern`, each a 27×30 face: `happy`, `content`, `unhappy` and `angry`, each as `-male` and `-female` (`angry-female`), then the specialists `entertainer`, `tax-collector` and `scientist`. The game alternates men and women along the row of citizens. `people/small/` has the same eleven at 15×26, with no era. `PEOPLE.GIF` frames its cells in black, not the border colour.
- The resource icons come in two sizes: `icons/food`, `shield`, `trade`, `luxury`, `gold` and `science` are 14×14, and `icons/small/…` has the same six at 10×10. Unlike the other sheets, `ICONS.GIF` frames these cells in the first transparent colour rather than the border colour.
- `icons/research/0` to `3` and `icons/warming/0` to `3` are the research and global warming meters, 14×14, in the order the sheet has them.
- The improvements' and Wonders' pictures are 36×20: `buildings/…` in `@IMPROVE` order after "Nothing" (`buildings/palace` to `buildings/capitalization`), then `wonders/…` (`wonders/pyramids` to `wonders/cure-for-cancer`), each named as `toSlug` names its row in the original `RULES.TXT`. A scenario's renamed improvements keep these names.

## Not yet known

- Whether classic Civ2 uses the same layout. Test of Time does not.

## Tests

`npm test` runs against synthetic sheets made by the tests themselves, so CI needs no Civ2 files. To also check against a real copy, point `CIV2_PATH` at its directory:

- `CIV2_PATH=/path/to/civ2 npm test`

Never commit Civ2's files or anything extracted from them; `.gitignore` refuses the usual names.
