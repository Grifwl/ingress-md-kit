import { describe, expect, it } from 'vitest';
import { fillIntroPlaceholders, participantIntroText } from './participant';

const VALUES = { missions: 18, medal: 6 };

describe('fillIntroPlaceholders', () => {
  it('replaces every occurrence and leaves other braces alone', () => {
    expect(
      fillIntroPlaceholders('{missions} missions, {medal} for the medal, {city}', VALUES),
    ).toBe('18 missions, 6 for the medal, {city}');
    expect(fillIntroPlaceholders('{medal} of {missions}, {medal}', VALUES)).toBe('6 of 18, 6');
  });
});

describe('participantIntroText', () => {
  it("returns the text in the visitor's language, filled in", () => {
    expect(participantIntroText({ ca: 'Fes-ne {medal} de {missions}.' }, 'ca', VALUES)).toBe(
      'Fes-ne 6 de 18.',
    );
  });

  it('never falls back to another language', () => {
    expect(participantIntroText({ en: 'Only in English.' }, 'ca', VALUES)).toBeNull();
    expect(participantIntroText({ ca: '   ', en: 'Only in English.' }, 'ca', VALUES)).toBeNull();
  });
});
