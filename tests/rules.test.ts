import { readSection, toSlug, withUnitNames } from '../rules';
import { FileDefinition } from '../extractSprites';
import { expect } from 'chai';

// A made-up rules file in RULES.TXT's shape: comments start with `;` and each
// section ends at the first blank line.
const rules = [
  ';',
  '; A comment',
  ';',
  '@UNITS',
  'Stone Thrower,  nil, 0, 1.,0',
  '; a comment inside the section',
  "Hill  Runner's Band, nil, 0, 1.,0",
  'Sky Barge,      nil, 1, 2.,0',
  '',
  '@TERRAIN',
  'Marsh, 1, 0',
].join('\r\n');

describe('toSlug', (): void => {
  it('lower-cases and joins words with single hyphens', (): void => {
    expect(toSlug("  Hill  Runner's Band ")).to.equal('hill-runner-s-band');
    expect(toSlug('A.E.G.I.S. Cruiser')).to.equal('a-e-g-i-s-cruiser');
  });
});

describe('readSection', (): void => {
  it("reads each line's first field up to the blank line, skipping comments", (): void => {
    expect(readSection(rules, '@UNITS')).to.deep.equal([
      'stone-thrower',
      'hill-runner-s-band',
      'sky-barge',
    ]);
  });

  it('reads a section that runs to the end of the file', (): void => {
    expect(readSection(rules, '@TERRAIN')).to.deep.equal(['marsh']);
  });

  it('gives nothing for a missing section', (): void => {
    expect(readSection(rules, '@ORDERS')).to.deep.equal([]);
  });
});

describe('withUnitNames', (): void => {
  const definition: FileDefinition = {
    grids: [
      {
        path: 'units/',
        x: 1,
        y: 1,
        width: 64,
        height: 48,
        columns: 9,
        markers: { '#0000ff': 'shield' },
        names: ['settlers', 'engineers', null, 'warriors'],
      },
      {
        path: 'units/',
        x: 586,
        y: 1,
        width: 12,
        height: 20,
        columns: 2,
        names: ['shield', 'shield-back'],
      },
    ],
  };

  it('names the unit cells in @UNITS order, keeping the rest', (): void => {
    const [units, shields] = withUnitNames(definition, rules).grids;

    expect(units.names).to.deep.equal([
      'stone-thrower',
      'hill-runner-s-band',
      'sky-barge',
      'warriors',
    ]);
    expect(shields.names).to.deep.equal(['shield', 'shield-back']);
  });

  it('keeps the default name when a unit has no slug or repeats one', (): void => {
    const [units] = withUnitNames(
      definition,
      ['@UNITS', 'Sky Barge, 0', '???, 0', 'sky barge, 0', 'Runner, 0'].join(
        '\n'
      )
    ).grids;

    expect(units.names).to.deep.equal([
      'sky-barge',
      'engineers',
      null,
      'runner',
    ]);
  });

  it('finds the unit grid whatever the case of its marker colour', (): void => {
    const [units] = withUnitNames(
      {
        grids: [
          {
            ...definition.grids[0],
            markers: { '#0000FF': 'shield' },
          },
        ],
      },
      rules
    ).grids;

    expect(units.names[0]).to.equal('stone-thrower');
  });

  it('changes nothing without a @UNITS section', (): void => {
    expect(withUnitNames(definition, '@TERRAIN\nMarsh')).to.equal(definition);
  });
});
