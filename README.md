# civ2-asset-extractor

Extracts the map graphics from a copy of Civilization II (tested with Multiplayer Gold Edition, patch 1.3) and writes them as `.png` files, named the Civ2 way. The art is copyrighted, so players supply their own files; nothing here contains any of it.

Needed files: `TERRAIN1.GIF`, `TERRAIN2.GIF`, `UNITS.GIF`, `CITIES.GIF`, plus `RULES.TXT` (optional) to name units.

Run:

- `npx civ2-asset-extractor <civ2 directory> [output directory]` (or `node cli.js …` in a checkout)

This writes the sprites and a `metadata.json` holding each unit's shield anchor, each city's flag and size-label anchors, and the player colours read from the flags.

`extractSprites` has no Node or `canvas` dependency: it returns RGBA data that a browser can put straight into `ImageData`. The package's `index` exports the library (`extractSprites`, `GifImage`, `withUnitNames`); `extract-data.json` describes where each sprite is on the sheets.

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

## Not yet known

- Whether classic Civ2 uses the same layout. Test of Time does not.

## Tests

`npm test` runs against synthetic sheets made by the tests themselves, so CI needs no Civ2 files. To also check against a real copy, point `CIV2_PATH` at its directory:

- `CIV2_PATH=/path/to/civ2 npm test`

Never commit Civ2's files or anything extracted from them; `.gitignore` refuses the usual names.
