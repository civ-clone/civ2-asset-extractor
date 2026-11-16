import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { Sheet } from './lib/sheet';
import { execFileSync } from 'child_process';
import { expect } from 'chai';
import { join } from 'path';
import { tmpdir } from 'os';

// The command on a copy that has only the map sheets: blank synthetic sheets,
//  with no `ICONS.GIF`, `PEOPLE.GIF` or `RULES.TXT`.
describe('the command', function (): void {
  // Encoding a full-size sheet and running the command take a few seconds.
  this.timeout(30000);

  let directory = '',
    output = '';

  before((): void => {
    directory = mkdtempSync(join(tmpdir(), 'civ2-asset-extractor-'));
    output = join(directory, 'assets');

    const blank = new Sheet(640, 480).gif();

    ['TERRAIN1.GIF', 'TERRAIN2.GIF', 'UNITS.GIF', 'CITIES.GIF'].forEach(
      (file) => writeFileSync(join(directory, file), blank)
    );
  });

  after((): void => rmSync(directory, { recursive: true, force: true }));

  it('skips the optional sheets that are missing and extracts the rest', (): void => {
    const log = execFileSync(
      process.execPath,
      [join(__dirname, '..', 'cli.js'), directory, output],
      { encoding: 'utf8' }
    );

    expect(log).to.include('No PEOPLE.GIF, so skipping its sprites.');
    expect(log).to.include('No ICONS.GIF, so skipping its sprites.');
    expect(existsSync(join(output, 'people'))).to.equal(false);
    expect(existsSync(join(output, 'city', 'modern', '0.png'))).to.equal(true);
    expect(existsSync(join(output, 'metadata.json'))).to.equal(true);
  });
});
