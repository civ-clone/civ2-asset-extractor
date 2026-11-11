import { encodePng } from '../lib/encodePng';
import { expect } from 'chai';
import { inflateSync } from 'zlib';

const chunks = (png: Buffer) => {
  const result: { type: string; data: Buffer }[] = [];

  for (let offset = 8; offset < png.length; ) {
    const length = png.readUInt32BE(offset);

    result.push({
      type: png.toString('ascii', offset + 4, offset + 8),
      data: png.subarray(offset + 8, offset + 8 + length),
    });
    offset += length + 12;
  }

  return result;
};

describe('encodePng', (): void => {
  it('writes an 8-bit RGBA PNG holding the pixels row by row', (): void => {
    const rgba = Uint8ClampedArray.from([
        255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
        10, 11, 12,
      ]),
      png = encodePng(3, 2, rgba),
      [header, data, end] = chunks(png);

    expect([...png.subarray(0, 8)]).to.deep.equal([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(header.type).to.equal('IHDR');
    expect(header.data.readUInt32BE(0)).to.equal(3);
    expect(header.data.readUInt32BE(4)).to.equal(2);
    expect([header.data[8], header.data[9]]).to.deep.equal([8, 6]);
    expect(data.type).to.equal('IDAT');
    expect([...inflateSync(data.data)]).to.deep.equal([
      0,
      ...rgba.subarray(0, 12),
      0,
      ...rgba.subarray(12),
    ]);
    expect(end.type).to.equal('IEND');
  });

  it('reads from a view into a larger buffer', (): void => {
    const backing = new Uint8ClampedArray(12).fill(9),
      view = backing.subarray(4, 8);

    view.set([1, 2, 3, 4]);

    const [, data] = chunks(encodePng(1, 1, view));

    expect([...inflateSync(data.data)]).to.deep.equal([0, 1, 2, 3, 4]);
  });
});
