/**
 * A mission image composed on the fly.
 */
import { useEffect, useState } from 'preact/hooks';
import { composeImage } from './compose';

/**
 * Displays a photo with its overlay. The result is a regular image rather
 * than a canvas, so that it also appears when the page is printed. If the
 * overlay cannot be applied, the plain photo is better than nothing.
 *
 * @param props - Addresses of the photo and overlay, and the alternative text.
 * @returns The image element, or nothing while it is being composed.
 */
export function ComposedImage({
  photoUrl,
  overlayUrl,
  alt,
}: {
  photoUrl: string;
  overlayUrl: string | null;
  alt: string;
}) {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    composeImage(photoUrl, overlayUrl).then(
      (blob) => {
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setSource(objectUrl);
        }
      },
      () => {
        if (active) setSource(photoUrl);
      },
    );
    return () => {
      active = false;
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
    };
  }, [photoUrl, overlayUrl]);

  return source === null ? null : <img src={source} alt={alt} />;
}
