import { describe, expect, it } from 'vitest';
import { biocardGeometry } from '../../../shared/biocard';
import { fractionToMm, missionPhotoDpi, mmToFraction, templateWarnings } from './biocards';

/**
 * Describes a template of a given size.
 *
 * @param width - Width in pixels.
 * @param height - Height in pixels.
 * @returns Its facts.
 */
function template(width: number, height: number) {
  return { width, height, geometry: biocardGeometry(width, height) };
}

const CARD = template(744, 1039);

describe('templateWarnings', () => {
  it('has nothing to say about a well-made pair', () => {
    // A 512 px photo over 600 px at 300 dpi prints at 256 dpi.
    const window = { x: 72, y: 40, width: 600, height: 600 };
    const facts = { front: CARD, back: CARD, window, photoSides: [512, 2048] };
    expect(templateWarnings(facts)).toEqual([]);
  });

  it('warns about proportions, sizes and a front without transparency', () => {
    const codes = templateWarnings({
      front: template(1000, 1000),
      back: CARD,
      window: null,
      photoSides: [],
    }).map((warning) => warning.code);
    expect(codes).toEqual(['frontProportions', 'sizesDiffer', 'noWindow']);
  });

  it('warns about a see-through part that is low or not square', () => {
    const window = { x: 0, y: 500, width: 744, height: 300 };
    const facts = { front: CARD, back: CARD, window, photoSides: [] };
    const codes = templateWarnings(facts).map((item) => item.code);
    expect(codes).toContain('windowNotTop');
    expect(codes).toContain('windowNotSquare');
  });

  it('warns about low resolution, giving the figure', () => {
    const small = template(372, 520);
    const warnings = templateWarnings({ front: small, back: small, window: null, photoSides: [] });
    expect(warnings[0]).toEqual({ code: 'lowResolution', params: { dpi: 150 } });
  });

  it('counts the photos that would print soft, giving the lowest figure', () => {
    const wide = { x: 0, y: 0, width: 744, height: 744 };
    const facts = { front: CARD, back: CARD, window: wide, photoSides: [512, 1500, 400] };
    expect(templateWarnings(facts).at(-1)).toEqual({
      code: 'lowPhotoResolution',
      params: { count: 2, dpi: 161 },
    });
    expect(templateWarnings({ ...facts, photoSides: [1500] })).toEqual([]);
  });
});

describe('missionPhotoDpi', () => {
  it('relates the photo to the printed width of the window', () => {
    const window = { x: 0, y: 0, width: 600, height: 600 };
    expect(missionPhotoDpi(window, 300, 512)).toBeCloseTo(256);
    expect(missionPhotoDpi(window, 300, 1200)).toBeCloseTo(600);
  });
});

describe('millimetres', () => {
  it('convert both ways', () => {
    expect(fractionToMm(0.5, 63)).toBe(31.5);
    expect(mmToFraction(31.5, 63)).toBe(0.5);
  });
});
