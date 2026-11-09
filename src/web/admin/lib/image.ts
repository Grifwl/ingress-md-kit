/**
 * Geometry of the photo crop. Pure, so it can be tested without a canvas.
 */
import type { CropRect } from '../../../shared/types';

/** Smallest crop allowed, to avoid zooming into a blur of a few pixels. */
const MIN_CROP_SIZE = 32;

/**
 * Starts with the largest centred square of the image.
 *
 * @param width - Image width.
 * @param height - Image height.
 * @returns The initial crop.
 */
export function defaultCrop(width: number, height: number): CropRect {
  const size = Math.min(width, height);
  return { x: Math.floor((width - size) / 2), y: Math.floor((height - size) / 2), size };
}

/**
 * Keeps a crop inside the image, in whole pixels.
 *
 * @param crop - Requested crop.
 * @param width - Image width.
 * @param height - Image height.
 * @returns The nearest valid crop.
 */
export function clampCrop(crop: CropRect, width: number, height: number): CropRect {
  const largest = Math.min(width, height);
  const size = Math.round(Math.max(Math.min(MIN_CROP_SIZE, largest), Math.min(crop.size, largest)));
  return {
    x: Math.round(Math.min(Math.max(crop.x, 0), width - size)),
    y: Math.round(Math.min(Math.max(crop.y, 0), height - size)),
    size,
  };
}

/**
 * Changes the size of a crop around its centre, as a zoom control does.
 *
 * @param crop - Current crop.
 * @param size - New side length.
 * @param width - Image width.
 * @param height - Image height.
 * @returns The resized crop, kept inside the image.
 */
export function resizeCrop(crop: CropRect, size: number, width: number, height: number): CropRect {
  const offset = (crop.size - size) / 2;
  return clampCrop({ x: crop.x + offset, y: crop.y + offset, size }, width, height);
}

/**
 * Tells the range of sizes the zoom control can offer.
 *
 * @param width - Image width.
 * @param height - Image height.
 * @returns The smallest and largest crop side.
 */
export function cropSizeRange(width: number, height: number): { min: number; max: number } {
  const max = Math.min(width, height);
  return { min: Math.min(MIN_CROP_SIZE, max), max };
}
