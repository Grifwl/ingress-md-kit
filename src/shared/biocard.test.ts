import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BIOCARD_LAYOUT,
  biocardDescription,
  biocardFileName,
  biocardGeometry,
  biocardName,
  chosenBiocardKeys,
  collageCells,
  completeBiocardSettings,
  fitText,
  pointsToPixels,
  wrapText,
  type MeasureText,
} from './biocard';

// Every character is as wide as half the font size: easy to reason about.
const measure: MeasureText = (text, fontPx) => text.length * fontPx * 0.5;

describe('biocardGeometry', () => {
  it('reads a card without cut margin at 300 dpi', () => {
    const geometry = biocardGeometry(744, 1039);
    expect(geometry.matchesCard).toBe(true);
    expect(geometry.bleedMm).toBe(0);
    expect(geometry.widthMm).toBe(63);
    expect(geometry.heightMm).toBe(88);
    expect(geometry.dpi).toBeCloseTo(300, 0);
  });

  it('works out a cut margin of 3 mm from the proportions alone', () => {
    // 69 × 94 mm at 300 dpi.
    const geometry = biocardGeometry(815, 1110);
    expect(geometry.matchesCard).toBe(true);
    expect(geometry.bleedMm).toBe(3);
    expect(geometry.widthMm).toBe(69);
    expect(geometry.dpi).toBeCloseTo(300, 0);
  });

  it('does not depend on the resolution', () => {
    expect(biocardGeometry(1630, 2220).bleedMm).toBe(3);
    expect(biocardGeometry(372, 520).bleedMm).toBe(0);
  });

  it('flags proportions that are not those of a card', () => {
    expect(biocardGeometry(1000, 1000).matchesCard).toBe(false);
    expect(biocardGeometry(500, 1000).matchesCard).toBe(false);
    expect(biocardGeometry(1039, 744).matchesCard).toBe(false);
  });
});

describe('pointsToPixels', () => {
  it('converts at the template resolution', () => {
    expect(pointsToPixels(12, 300)).toBe(50);
    expect(pointsToPixels(72, 150)).toBe(150);
  });
});

describe('wrapText', () => {
  it('fills lines word by word', () => {
    // 10 px font: 5 px per character, so 50 px hold 10 characters.
    expect(wrapText('one two three four', 50, 10, measure)).toEqual(['one two', 'three four']);
  });

  it('keeps the line breaks written in the text', () => {
    expect(wrapText('one\n\ntwo', 100, 10, measure)).toEqual(['one', '', 'two']);
  });

  it('cuts a word wider than the whole line', () => {
    expect(wrapText('abcdefghijkl x', 25, 10, measure)).toEqual(['abcde', 'fghij', 'kl x']);
  });
});

describe('fitText', () => {
  it('keeps the chosen size when the text fits', () => {
    const fitted = fitText('short', 100, 30, 20, 4, measure);
    expect(fitted.fits).toBe(true);
    expect(fitted.fontPx).toBe(20);
    expect(fitted.lines).toEqual(['short']);
  });

  it('shrinks the text until it fits the box', () => {
    const fitted = fitText('a rather long name for a card', 100, 30, 20, 4, measure);
    expect(fitted.fits).toBe(true);
    expect(fitted.fontPx).toBeLessThan(20);
    expect(fitted.lines.length * fitted.fontPx * 1.2).toBeLessThanOrEqual(30);
  });

  it('reports a text that overflows even at the smallest size', () => {
    const fitted = fitText('x '.repeat(500), 20, 10, 20, 4, measure);
    expect(fitted.fits).toBe(false);
    expect(fitted.fontPx).toBe(4);
  });
});

describe('biocardDescription', () => {
  const text = { ca: 'Hola', en: 'Hello' };

  it('gives the chosen language alone', () => {
    expect(biocardDescription(text, 'ca', false)).toBe('Hola');
  });

  it('adds English after a blank line when asked', () => {
    expect(biocardDescription(text, 'ca', true)).toBe('Hola\n\nHello');
  });

  it('never repeats English', () => {
    expect(biocardDescription(text, 'en', true)).toBe('Hello');
    expect(biocardDescription({ en: 'Hello' }, 'ca', true)).toBe('Hello');
  });

  it('gives the local text alone when English is missing', () => {
    expect(biocardDescription({ ca: 'Hola' }, 'ca', true)).toBe('Hola');
  });
});

describe('biocardName', () => {
  it('prefers the name written for the card', () => {
    expect(biocardName({ landmark: 'Ajuntament de Girona', biocardName: 'Ajt. Girona' })).toBe(
      'Ajt. Girona',
    );
  });

  it('falls back to the landmark', () => {
    expect(biocardName({ landmark: 'Catedral', biocardName: '  ' })).toBe('Catedral');
  });
});

describe('biocardFileName', () => {
  it('numbers cards and names the side', () => {
    expect(biocardFileName(3, 'Catedral', 'front')).toBe('03 - Catedral - front.png');
    expect(biocardFileName(0, 'A/B: C', 'back')).toBe('00 - A B C - back.png');
    expect(biocardFileName(1, '', 'back')).toBe('01 - card - back.png');
  });
});

describe('completeBiocardSettings', () => {
  it('fills in what was never saved', () => {
    const settings = completeBiocardSettings({ layout: { name: { x: 0.5 } } } as never);
    expect(settings.layout.name.x).toBe(0.5);
    expect(settings.layout.name.fontSizePt).toBe(DEFAULT_BIOCARD_LAYOUT.name.fontSizePt);
    expect(settings.layout.description).toEqual(DEFAULT_BIOCARD_LAYOUT.description);
    expect(settings.withPartnerLogo).toBe(false);
  });
});

describe('collageCells', () => {
  const area = { x: 10, y: 20, width: 600, height: 600 };

  it('gives nothing for no photos', () => {
    expect(collageCells(0, area)).toEqual([]);
  });

  it('fills a square with a square grid', () => {
    const cells = collageCells(9, area);
    expect(cells).toHaveLength(9);
    expect(cells[0]).toEqual({ x: 10, y: 20, width: 200, height: 200 });
    expect(cells[8]).toEqual({ x: 410, y: 420, width: 200, height: 200 });
  });

  it('widens the cells of an incomplete last row to fill it', () => {
    const cells = collageCells(7, area);
    const lastRow = cells.filter((cell) => cell.y === cells.at(-1)!.y);
    expect(lastRow.length).toBeLessThan(cells.filter((cell) => cell.y === area.y).length);
    expect(lastRow[0]!.x).toBe(area.x);
    const last = lastRow.at(-1)!;
    expect(last.x + last.width).toBeCloseTo(area.x + area.width, 5);
  });

  it('keeps cells close to square in a wide area', () => {
    const cells = collageCells(3, { x: 0, y: 0, width: 600, height: 200 });
    expect(cells.map((cell) => cell.x)).toEqual([0, 200, 400]);
    expect(cells[0]!.height).toBe(200);
  });

  it('lays out a full Mission Day of 24 in a near-square grid', () => {
    const cells = collageCells(24, area);
    expect(cells[0]!.width).toBe(120);
    expect(cells[0]!.height).toBe(120);
  });
});

describe('chosenBiocardKeys', () => {
  const missions = [
    { id: 'a', selected: true },
    { id: 'b', selected: false },
  ];

  it('defaults to the Mission Day card and every selected mission', () => {
    expect([...chosenBiocardKeys({ cards: null }, missions)]).toEqual(['generic', 'a']);
  });

  it('follows the ticks once they have been changed', () => {
    expect([...chosenBiocardKeys({ cards: ['b'] }, missions)]).toEqual(['b']);
    expect(chosenBiocardKeys({ cards: [] }, missions).size).toBe(0);
  });
});
