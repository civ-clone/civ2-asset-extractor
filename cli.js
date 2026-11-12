#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const extractSprites_1 = require("./extractSprites");
const fs_1 = require("fs");
const path_1 = require("path");
const encodePng_1 = require("./lib/encodePng");
const rules_1 = require("./rules");
// Usage: civ2-asset-extractor [path to Civ2 directory] [output directory]
const [source = '.', output = './assets'] = process.argv.slice(2);
if (!(0, fs_1.existsSync)(source)) {
    console.error(`No such directory: ${source}`);
    process.exit(1);
}
const extractData = JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'extract-data.json')).toString()), 
// A CD or a copy from one can have lower-case names (`terrain1.gif`).
files = (0, fs_1.readdirSync)(source), find = (name) => {
    const file = files.find((file) => file.toUpperCase() === name.toUpperCase());
    return file ? (0, path_1.join)(source, file) : null;
}, missing = Object.keys(extractData.files).filter((file) => !find(file)), required = missing.filter((file) => !extractData.files[file].optional), rulesPath = find('RULES.TXT'), rules = rulesPath ? (0, fs_1.readFileSync)(rulesPath, 'latin1') : '', metadata = { anchors: {}, colours: {} };
if (required.length > 0) {
    console.error(`Missing from ${source}: ${required.join(', ')}.`);
    process.exit(1);
}
missing
    .filter((file) => !required.includes(file))
    .forEach((file) => console.log(`No ${file}, so skipping its sprites.`));
if (!rulesPath) {
    console.log('No RULES.TXT, so units keep their default names.');
}
Object.entries(extractData.files).forEach(([file, definition]) => {
    if (missing.includes(file)) {
        return;
    }
    const { sprites, colours } = (0, extractSprites_1.extractSprites)((0, fs_1.readFileSync)(find(file)), (0, rules_1.withUnitNames)(definition, rules), (message) => console.log(message));
    sprites.forEach(({ name, width, height, data, anchors }) => {
        const path = (0, path_1.join)(output, `${name}.png`);
        (0, fs_1.mkdirSync)((0, path_1.dirname)(path), { recursive: true });
        (0, fs_1.writeFileSync)(path, (0, encodePng_1.default)(width, height, data));
        if (anchors) {
            metadata.anchors[name] = anchors;
        }
    });
    if (colours) {
        metadata.colours = colours;
    }
    console.log(`Wrote ${sprites.length} sprites from ${file}.`);
});
(0, fs_1.mkdirSync)(output, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.join)(output, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
//# sourceMappingURL=cli.js.map