/**
 * Mission image composition. It runs in the browser so that the server
 * never processes images and public visitors never write to storage.
 */
import { IMAGE_SIZE_PX } from '../../shared/rules';

/**
 * Loads an image from this same site.
 *
 * @param url - Address of the image.
 * @returns The decoded image.
 */
async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

/**
 * Builds a mission image: the photo with the overlay on top, 512×512.
 *
 * @param photoUrl - Address of the mission photo.
 * @param overlayUrl - Address of the overlay; null for the photo alone.
 * @returns The PNG file.
 */
export async function composeImage(photoUrl: string, overlayUrl: string | null): Promise<Blob> {
  const [photo, overlay] = await Promise.all([
    loadImage(photoUrl),
    overlayUrl === null ? null : loadImage(overlayUrl),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_SIZE_PX;
  canvas.height = IMAGE_SIZE_PX;
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Canvas is not available');
  }
  context.drawImage(photo, 0, 0, IMAGE_SIZE_PX, IMAGE_SIZE_PX);
  if (overlay !== null) {
    context.drawImage(overlay, 0, 0, IMAGE_SIZE_PX, IMAGE_SIZE_PX);
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob === null ? reject(new Error('Encoding failed')) : resolve(blob)),
      'image/png',
    );
  });
}
