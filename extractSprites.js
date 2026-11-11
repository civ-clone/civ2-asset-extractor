"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSprites = exports.extractFlagColours = exports.extractGrid = exports.specialIndices = void 0;
const GifImage_1 = require("./GifImage");
const toHex = ([r, g, b]) => '#' + [r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('');
// `RULES.TXT` documents the last three palette entries as two transparent
// colours either side of the border colour. Reading them by index copes with
// sheets that recolour them.
const specialIndices = (image) => {
    const size = image.palette().length;
    return {
        transparent: [size - 3, size - 1],
        border: size - 2,
    };
};
exports.specialIndices = specialIndices;
// Civ2's sheets have a 256-colour palette, and every cell (with the border
//  above and to the left that holds its markers) inside the image. A sheet
//  that isn't laid out that way is refused rather than cut up wrongly.
const checkGrid = (image, grid) => {
    var _a, _b;
    const stepX = (_a = grid.stepX) !== null && _a !== void 0 ? _a : grid.width + 1, stepY = (_b = grid.stepY) !== null && _b !== void 0 ? _b : grid.height + 1, rows = Math.ceil(grid.names.length / grid.columns), columns = Math.min(grid.columns, grid.names.length), right = grid.x + (columns - 1) * stepX + grid.width, bottom = grid.y + (rows - 1) * stepY + grid.height;
    if (image.palette().length !== 256) {
        throw new TypeError(`Expected a 256-colour sheet, not ${image.palette().length} colours.`);
    }
    if (grid.x < 1 ||
        grid.y < 1 ||
        right > image.width() ||
        bottom > image.height()) {
        throw new TypeError(`The ${grid.path || 'sprite'} cells don't fit a ${image.width()}×${image.height()} sheet.`);
    }
};
const extractGrid = (image, grid) => {
    var _a, _b, _c, _d;
    checkGrid(image, grid);
    const { transparent, border } = (0, exports.specialIndices)(image), stepX = (_a = grid.stepX) !== null && _a !== void 0 ? _a : grid.width + 1, stepY = (_b = grid.stepY) !== null && _b !== void 0 ? _b : grid.height + 1, clear = ((_c = grid.clear) !== null && _c !== void 0 ? _c : []).map((hex) => hex.toLowerCase()), markers = Object.fromEntries(Object.entries((_d = grid.markers) !== null && _d !== void 0 ? _d : {}).map(([hex, name]) => [
        hex.toLowerCase(),
        name,
    ]));
    return grid.names.flatMap((name, cell) => {
        if (name === null) {
            return [];
        }
        const originX = grid.x + (cell % grid.columns) * stepX, originY = grid.y + Math.floor(cell / grid.columns) * stepY, data = new Uint8ClampedArray(grid.width * grid.height * 4), anchors = {};
        for (let y = 0; y < grid.height; y++) {
            for (let x = 0; x < grid.width; x++) {
                const index = image.index(originX + x, originY + y);
                if (transparent.includes(index) ||
                    index === border ||
                    clear.includes(toHex(image.colour(index)))) {
                    continue;
                }
                data.set([...image.colour(index), 255], (y * grid.width + x) * 4);
            }
        }
        const readMarker = (x, y, axis) => {
            var _a;
            const index = image.index(x, y), marker = markers[toHex(image.colour(index))];
            if (index === border || !marker) {
                return;
            }
            (_a = anchors[marker]) !== null && _a !== void 0 ? _a : (anchors[marker] = { x: 0, y: 0 });
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
exports.extractGrid = extractGrid;
// Each flag is drawn in two player colours plus a pole and outline that every
// flag shares. The two most common colours not shared by all flags are the
// player's.
const extractFlagColours = (image, flags) => {
    var _a;
    const { transparent, border } = (0, exports.specialIndices)(image), stepX = (_a = flags.stepX) !== null && _a !== void 0 ? _a : flags.width + 1, result = {};
    flags.rows.forEach(({ name, y: originY }) => {
        const counts = Array.from({ length: flags.count }, (_, flag) => {
            var _a;
            const count = new Map();
            for (let y = 0; y < flags.height; y++) {
                for (let x = 0; x < flags.width; x++) {
                    const index = image.index(flags.x + flag * stepX + x, originY + y);
                    if (!transparent.includes(index) && index !== border) {
                        count.set(index, ((_a = count.get(index)) !== null && _a !== void 0 ? _a : 0) + 1);
                    }
                }
            }
            return count;
        }), shared = [...counts[0].keys()].filter((index) => counts.every((count) => count.has(index)));
        result[name] = counts.map((count) => {
            const [primary, secondary] = [...count.entries()]
                .filter(([index]) => !shared.includes(index))
                .sort(([, a], [, b]) => b - a)
                .map(([index]) => image.colour(index));
            return { primary, secondary: secondary !== null && secondary !== void 0 ? secondary : primary };
        });
    });
    return result;
};
exports.extractFlagColours = extractFlagColours;
const extractSprites = (bytes, definition, logger = () => undefined) => {
    const image = GifImage_1.default.fromBytes(bytes), sprites = definition.grids.flatMap((grid) => {
        logger(`Processing ${grid.path}...`);
        return (0, exports.extractGrid)(image, grid);
    });
    return {
        sprites,
        ...(definition.flags
            ? { colours: (0, exports.extractFlagColours)(image, definition.flags) }
            : {}),
    };
};
exports.extractSprites = extractSprites;
exports.default = exports.extractSprites;
//# sourceMappingURL=extractSprites.js.map