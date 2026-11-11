import { describe, expect, it } from 'vitest';
import { contactLink, isAllowedContactUrl, isPastMissionDay, sortHomeMissionDays } from './home';
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

describe('isAllowedContactUrl', () => {
  it('accepts web and email addresses only', () => {
    expect(isAllowedContactUrl('https://t.me/someone')).toBe(true);
    expect(isAllowedContactUrl('http://example.org')).toBe(true);
    expect(isAllowedContactUrl('mailto:someone@example.org')).toBe(true);
    expect(isAllowedContactUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedContactUrl('t.me/someone')).toBe(false);
    expect(isAllowedContactUrl('https://t.me/some one')).toBe(false);
  });
});

describe('contactLink', () => {
  it('shows the label linking to the address', () => {
    expect(contactLink(' @someone ', ' https://t.me/someone ')).toEqual({
      label: '@someone',
      href: 'https://t.me/someone',
    });
    expect(contactLink('Mission Day team', 'mailto:team@example.org')).toEqual({
      label: 'Mission Day team',
      href: 'mailto:team@example.org',
    });
  });

  it('shows a readable address when there is no label', () => {
    expect(contactLink('', 'https://t.me/someone')).toEqual({
      label: 't.me/someone',
      href: 'https://t.me/someone',
    });
    expect(contactLink('', 'mailto:team@example.org')).toEqual({
      label: 'team@example.org',
      href: 'mailto:team@example.org',
    });
  });

  it('shows the label alone when there is no usable address', () => {
    expect(contactLink('@someone on Telegram', '')).toEqual({
      label: '@someone on Telegram',
      href: null,
    });
    expect(contactLink('@someone', 'javascript:alert(1)')).toEqual({
      label: '@someone',
      href: null,
    });
  });

  it('returns null when there is no contact', () => {
    expect(contactLink('   ', '')).toBeNull();
    expect(contactLink('', 'javascript:alert(1)')).toBeNull();
  });
});
