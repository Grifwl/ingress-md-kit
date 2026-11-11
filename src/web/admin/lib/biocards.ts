/**
 * Pure rules of the Biocards screen: what to warn about in the uploaded
 * templates. Warnings never block anything, like every other check.
 */
import type { BiocardGeometry, Rect } from '../../../shared/biocard';

/** Resolution below which printed cards start to look soft. */
export const BIOCARD_GOOD_DPI = 250;

/** How far from square the see-through part may be before it is mentioned. */
const WINDOW_ASPECT_TOLERANCE = 0.2;

/** Share of the height under which the see-through part counts as "at the top". */
const WINDOW_TOP_SHARE = 0.15;

/** A problem worth mentioning about the templates. */
export interface TemplateWarning {
  code:
    | 'frontProportions'
    | 'backProportions'
    | 'sizesDiffer'
    | 'noWindow'
    | 'windowNotTop'
    | 'windowNotSquare'
    | 'lowResolution'
    | 'lowPhotoResolution';
  params?: Record<string, number>;
}

/** What the screen knows about the uploaded templates. */
export interface TemplateFacts {
  front: { width: number; height: number; geometry: BiocardGeometry };
  back: { width: number; height: number; geometry: BiocardGeometry };
  window: Rect | null;
  /**
   * Side in pixels of the photo of each chosen mission card: the
   * full-quality copy when there is one, 512 px otherwise.
   */
  photoSides: readonly number[];
}

/**
 * Works out the print resolution of a mission photo on a card: its
 * pixels spread over the printed width of the see-through part.
 *
 * @param window - See-through part of the front, in its pixels.
 * @param dpi - Resolution of the front.
 * @param photoSide - Side of the photo, in pixels.
 * @returns Resolution of the photo once printed.
 */
export function missionPhotoDpi(window: Rect, dpi: number, photoSide: number): number {
  return photoSide / (window.width / dpi);
}

/**
 * Lists what may go wrong when printing with these templates.
 *
 * @param facts - Sizes, physical reading and see-through part.
 * @returns The warnings, in the order they are best read.
 */
export function templateWarnings(facts: TemplateFacts): TemplateWarning[] {
  const warnings: TemplateWarning[] = [];
  const { front, back, window } = facts;
  if (!front.geometry.matchesCard) {
    warnings.push({ code: 'frontProportions' });
  }
  if (!back.geometry.matchesCard) {
    warnings.push({ code: 'backProportions' });
  }
  if (front.width !== back.width || front.height !== back.height) {
    warnings.push({ code: 'sizesDiffer' });
  }
  const lowest = Math.min(front.geometry.dpi, back.geometry.dpi);
  if (lowest < BIOCARD_GOOD_DPI) {
    warnings.push({ code: 'lowResolution', params: { dpi: Math.round(lowest) } });
  }
  if (window === null) {
    warnings.push({ code: 'noWindow' });
    return warnings;
  }
  if (window.y > front.height * WINDOW_TOP_SHARE) {
    warnings.push({ code: 'windowNotTop' });
  }
  if (Math.abs(window.width / window.height - 1) > WINDOW_ASPECT_TOLERANCE) {
    warnings.push({ code: 'windowNotSquare' });
  }
  const soft = facts.photoSides
    .map((side) => missionPhotoDpi(window, front.geometry.dpi, side))
    .filter((photoDpi) => photoDpi < BIOCARD_GOOD_DPI);
  if (soft.length > 0) {
    warnings.push({
      code: 'lowPhotoResolution',
      params: { count: soft.length, dpi: Math.round(Math.min(...soft)) },
    });
  }
  return warnings;
}

/**
 * Converts a fraction of the template into millimetres, for display.
 *
 * @param fraction - Position or size as a fraction of the template.
 * @param sizeMm - Printed size of the template on that axis.
 * @returns Millimetres, to one decimal.
 */
export function fractionToMm(fraction: number, sizeMm: number): number {
  return Math.round(fraction * sizeMm * 10) / 10;
}

/**
 * Converts millimetres typed by an organiser into a fraction of the template.
 *
 * @param mm - Millimetres.
 * @param sizeMm - Printed size of the template on that axis.
 * @returns The fraction.
 */
export function mmToFraction(mm: number, sizeMm: number): number {
  return mm / sizeMm;
}
