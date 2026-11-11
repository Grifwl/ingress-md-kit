/**
 * Drawing of Biocards in the browser, like the mission images: the server
 * never processes images, and public visitors never write to storage.
 *
 * A front is drawn in three layers: the picture (a photo or a collage),
 * cut to the transparent part of the template; the template on top; and
 * the name. A back is the template with the description on top.
 */
import {
  BIOCARD_LINE_HEIGHT,
  BIOCARD_MIN_FONT_PT,
  biocardGeometry,
  collageCells,
  fitText,
  pointsToPixels,
  type BiocardGeometry,
  type BiocardLayout,
  type BiocardTextBox,
  type Rect,
} from '../../shared/biocard';
import defaultFontUrl from '../fonts/Coda-Regular.ttf?url';
import { withPixelDensity } from './pngDensity';

/** Alpha below which a pixel of the front counts as see-through. */
const TRANSPARENT_ALPHA = 128;

/** Family name the default font is registered under. */
const DEFAULT_FONT_FAMILY = 'MdKitBiocardDefault';

/** The two templates of a set of cards, decoded and measured. */
export interface BiocardTemplates {
  front: HTMLImageElement;
  back: HTMLImageElement;
  /** Physical reading of each template. */
  frontGeometry: BiocardGeometry;
  backGeometry: BiocardGeometry;
  /** Where the front is see-through, in its pixels; null when it is opaque. */
  window: Rect | null;
  /** Family of the font texts are written in. */
  fontFamily: string;
}

/** What shows through the front. */
export type BiocardPicture =
  { kind: 'photo'; url: string } | { kind: 'collage'; urls: readonly string[] } | null;

/** A drawn side of a card. */
export interface DrawnSide {
  canvas: HTMLCanvasElement;
  /** False when the text had to overflow its box even at the smallest size. */
  fits: boolean;
  dpi: number;
}

/**
 * Loads an image from this same site.
 *
 * @param url - Address of the image.
 * @returns The decoded image.
 */
export async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

// Fonts are registered once per address, so that redrawing a preview
// never downloads or registers the same font again.
const fonts = new Map<string, Promise<string>>();

/**
 * Registers a font with the page.
 *
 * @param url - Address of the font file.
 * @param family - Family name to give it.
 * @returns The family name.
 */
async function registerFont(url: string, family: string): Promise<string> {
  const face = new FontFace(family, `url("${url}")`);
  await face.load();
  document.fonts.add(face);
  return family;
}

/**
 * Makes the font of the cards available: the Mission Day's own one when
 * it has one, the default one otherwise. A font that cannot be loaded
 * falls back to the default one, and that one to the browser's sans-serif,
 * so that a card is always drawn.
 *
 * @param url - Address of the Mission Day's font, or null.
 * @returns The family name to use in canvas fonts.
 */
export function loadBiocardFont(url: string | null): Promise<string> {
  const key = url ?? defaultFontUrl;
  let loaded = fonts.get(key);
  if (loaded === undefined) {
    const fallback = () => (url === null ? 'sans-serif' : loadBiocardFont(null));
    loaded =
      url === null
        ? registerFont(defaultFontUrl, DEFAULT_FONT_FAMILY).catch(fallback)
        : registerFont(url, `MdKitBiocard${fonts.size}`).catch(fallback);
    fonts.set(key, loaded);
  }
  return loaded;
}

/**
 * Creates a canvas of a given size.
 *
 * @param width - Width in pixels.
 * @param height - Height in pixels.
 * @returns The canvas and its drawing context.
 */
function createCanvas(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Canvas is not available');
  }
  return { canvas, context };
}

/**
 * Finds the see-through part of a front template: the smallest rectangle
 * holding every transparent pixel. The picture is fitted to it, so the
 * template alone decides where the photo goes.
 *
 * @param image - The front template.
 * @returns The rectangle, or null when the template has no transparency.
 */
export function findTransparentWindow(image: HTMLImageElement): Rect | null {
  const { naturalWidth: width, naturalHeight: height } = image;
  const { context } = createCanvas(width, height);
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, width, height);
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (data[row + x * 4 + 3]! < TRANSPARENT_ALPHA) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        bottom = y;
      }
    }
  }
  return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * Loads both templates and the font, and measures them.
 *
 * @param frontUrl - Address of the front template.
 * @param backUrl - Address of the back template.
 * @param fontUrl - Address of the Mission Day's font, or null for the default.
 * @returns The templates, ready to draw cards.
 */
export async function loadBiocardTemplates(
  frontUrl: string,
  backUrl: string,
  fontUrl: string | null,
): Promise<BiocardTemplates> {
  const [front, back, fontFamily] = await Promise.all([
    loadImage(frontUrl),
    loadImage(backUrl),
    loadBiocardFont(fontUrl),
  ]);
  return {
    front,
    back,
    frontGeometry: biocardGeometry(front.naturalWidth, front.naturalHeight),
    backGeometry: biocardGeometry(back.naturalWidth, back.naturalHeight),
    window: findTransparentWindow(front),
    fontFamily,
  };
}

/**
 * Draws an image so that it covers a rectangle, cropping what overflows
 * around the centre, the way a square photo fills a frame of other shape.
 *
 * @param context - Drawing context.
 * @param image - The image.
 * @param area - Rectangle to cover.
 */
function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, area: Rect): void {
  const scale = Math.max(area.width / image.naturalWidth, area.height / image.naturalHeight);
  const sourceWidth = area.width / scale;
  const sourceHeight = area.height / scale;
  context.drawImage(
    image,
    (image.naturalWidth - sourceWidth) / 2,
    (image.naturalHeight - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    area.x,
    area.y,
    area.width,
    area.height,
  );
}

/**
 * Draws the picture of a front inside the see-through part. Photos that
 * cannot be loaded leave their place empty rather than stop the card.
 *
 * @param context - Drawing context.
 * @param picture - What to draw.
 * @param window - The see-through part.
 */
async function drawPicture(
  context: CanvasRenderingContext2D,
  picture: BiocardPicture,
  window: Rect,
): Promise<void> {
  if (picture === null) {
    return;
  }
  const urls = picture.kind === 'photo' ? [picture.url] : picture.urls;
  const cells = picture.kind === 'photo' ? [window] : collageCells(urls.length, window);
  const images = await Promise.all(urls.map((url) => loadImage(url).catch(() => null)));
  images.forEach((image, index) => {
    if (image !== null) {
      // Cells are rounded outwards so that no hairline gap shows between photos.
      const cell = cells[index]!;
      const x = Math.floor(cell.x);
      const y = Math.floor(cell.y);
      drawCover(context, image, {
        x,
        y,
        width: Math.ceil(cell.x + cell.width) - x,
        height: Math.ceil(cell.y + cell.height) - y,
      });
    }
  });
}

/**
 * Writes a text in a box of a template, shrinking it until it fits.
 *
 * @param context - Drawing context.
 * @param text - The text.
 * @param box - Where and how.
 * @param dpi - Resolution of the template, to turn points into pixels.
 * @param fontFamily - Font family.
 * @returns False when the text overflows even at the smallest size.
 */
function drawTextBox(
  context: CanvasRenderingContext2D,
  text: string,
  box: BiocardTextBox,
  dpi: number,
  fontFamily: string,
): boolean {
  const { width: canvasWidth, height: canvasHeight } = context.canvas;
  const area = {
    x: box.x * canvasWidth,
    y: box.y * canvasHeight,
    width: box.width * canvasWidth,
    height: box.height * canvasHeight,
  };
  const font = (fontPx: number) => `${fontPx}px "${fontFamily}"`;
  const measure = (line: string, fontPx: number) => {
    context.font = font(fontPx);
    return context.measureText(line).width;
  };
  const fitted = fitText(
    text.trim(),
    area.width,
    area.height,
    pointsToPixels(box.fontSizePt, dpi),
    pointsToPixels(BIOCARD_MIN_FONT_PT, dpi),
    measure,
  );

  const lineHeight = fitted.fontPx * BIOCARD_LINE_HEIGHT;
  const textHeight = fitted.lines.length * lineHeight;
  const top =
    box.verticalAlign === 'top'
      ? area.y
      : box.verticalAlign === 'bottom'
        ? area.y + area.height - textHeight
        : area.y + (area.height - textHeight) / 2;
  const x =
    box.align === 'left'
      ? area.x
      : box.align === 'right'
        ? area.x + area.width
        : area.x + area.width / 2;

  context.font = font(fitted.fontPx);
  context.fillStyle = box.colour;
  context.textAlign = box.align;
  context.textBaseline = 'middle';
  fitted.lines.forEach((line, index) => {
    context.fillText(line, x, top + lineHeight * (index + 0.5));
  });
  return fitted.fits;
}

/**
 * Draws the front of a card.
 *
 * @param templates - The templates.
 * @param picture - What shows through.
 * @param name - Name to write.
 * @param layout - Where texts go.
 * @returns The drawn side.
 */
export async function drawBiocardFront(
  templates: BiocardTemplates,
  picture: BiocardPicture,
  name: string,
  layout: BiocardLayout,
): Promise<DrawnSide> {
  const { front, window, frontGeometry, fontFamily } = templates;
  const { canvas, context } = createCanvas(front.naturalWidth, front.naturalHeight);
  if (window !== null) {
    await drawPicture(context, picture, window);
  }
  context.drawImage(front, 0, 0);
  const fits = drawTextBox(context, name, layout.name, frontGeometry.dpi, fontFamily);
  return { canvas, fits, dpi: frontGeometry.dpi };
}

/**
 * Draws the back of a card.
 *
 * @param templates - The templates.
 * @param description - Text to write.
 * @param layout - Where texts go.
 * @returns The drawn side.
 */
export function drawBiocardBack(
  templates: BiocardTemplates,
  description: string,
  layout: BiocardLayout,
): DrawnSide {
  const { back, backGeometry, fontFamily } = templates;
  const { canvas, context } = createCanvas(back.naturalWidth, back.naturalHeight);
  context.drawImage(back, 0, 0);
  const fits = drawTextBox(context, description, layout.description, backGeometry.dpi, fontFamily);
  return { canvas, fits, dpi: backGeometry.dpi };
}

/**
 * Encodes a drawn side as a PNG that states its print resolution.
 *
 * @param side - The drawn side.
 * @returns The PNG file.
 */
export async function encodeBiocardSide(side: DrawnSide): Promise<Blob> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    side.canvas.toBlob(
      (result) => (result === null ? reject(new Error('Encoding failed')) : resolve(result)),
      'image/png',
    );
  });
  const bytes = withPixelDensity(new Uint8Array(await blob.arrayBuffer()), side.dpi);
  return new Blob([bytes], { type: 'image/png' });
}

/** JPEG quality of the cards shown on public pages. */
const PREVIEW_JPEG_QUALITY = 0.9;

/**
 * Encodes a drawn side for showing it on a page. A JPEG takes a fraction
 * of the time of a PNG to encode, which matters when a page draws a whole
 * set of cards; the PNG of `encodeBiocardSide` stays for printing.
 *
 * @param side - The drawn side.
 * @returns The JPEG file.
 */
export function encodeBiocardPreview(side: DrawnSide): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    side.canvas.toBlob(
      (result) => (result === null ? reject(new Error('Encoding failed')) : resolve(result)),
      'image/jpeg',
      PREVIEW_JPEG_QUALITY,
    );
  });
}
