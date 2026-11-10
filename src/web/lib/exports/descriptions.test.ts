import { describe, expect, it } from 'vitest';
import { MISSION_DESCRIPTION_MAX_LENGTH } from '../../../shared/rules';
import { exportedDescriptions } from './descriptions';

/**
 * Builds the part of a mission that matters here.
 *
 * @param description - Text per language.
 * @returns The mission.
 */
function mission(description: Record<string, string>) {
  return { description };
}

/**
 * Builds a text of an exact length.
 *
 * @param length - Number of characters.
 * @returns The text.
 */
function textOf(length: number): string {
  return 'x'.repeat(length);
}

// The separator takes two characters, so these two add up to the limit.
const FITS_LOCAL = textOf(MISSION_DESCRIPTION_MAX_LENGTH - 100);
const FITS_ENGLISH = textOf(98);

describe('exportedDescriptions', () => {
  it('uses only English when that is the chosen language', () => {
    const missions = [mission({ ca: 'Un passeig.', en: 'A walk.' })];
    expect(exportedDescriptions(missions, 'en')).toEqual(['A walk.']);
  });

  it('puts the chosen language first and separates it with a blank line', () => {
    const missions = [mission({ ca: 'Un passeig.', en: 'A walk.' })];
    expect(exportedDescriptions(missions, 'ca')).toEqual(['Un passeig.\n\nA walk.']);
  });

  it('joins them when the result is exactly at the limit', () => {
    const [text] = exportedDescriptions([mission({ ca: FITS_LOCAL, en: FITS_ENGLISH })], 'ca');
    expect(text).toBe(`${FITS_LOCAL}\n\n${FITS_ENGLISH}`);
    expect([...text!]).toHaveLength(MISSION_DESCRIPTION_MAX_LENGTH);
  });

  it('counts accents and emoji as one character each', () => {
    const local = '😀'.repeat(MISSION_DESCRIPTION_MAX_LENGTH - 100);
    const [text] = exportedDescriptions([mission({ ca: local, en: FITS_ENGLISH })], 'ca');
    expect(text).toBe(`${local}\n\n${FITS_ENGLISH}`);
  });

  it('leaves every mission in the chosen language when one does not fit', () => {
    const tooLong = `${FITS_ENGLISH}x`;
    const missions = [
      mission({ ca: 'Un passeig.', en: 'A walk.' }),
      mission({ ca: FITS_LOCAL, en: tooLong }),
    ];
    expect(exportedDescriptions(missions, 'ca')).toEqual(['Un passeig.', FITS_LOCAL]);
  });

  it('leaves every mission in the chosen language when one has no English', () => {
    const missions = [mission({ ca: 'Un passeig.', en: 'A walk.' }), mission({ ca: 'Un altre.' })];
    expect(exportedDescriptions(missions, 'ca')).toEqual(['Un passeig.', 'Un altre.']);
  });

  it('never repeats English when the chosen language is missing', () => {
    const missions = [mission({ en: 'A walk.' }), mission({ es: 'Un paseo.', en: 'A stroll.' })];
    expect(exportedDescriptions(missions, 'es')).toEqual(['A walk.', 'Un paseo.']);
  });

  it('does not count surrounding spaces against the limit', () => {
    const [text] = exportedDescriptions(
      [mission({ ca: `  ${FITS_LOCAL}  `, en: ` ${FITS_ENGLISH}\n` })],
      'ca',
    );
    expect(text).toBe(`${FITS_LOCAL}\n\n${FITS_ENGLISH}`);
  });
});
