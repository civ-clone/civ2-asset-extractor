"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _a, _GifImage_height, _GifImage_palette, _GifImage_pixels, _GifImage_width, _GifImage_decompress;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GifImage = void 0;
// Civ2 marks transparency and the sprite grid by palette index, so this keeps
// the indices rather than decoding straight to RGB like a browser would.
class GifImage {
    constructor(width, height, palette, pixels) {
        _GifImage_height.set(this, void 0);
        _GifImage_palette.set(this, void 0);
        _GifImage_pixels.set(this, void 0);
        _GifImage_width.set(this, void 0);
        __classPrivateFieldSet(this, _GifImage_width, width, "f");
        __classPrivateFieldSet(this, _GifImage_height, height, "f");
        __classPrivateFieldSet(this, _GifImage_palette, palette, "f");
        __classPrivateFieldSet(this, _GifImage_pixels, pixels, "f");
    }
    static fromBytes(bytes) {
        const signature = String.fromCharCode(...bytes.subarray(0, 6));
        if (signature !== 'GIF87a' && signature !== 'GIF89a') {
            throw new TypeError(`Not a GIF file (${signature}).`);
        }
        // A half-copied file must fail, not leave the loops below reading
        //  `undefined` for ever.
        const need = (end) => {
            if (end > bytes.length) {
                throw new TypeError('Truncated GIF file.');
            }
        }, readUint16 = (offset) => bytes[offset] | (bytes[offset + 1] << 8), readPalette = (flags) => {
            const size = 2 << (flags & 7), palette = [];
            need(offset + size * 3);
            for (let i = 0; i < size; i++) {
                palette.push([
                    bytes[offset + i * 3],
                    bytes[offset + i * 3 + 1],
                    bytes[offset + i * 3 + 2],
                ]);
            }
            offset += size * 3;
            return palette;
        }, width = (need(13), readUint16(6)), height = readUint16(8), screenFlags = bytes[10];
        let offset = 13, palette = [];
        if (screenFlags & 0x80) {
            palette = readPalette(screenFlags);
        }
        // Skip any extension blocks until the first image descriptor.
        while ((need(offset + 1), bytes[offset]) !== 0x2c) {
            if (bytes[offset] !== 0x21) {
                throw new TypeError(`Unexpected GIF block 0x${bytes[offset].toString(16)}.`);
            }
            offset += 2;
            while ((need(offset + 1), bytes[offset]) !== 0) {
                offset += bytes[offset] + 1;
            }
            offset++;
        }
        need(offset + 11);
        const imageFlags = bytes[offset + 9];
        offset += 10;
        if (imageFlags & 0x80) {
            palette = readPalette(imageFlags);
        }
        if (imageFlags & 0x40) {
            throw new TypeError('Interlaced GIFs are not supported.');
        }
        const minimumCodeSize = bytes[offset++], data = [];
        while ((need(offset + 1), bytes[offset]) !== 0) {
            need(offset + 1 + bytes[offset]);
            data.push(...bytes.subarray(offset + 1, offset + 1 + bytes[offset]));
            offset += bytes[offset] + 1;
        }
        return new GifImage(width, height, palette, __classPrivateFieldGet(GifImage, _a, "m", _GifImage_decompress).call(GifImage, data, minimumCodeSize, width * height));
    }
    colour(index) {
        return __classPrivateFieldGet(this, _GifImage_palette, "f")[index];
    }
    height() {
        return __classPrivateFieldGet(this, _GifImage_height, "f");
    }
    index(x, y) {
        return __classPrivateFieldGet(this, _GifImage_pixels, "f")[y * __classPrivateFieldGet(this, _GifImage_width, "f") + x];
    }
    palette() {
        return __classPrivateFieldGet(this, _GifImage_palette, "f");
    }
    width() {
        return __classPrivateFieldGet(this, _GifImage_width, "f");
    }
}
exports.GifImage = GifImage;
_a = GifImage, _GifImage_height = new WeakMap(), _GifImage_palette = new WeakMap(), _GifImage_pixels = new WeakMap(), _GifImage_width = new WeakMap(), _GifImage_decompress = function _GifImage_decompress(data, minimumCodeSize, length) {
    const pixels = new Uint8Array(length), clearCode = 1 << minimumCodeSize, endCode = clearCode + 1;
    let bit = 0, codeSize = minimumCodeSize + 1, dictionary = [], previous = null, written = 0;
    const reset = () => {
        dictionary = [];
        for (let i = 0; i < clearCode; i++) {
            dictionary.push([i]);
        }
        dictionary.push([], []);
        codeSize = minimumCodeSize + 1;
        previous = null;
    }, read = () => {
        let value = 0;
        for (let i = 0; i < codeSize; i++, bit++) {
            value |= ((data[bit >> 3] >> (bit & 7)) & 1) << i;
        }
        return value;
    };
    reset();
    while (bit < data.length * 8) {
        const code = read();
        if (code === clearCode) {
            reset();
            continue;
        }
        if (code === endCode) {
            break;
        }
        // A code may be the one about to be defined (`previous` plus its own
        //  first value), but never one further on.
        if (code > dictionary.length ||
            (previous === null && code >= clearCode)) {
            throw new TypeError('Corrupt GIF image data.');
        }
        const entry = code < dictionary.length
            ? dictionary[code]
            : [...previous, previous[0]];
        pixels.set(entry.slice(0, length - written), written);
        written += entry.length;
        // Anything after the last pixel is not part of the image.
        if (written >= length) {
            break;
        }
        if (previous !== null && dictionary.length < 4096) {
            dictionary.push([...previous, entry[0]]);
            if (dictionary.length === 1 << codeSize && codeSize < 12) {
                codeSize++;
            }
        }
        previous = entry;
    }
    return pixels;
};
exports.default = GifImage;
//# sourceMappingURL=GifImage.js.map