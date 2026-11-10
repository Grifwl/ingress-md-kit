import { describe, expect, it } from 'vitest';
import type { Mission, MissionDay, Partner } from '../../../shared/types';
import { buildApplicationBlocks } from './application';

const SAMPLE_URL = 'https://md.example.org/example-2027/sample';

const missionDay = {
  city: 'Example City',
  letter: { whyThisCity: { ca: 'Perquè {city} és bonica.', en: 'Because {city} is lovely.' } },
  applicationTheme: 'Heritage',
  applicationDifference: '',
  myMapsUrl: 'https://example.org/map',
  team: {
    enlPoc: { codename: 'Green', email: 'g@example.org', contact: '@green', backupContact: 'g2' },
    resPoc: { codename: 'Blue', email: 'b@example.org', contact: '@blue', backupContact: 'b2' },
    others: [],
  },
} as unknown as MissionDay;

const selected = [{ landmark: 'Bridge' }, { landmark: 'Tower' }] as Mission[];

/**
 * Builds the answers as a map.
 *
 * @param partner - The partner, or null.
 * @param day - The Mission Day to use.
 * @returns The text of each answer.
 */
function answers(partner: Partner | null, day: MissionDay = missionDay): Record<string, string> {
  return Object.fromEntries(
    buildApplicationBlocks(day, selected, partner, 'In talks', SAMPLE_URL).map((block) => [
      block.key,
      block.text,
    ]),
  );
}

describe('buildApplicationBlocks', () => {
  it('fills every answer of the form', () => {
    expect(answers(null)).toEqual({
      whyThisCity: 'Because Example City is lovely.',
      theme: 'Heritage',
      attractions: 'Bridge\nTower',
      mapLink: 'https://example.org/map',
      logoLink: SAMPLE_URL,
      pointsOfContact:
        'ENL codename: Green\nEmail: g@example.org\nPrimary contact: @green\nBackup contact: g2\n\n' +
        'RES codename: Blue\nEmail: b@example.org\nPrimary contact: @blue\nBackup contact: b2',
    });
  });

  it('names the partner and how far the talks have got', () => {
    expect(answers({ name: 'The Museum' } as Partner).partner).toBe('The Museum (In talks)');
  });

  it('falls back to another language when there is no English text', () => {
    const day = {
      ...missionDay,
      letter: { whyThisCity: { ca: 'Perquè {city} és bonica.' } },
    } as unknown as MissionDay;
    expect(answers(null, day).whyThisCity).toBe('Perquè Example City és bonica.');
  });

  it('adds what makes it different only when there is something to say', () => {
    expect(answers(null)).not.toHaveProperty('difference');
    const day = { ...missionDay, applicationDifference: 'New routes.' };
    expect(answers(null, day).difference).toBe('New routes.');
  });
});
