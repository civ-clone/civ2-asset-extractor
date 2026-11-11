#!/usr/bin/env node
import { ExtractData, Point, extractSprites } from './extractSprites';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import encodePng from './lib/encodePng';
import { withUnitNames } from './rules';

// Usage: civ2-asset-extractor [path to Civ2 directory] [output directory]
const [source = '.', output = './assets'] = process.argv.slice(2);

if (!existsSync(source)) {
  console.error(`No such directory: ${source}`);
  process.exit(1);
}

const extractData: ExtractData = JSON.parse(
    readFileSync(join(__dirname, 'extract-data.json')).toString()
  ),
  // A CD or a copy from one can have lower-case names (`terrain1.gif`).
  files = readdirSync(source),
  find = (name: string): string | null => {
    const file = files.find(
      (file) => file.toUpperCase() === name.toUpperCase()
    );

    return file ? join(source, file) : null;
  },
  missing = Object.keys(extractData.files).filter((file) => !find(file)),
  rulesPath = find('RULES.TXT'),
  rules = rulesPath ? readFileSync(rulesPath, 'latin1') : '',
  metadata: {
    anchors: { [name: string]: { [anchor: string]: Point } };
    colours: { [file: string]: unknown };
  } = { anchors: {}, colours: {} };

if (missing.length > 0) {
  console.error(`Missing from ${source}: ${missing.join(', ')}.`);
  process.exit(1);
}

if (!rulesPath) {
  console.log('No RULES.TXT, so units keep their default names.');
}

Object.entries(extractData.files).forEach(([file, definition]) => {
  const { sprites, colours } = extractSprites(
    readFileSync(find(file)!),
    withUnitNames(definition, rules),
    (message) => console.log(message)
  );

  sprites.forEach(({ name, width, height, data, anchors }) => {
    const path = join(output, `${name}.png`);

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, encodePng(width, height, data));

    if (anchors) {
      metadata.anchors[name] = anchors;
    }
  });

  if (colours) {
    metadata.colours = colours;
  }

  console.log(`Wrote ${sprites.length} sprites from ${file}.`);
});

mkdirSync(output, { recursive: true });
writeFileSync(
  join(output, 'metadata.json'),
  JSON.stringify(metadata, null, 2) + '\n'
);
