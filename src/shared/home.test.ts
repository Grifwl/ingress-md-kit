import { describe, expect, it } from 'vitest';
import { contactLink, isPastMissionDay, sortHomeMissionDays } from './home';
import type { HomeMissionDay } from './types';

const TODAY = '2027-05-10';

describe('isPastMissionDay', () => {
  it('follows the date, keeping the day itself as upcoming', () => {
    expect(isPastMissionDay({ year: 2027, date: '2027-05-09', status: 'approved' }, TODAY)).toBe(
      true,
    );
    expect(isPastMissionDay({ year: 2027, date: TODAY, status: 'approved' }, TODAY)).toBe(false);
    expect(isPastMissionDay({ year: 2027, date: '2027-06-01', status: 'approved' }, TODAY)).toBe(
      false,
    );
  });

  it('treats a Mission Day marked as done as past, whatever its date', () => {
    expect(isPastMissionDay({ year: 2027, date: '2027-06-01', status: 'done' }, TODAY)).toBe(true);
  });

  it('uses the year when there is no date', () => {
    expect(isPastMissionDay({ year: 2026, date: null, status: 'approved' }, TODAY)).toBe(true);
    expect(isPastMissionDay({ year: 2027, date: null, status: 'approved' }, TODAY)).toBe(false);
  });
});

describe('sortHomeMissionDays', () => {
  /**
   * Builds a listed Mission Day.
   *
   * @param slug - Its slug, also used as city.
   * @param year - Its year.
   * @param date - Its date.
   * @param past - Whether it is over.
   * @returns The Mission Day.
   */
  function day(slug: string, year: number, date: string | null, past: boolean): HomeMissionDay {
    return { slug, city: slug, year, date, past };
  }

  it('puts the soonest upcoming first and the most recent past first', () => {
    const sorted = sortHomeMissionDays([
      day('old', 2025, '2025-04-01', true),
      day('undated', 2027, null, false),
      day('later', 2027, '2027-09-01', false),
      day('recent', 2026, '2026-10-01', true),
      day('soon', 2027, '2027-06-01', false),
      day('next-year', 2028, null, false),
    ]);
    expect(sorted.map((item) => item.slug)).toEqual([
      'soon',
      'later',
      'undated',
      'next-year',
      'recent',
      'old',
    ]);
  });
});

describe('contactLink', () => {
  it('links email addresses and web addresses', () => {
    expect(contactLink(' someone@example.org ')).toEqual({
      label: 'someone@example.org',
      href: 'mailto:someone@example.org',
    });
    expect(contactLink('https://t.me/someone')).toEqual({
      label: 't.me/someone',
      href: 'https://t.me/someone',
    });
  });

  it('never links other schemes', () => {
    expect(contactLink('javascript:alert(1)')).toEqual({
      label: 'javascript:alert(1)',
      href: null,
    });
    expect(contactLink('@someone on Telegram')).toEqual({
      label: '@someone on Telegram',
      href: null,
    });
  });

  it('returns null when there is no contact', () => {
    expect(contactLink('   ')).toBeNull();
  });
});
