import {
  UnitFlag,
  cosmicLimits,
  improvementCount,
  isAdvanceAvailable,
  isUnitAvailable,
  readCivilize,
  readCosmic,
  readDifficulty,
  readEndWonder,
  readGovernments,
  readImprovements,
  readLeaders,
  readTerrain,
  readUnits,
  terrainCount,
  wonderCount,
} from '../rules';
import { expect } from 'chai';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

// Parses the `RULES.TXT` of a real copy of Civilization II (Multiplayer Gold
//  Edition 1.3) when `CIV2_PATH` points at its directory. Its contents are
//  copyrighted, so this checks only the shape and counts of what is read; CI
//  has no copy and skips it.
const source = process.env.CIV2_PATH;

(source ? describe : describe.skip)("a real copy's RULES.TXT", (): void => {
  let rules = '';

  before(function (): void {
    const path = join(source!, 'RULES.TXT');

    if (!existsSync(path)) {
      this.skip();
    }

    rules = readFileSync(path, 'latin1');
  });

  it('reads all 22 @COSMIC values, within their limits once effective', (): void => {
    const { raw, effective } = readCosmic(rules);

    expect(Object.keys(raw)).to.have.length(22);
    (Object.keys(cosmicLimits) as (keyof typeof raw)[]).forEach((key) => {
      const [min, max] = cosmicLimits[key];

      expect(raw[key], key).to.be.a('number');
      expect(effective[key], key).to.be.within(min, max);
    });
    expect(effective.foodBoxRows % 2).to.equal(0);
  });

  it('reads 100 advance rows, 89 of them available', (): void => {
    const advances = readCivilize(rules);

    expect(advances).to.have.length(100);
    expect(advances.filter(isAdvanceAvailable)).to.have.length(89);
    advances.forEach(({ name, epoch, category, prerequisites }) => {
      expect(name).to.not.equal('');
      expect(epoch, name).to.be.within(0, 3);
      expect(category, name).to.be.within(0, 4);
      prerequisites.forEach((prerequisite) =>
        expect(prerequisite, name).to.match(/^[A-Za-z0-9]{1,3}$/)
      );
    });
  });

  it('reads 67 improvements and wonders, and 28 wonder expiries', (): void => {
    const improvements = readImprovements(rules);

    expect(improvements).to.have.length(improvementCount + wonderCount);
    expect(improvementCount + wonderCount).to.equal(67);
    improvements.forEach(({ name, cost, prerequisite }) => {
      expect(cost, name).to.be.above(0);
      expect(prerequisite, name).to.match(/^[A-Za-z0-9]{1,3}$/);
    });
    expect(readEndWonder(rules)).to.have.length(28);
  });

  it('reads 62 unit rows, 51 of them available', (): void => {
    const units = readUnits(rules),
      allFlags = Object.values(UnitFlag)
        .filter((value): value is number => typeof value === 'number')
        .reduce((all, flag) => all | flag, 0);

    expect(units).to.have.length(62);
    expect(units.filter(isUnitAvailable)).to.have.length(51);
    units.forEach(({ name, domain, role, cost, flags }) => {
      expect(name).to.not.equal('');
      expect(domain, name).to.be.within(0, 2);
      expect(role, name).to.be.within(0, 7);
      expect(cost, name).to.be.within(1, 200);
      expect(flags & ~allFlags, name).to.equal(0);
    });
  });

  it('reads the 33 terrain rows, the 11 terrains with all their fields', (): void => {
    const terrain = readTerrain(rules);

    expect(terrain).to.have.length(33);
    terrain.forEach(({ name, special, irrigation, mining, transform }, i) => {
      expect(name).to.not.equal('');

      if (i < terrainCount) {
        expect(special).to.equal(0);
        [irrigation, mining].forEach((change) => {
          expect(change!.result, name).to.not.equal('');
          expect(change!.aiGovernment, name).to.be.within(0, 6);
        });
        expect(transform, name).to.not.equal('');

        return;
      }

      expect([irrigation, mining, transform]).to.deep.equal([null, null, null]);
    });
  });

  it('reads 7 governments, 21 leaders and 6 difficulty levels', (): void => {
    expect(readGovernments(rules)).to.have.length(7);
    expect(readDifficulty(rules)).to.have.length(6);

    const leaders = readLeaders(rules);

    expect(leaders).to.have.length(21);
    leaders.forEach(({ plural, female, colour, cityStyle, titles }) => {
      expect(female, plural).to.be.within(0, 1);
      expect(colour, plural).to.be.within(1, 7);
      expect(cityStyle, plural).to.be.within(0, 3);
      titles.forEach(({ government, male, female }) => {
        expect(government, plural).to.be.within(1, 6);
        expect(male, plural).to.not.equal('');
        expect(female, plural).to.not.equal('');
      });
    });
  });
});
