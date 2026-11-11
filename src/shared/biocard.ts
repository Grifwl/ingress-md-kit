/**
 * Biocards: printed cards that remember an event, here one per mission
 * and one for the Mission Day as a whole. Organisers upload a ready-made
 * front and back template; the tool only adds the dynamic part, which is
 * the photo, the name and the description.
 *
 * Everything here is pure so that the Worker can validate settings with
 * it and the browser can lay out cards with it, and both can be tested.
 */
import { resolveLocalized } from './letter';
import type { Language } from './rules';
import type { LocalizedText } from './types';

/** Size of a printed card once cut, in millimetres (standard trading card). */
export const BIOCARD_TRIM_MM = { width: 63, height: 88 } as const;

/**
 * Largest cut margin recognised, in millimetres per side. Printers ask for
 * 2 to 5 mm; anything far beyond means the template has other proportions.
 */
export const BIOCARD_MAX_BLEED_MM = 10;

/** Largest side of a template, in pixels; 5000 px is over 1400 dpi at card size. */
export const BIOCARD_TEMPLATE_MAX_PX = 5000;

/** Largest font file accepted, in bytes. */
export const BIOCARD_FONT_MAX_BYTES = 2 * 1024 * 1024;

/** Smallest font size text may shrink to before it is left overflowing. */
export const BIOCARD_MIN_FONT_PT = 4;

/** Distance between two lines, as a multiple of the font size. */
export const BIOCARD_LINE_HEIGHT = 1.2;

/** Points per inch, the unit font sizes are given in. */
const POINTS_PER_INCH = 72;

/** Millimetres per inch. */
const MM_PER_INCH = 25.4;

/** Horizontal alignment of a text box. */
export type BiocardTextAlign = 'left' | 'center' | 'right';

/** Vertical alignment of a text box. */
export type BiocardVerticalAlign = 'top' | 'middle' | 'bottom';

/** Horizontal alignments, for validation and for the editor's options. */
export const BIOCARD_TEXT_ALIGNS: readonly BiocardTextAlign[] = ['left', 'center', 'right'];

/** Vertical alignments, for validation and for the editor's options. */
export const BIOCARD_VERTICAL_ALIGNS: readonly BiocardVerticalAlign[] = ['top', 'middle', 'bottom'];

/**
 * Where a text goes on a template and how it looks. Position and size are
 * fractions (0 to 1) of the template, so a box keeps its place when the
 * template is replaced by one of another resolution.
 */
export interface BiocardTextBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Size the text starts at; it shrinks by itself when it does not fit. */
  fontSizePt: number;
  /** Colour as `#rrggbb`. */
  colour: string;
  align: BiocardTextAlign;
  verticalAlign: BiocardVerticalAlign;
}

/** The two text boxes of a card: the name on the front, the description on the back. */
export interface BiocardLayout {
  name: BiocardTextBox;
  description: BiocardTextBox;
}

/**
 * Where the picture of the Mission Day's own card comes from: a photo
 * uploaded for it, or a collage of the photos of the selected missions.
 */
export type BiocardGenericPhoto = 'upload' | 'collage';

/** Sources of that picture, for validation and for the editor's options. */
export const BIOCARD_GENERIC_PHOTOS: readonly BiocardGenericPhoto[] = ['upload', 'collage'];

/** Everything about Biocards a Mission Day keeps besides its files. */
export interface BiocardSettings {
  layout: BiocardLayout;
  /** Name printed on the card of the Mission Day as a whole. */
  genericName: string;
  /** Where the picture of that card comes from. */
  genericPhoto: BiocardGenericPhoto;
  /** Description on the back of that card, per language. */
  genericDescription: LocalizedText;
  /**
   * Cards ticked in the list of cards: `generic` for the Mission Day's own
   * card, otherwise mission ids. Null until the organisers change the
   * ticks, meaning the Mission Day's card plus every selected mission.
   */
  cards: string[] | null;
  /**
   * Whether proposals show the ticked cards. Off by default because the
   * template may carry a partner's logo, which other partners should not
   * see before the organisers decide so.
   */
  showOnProposals: boolean;
  /** Whether the participant view shows the ticked cards. */
  showOnParticipantView: boolean;
}

/** Key of the Mission Day's own card among the ticked cards. */
export const BIOCARD_GENERIC_KEY = 'generic';

/** Which cards are ticked and where they are shown, saved apart from the rest. */
export type BiocardPublication = Pick<
  BiocardSettings,
  'cards' | 'showOnProposals' | 'showOnParticipantView'
>;

/**
 * Lists the keys of the ticked cards, applying the default when the
 * organisers never changed the ticks.
 *
 * @param settings - Biocard settings of the Mission Day.
 * @param missions - Its missions; only selection and ids are read.
 * @returns The keys of the ticked cards.
 */
export function chosenBiocardKeys(
  settings: Pick<BiocardSettings, 'cards'>,
  missions: readonly { id: string; selected: boolean }[],
): ReadonlySet<string> {
  if (settings.cards !== null) {
    return new Set(settings.cards);
  }
  return new Set([
    BIOCARD_GENERIC_KEY,
    ...missions.filter((mission) => mission.selected).map((mission) => mission.id),
  ]);
}

/** Layout of a new Mission Day: the name below a square photo, the description filling the back. */
export const DEFAULT_BIOCARD_LAYOUT: BiocardLayout = {
  name: {
    x: 0.08,
    y: 0.75,
    width: 0.84,
    height: 0.1,
    fontSizePt: 14,
    colour: '#ffffff',
    align: 'center',
    verticalAlign: 'middle',
  },
  description: {
    x: 0.1,
    y: 0.12,
    width: 0.8,
    height: 0.72,
    fontSizePt: 9,
    colour: '#ffffff',
    align: 'left',
    verticalAlign: 'top',
  },
};

/** Settings of a Mission Day that never saved any. */
export const DEFAULT_BIOCARD_SETTINGS: BiocardSettings = {
  layout: DEFAULT_BIOCARD_LAYOUT,
  genericName: '',
  genericPhoto: 'upload',
  genericDescription: {},
  cards: null,
  showOnProposals: false,
  showOnParticipantView: false,
};

/**
 * Fills in what stored settings lack, so that settings saved by an older
 * version, or never saved, always come out complete.
 *
 * @param stored - Decoded JSON, possibly partial.
 * @returns Complete settings.
 */
export function completeBiocardSettings(stored: Partial<BiocardSettings>): BiocardSettings {
  return {
    ...DEFAULT_BIOCARD_SETTINGS,
    ...stored,
    layout: {
      name: { ...DEFAULT_BIOCARD_LAYOUT.name, ...stored.layout?.name },
      description: { ...DEFAULT_BIOCARD_LAYOUT.description, ...stored.layout?.description },
    },
  };
}

/** Physical reading of a template, worked out from its size in pixels. */
export interface BiocardGeometry {
  /** Cut margin on each side, in millimetres. */
  bleedMm: number;
  /** Resolution the template has at its printed size. */
  dpi: number;
  /** Printed size of the whole template, cut margin included, in millimetres. */
  widthMm: number;
  heightMm: number;
  /** False when the proportions do not match a card with any sensible margin. */
  matchesCard: boolean;
}

/**
 * Reads the printed size of a template from its pixels. A card of
 * 63 × 88 mm with a margin of b mm per side measures (63 + 2b) × (88 + 2b),
 * so the proportions of the image alone tell the margin: solving
 * W / H = (63 + 2b) / (88 + 2b) for b. This is what lets organisers prepare
 * the template exactly as their printer asks, without any setting here.
 *
 * @param widthPx - Width of the template.
 * @param heightPx - Height of the template.
 * @returns Margin, resolution and printed size.
 */
export function biocardGeometry(widthPx: number, heightPx: number): BiocardGeometry {
  const ratio = widthPx / heightPx;
  const { width, height } = BIOCARD_TRIM_MM;
  const exact = (height * ratio - width) / (2 * (1 - ratio));
  // Pixels are whole numbers, so a margin of a few hundredths of a
  // millimetre is only rounding: half millimetres are what printers use.
  const bleedMm = Math.round(exact * 2) / 2;
  const matchesCard = ratio < 1 && exact > -0.5 && exact <= BIOCARD_MAX_BLEED_MM;
  const usedBleed = matchesCard ? Math.max(0, bleedMm) : 0;
  const widthMm = width + 2 * usedBleed;
  return {
    bleedMm: usedBleed,
    dpi: (widthPx / widthMm) * MM_PER_INCH,
    widthMm,
    heightMm: height + 2 * usedBleed,
    matchesCard,
  };
}

/**
 * Converts a font size to pixels of a template.
 *
 * @param points - Size in points.
 * @param dpi - Resolution of the template.
 * @returns Size in pixels.
 */
export function pointsToPixels(points: number, dpi: number): number {
  return (points * dpi) / POINTS_PER_INCH;
}

/** Measures the width of a text at a font size, in pixels. */
export type MeasureText = (text: string, fontPx: number) => number;

/** A text laid out in a box. */
export interface FittedText {
  fontPx: number;
  lines: string[];
  /** False when even the smallest size overflows the box. */
  fits: boolean;
}

/**
 * Splits a word too long for a line into pieces that fit.
 *
 * @param word - The word.
 * @param maxWidth - Width of the line.
 * @param fontPx - Font size.
 * @param measure - Text measurer.
 * @returns The pieces, each fitting except a single character wider than the line.
 */
function breakWord(word: string, maxWidth: number, fontPx: number, measure: MeasureText): string[] {
  const pieces: string[] = [];
  let current = '';
  for (const character of word) {
    if (current !== '' && measure(current + character, fontPx) > maxWidth) {
      pieces.push(current);
      current = character;
    } else {
      current += character;
    }
  }
  if (current !== '') {
    pieces.push(current);
  }
  return pieces;
}

/**
 * Breaks a text into lines no wider than a box. Line breaks written by the
 * organisers are kept, so the two languages of a description stay apart.
 *
 * @param text - The text.
 * @param maxWidth - Width of the box.
 * @param fontPx - Font size.
 * @param measure - Text measurer.
 * @returns The lines.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  fontPx: number,
  measure: MeasureText,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter((word) => word !== '');
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const candidate = current === '' ? word : `${current} ${word}`;
      if (measure(candidate, fontPx) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current !== '') {
        lines.push(current);
      }
      // A word wider than the whole line is cut, rather than overflowing.
      const pieces =
        measure(word, fontPx) > maxWidth ? breakWord(word, maxWidth, fontPx, measure) : [word];
      lines.push(...pieces.slice(0, -1));
      current = pieces.at(-1) ?? '';
    }
    lines.push(current);
  }
  return lines;
}

/**
 * Lays out a text in a box, at the largest size up to the chosen one at
 * which it fits. Shrinking rather than cutting means a long name or a
 * description in two languages always stays complete.
 *
 * @param text - The text.
 * @param boxWidth - Width of the box, in pixels.
 * @param boxHeight - Height of the box, in pixels.
 * @param maxFontPx - Size chosen by the organisers, in pixels.
 * @param minFontPx - Smallest size allowed, in pixels.
 * @param measure - Text measurer.
 * @returns Lines and size.
 */
export function fitText(
  text: string,
  boxWidth: number,
  boxHeight: number,
  maxFontPx: number,
  minFontPx: number,
  measure: MeasureText,
): FittedText {
  /**
   * Lays out the text at one size.
   *
   * @param fontPx - Font size.
   * @returns The layout, and whether it fits.
   */
  const attempt = (fontPx: number): FittedText => {
    const lines = wrapText(text, boxWidth, fontPx, measure);
    const height = lines.length * fontPx * BIOCARD_LINE_HEIGHT;
    const widest = Math.max(0, ...lines.map((line) => measure(line, fontPx)));
    return { fontPx, lines, fits: height <= boxHeight && widest <= boxWidth };
  };

  // Steps of 3% make the search short and the size differences invisible.
  for (let fontPx = maxFontPx; fontPx > minFontPx; fontPx *= 0.97) {
    const result = attempt(fontPx);
    if (result.fits) {
      return result;
    }
  }
  return attempt(Math.min(minFontPx, maxFontPx));
}

/**
 * Builds the text of the back of a card: the chosen language and, when
 * asked and available, English after a blank line, as on mission
 * descriptions. Here the only limit is the room on the card.
 *
 * @param description - Text per language.
 * @param language - Chosen language.
 * @param withEnglish - Whether to add English after it.
 * @returns The text.
 */
export function biocardDescription(
  description: LocalizedText,
  language: Language,
  withEnglish: boolean,
): string {
  const local = resolveLocalized(description, language).trim();
  const english = description.en?.trim() ?? '';
  if (!withEnglish || language === 'en' || english === '' || english === local) {
    return local;
  }
  return local === '' ? english : `${local}\n\n${english}`;
}

/**
 * The name on the front of a mission's card: the one written for the card
 * when there is one, so that a long landmark can be shortened, and the
 * landmark otherwise. The city is part of the template.
 *
 * @param mission - The mission.
 * @returns The name.
 */
export function biocardName(mission: { landmark: string; biocardName: string }): string {
  const own = mission.biocardName.trim();
  return own === '' ? mission.landmark.trim() : own;
}

/** A rectangle, in pixels. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Lays out a collage of square photos in a rectangle. The number of
 * columns is the one that keeps cells closest to square for the shape of
 * the rectangle, so that cropping each photo to its cell loses little; an
 * incomplete last row has wider cells, so the collage never leaves a gap
 * where the card would show through.
 *
 * @param count - Number of photos.
 * @param area - Rectangle to fill.
 * @returns One cell per photo, in reading order.
 */
export function collageCells(count: number, area: Rect): Rect[] {
  if (count <= 0) {
    return [];
  }
  let best = { columns: 1, score: Infinity };
  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns);
    const aspect = area.width / columns / (area.height / rows);
    // Distance from a square cell, on a scale where 2:1 and 1:2 weigh the
    // same, plus a cost for every cell the last row lacks, since those
    // photos are widened to fill the row and lose more when cropped.
    const score = Math.abs(Math.log(aspect)) + (columns * rows - count) * 0.15;
    if (score < best.score) {
      best = { columns, score };
    }
  }
  const { columns } = best;
  const rows = Math.ceil(count / columns);
  const height = area.height / rows;
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const inRow = row === rows - 1 ? count - row * columns : columns;
    const width = area.width / inRow;
    return {
      x: area.x + column * width,
      y: area.y + row * height,
      width,
      height,
    };
  });
}

/** A side of a card. */
export type BiocardSide = 'front' | 'back';

/**
 * Names a card's image inside the ZIP, so that files sort by card and
 * each front comes right before its back.
 *
 * @param number - Position of the card; 0 for the Mission Day's own card.
 * @param name - Name on the card.
 * @param side - Which side.
 * @returns The file name.
 */
export function biocardFileName(number: number, name: string, side: BiocardSide): string {
  // Characters that some systems refuse in file names become spaces.
  const safe = name
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const label = safe === '' ? 'card' : safe;
  return `${String(number).padStart(2, '0')} - ${label} - ${side}.png`;
}
