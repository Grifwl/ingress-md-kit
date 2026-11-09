import { describe, expect, it } from 'vitest';
import {
  fillLetterPlaceholders,
  languageOfProposalWord,
  parseProposalSegment,
  proposalPath,
  resolveLocalized,
} from './letter';

const TOKEN = 'AbCdEfGhIjKlMnOp-_12';

describe('proposal addresses', () => {
  it('uses the word of the letter language', () => {
    expect(proposalPath('example-2027', 'ca', TOKEN)).toBe(`/example-2027/proposta-${TOKEN}`);
    expect(proposalPath('example-2027', 'es', TOKEN)).toBe(`/example-2027/propuesta-${TOKEN}`);
    expect(proposalPath('example-2027', 'en', TOKEN)).toBe(`/example-2027/proposal-${TOKEN}`);
  });

  it.each(['proposta', 'propuesta', 'proposal'])('accepts the word %s', (word) => {
    expect(parseProposalSegment(`${word}-${TOKEN}`)).toEqual({ word, token: TOKEN });
  });

  it.each(['main.tsx', 'proposta-short', `other-${TOKEN}`, `proposta-${'a'.repeat(20)}/x`])(
    'rejects %s',
    (segment) => {
      expect(parseProposalSegment(segment)).toBeNull();
    },
  );

  it('finds the language of a word', () => {
    expect(languageOfProposalWord('propuesta')).toBe('es');
    expect(languageOfProposalWord('unknown')).toBe('en');
  });
});

describe('resolveLocalized', () => {
  it('prefers the requested language', () => {
    expect(resolveLocalized({ ca: 'Hola', en: 'Hello' }, 'ca')).toBe('Hola');
  });

  it('falls back to English, then to anything available', () => {
    expect(resolveLocalized({ ca: 'Hola', en: 'Hello' }, 'es')).toBe('Hello');
    expect(resolveLocalized({ ca: 'Hola' }, 'es')).toBe('Hola');
  });

  it('treats blank texts as missing', () => {
    expect(resolveLocalized({ ca: '  ', en: 'Hello' }, 'ca')).toBe('Hello');
    expect(resolveLocalized({}, 'ca')).toBe('');
  });
});

describe('fillLetterPlaceholders', () => {
  it('replaces every occurrence', () => {
    const values = { partner: 'The Museum', city: 'Example City' };
    expect(fillLetterPlaceholders('{partner}, {city}, {partner}', values)).toBe(
      'The Museum, Example City, The Museum',
    );
  });
});
