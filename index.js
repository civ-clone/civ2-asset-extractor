"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;
// The library: `extractSprites` and the GIF decoder have no Node dependency, so
//  a browser can import them (and `extract-data.json`) directly. `cli.ts` is the
//  Node command that writes `.png` files.
__exportStar(require("./GifImage"), exports);
__exportStar(require("./extractSprites"), exports);
__exportStar(require("./rules"), exports);
var extractSprites_1 = require("./extractSprites");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return extractSprites_1.default; } });
//# sourceMappingURL=index.js.map