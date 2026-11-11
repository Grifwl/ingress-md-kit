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
    expect(templateWarnings({ front: CARD, back: CARD, window })).toEqual([]);
  });

  it('warns about proportions, sizes and a front without transparency', () => {
    const codes = templateWarnings({
      front: template(1000, 1000),
      back: CARD,
      window: null,
    }).map((warning) => warning.code);
    expect(codes).toEqual(['frontProportions', 'sizesDiffer', 'noWindow']);
  });

  it('warns about a see-through part that is low or not square', () => {
    const window = { x: 0, y: 500, width: 744, height: 300 };
    const codes = templateWarnings({ front: CARD, back: CARD, window }).map((item) => item.code);
    expect(codes).toContain('windowNotTop');
    expect(codes).toContain('windowNotSquare');
  });

  it('warns about low resolution, giving the figure', () => {
    const small = template(372, 520);
    const warnings = templateWarnings({ front: small, back: small, window: null });
    expect(warnings[0]).toEqual({ code: 'lowResolution', params: { dpi: 150 } });

    const wide = { x: 0, y: 0, width: 744, height: 744 };
    const photo = templateWarnings({ front: CARD, back: CARD, window: wide }).at(-1);
    expect(photo).toEqual({ code: 'lowPhotoResolution', params: { dpi: 206 } });
  });
});

describe('missionPhotoDpi', () => {
  it('relates the photo to the printed width of the window', () => {
    expect(missionPhotoDpi({ x: 0, y: 0, width: 600, height: 600 }, 300)).toBeCloseTo(256);
  });
});

describe('millimetres', () => {
  it('convert both ways', () => {
    expect(fractionToMm(0.5, 63)).toBe(31.5);
    expect(mmToFraction(31.5, 63)).toBe(0.5);
  });
});
