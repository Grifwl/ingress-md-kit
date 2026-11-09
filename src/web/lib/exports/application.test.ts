import { describe, expect, it } from 'vitest';
import type { Mission, MissionDay, Partner } from '../../../shared/types';
import { buildApplicationBlocks } from './application';

const missionDay = {
  city: 'Example City',
  letter: { whyThisCity: { ca: 'Perquè {city} és bonica.' } },
  applicationTheme: 'Heritage',
  myMapsUrl: 'https://example.org/map',
  logoUrl: 'https://example.org/logo',
  team: {
    enlPoc: { codename: 'Green', contact: 'green@example.org' },
    resPoc: { codename: 'Blue', contact: '' },
    others: [],
  },
} as unknown as MissionDay;

const selected = [{ landmark: 'Bridge' }, { landmark: 'Tower' }] as Mission[];

/**
 * Builds the answers as a map.
 *
 * @param partner - The partner, or null.
 * @returns The text of each answer.
 */
function answers(partner: Partner | null): Record<string, string> {
  return Object.fromEntries(
    buildApplicationBlocks(missionDay, selected, partner, 'ca', 'Acceptat').map((block) => [
      block.key,
      block.text,
    ]),
  );
}

describe('buildApplicationBlocks', () => {
  it('fills every answer of the form', () => {
    expect(answers(null)).toEqual({
      whyThisCity: 'Perquè Example City és bonica.',
      theme: 'Heritage',
      attractions: 'Bridge\nTower',
      mapLink: 'https://example.org/map',
      logoLink: 'https://example.org/logo',
      pointsOfContact: 'ENL: Green (green@example.org)\nRES: Blue',
    });
  });

  it('adds the partner and its status when there is one', () => {
    expect(answers({ name: 'The Museum' } as Partner).partner).toBe('The Museum (Acceptat)');
  });
});
