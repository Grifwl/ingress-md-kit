/**
 * Choosing, framing and uploading a mission photo. All the image work
 * happens in the browser; the Worker only stores the resulting PNG.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { IMAGE_SIZE_PX } from '../../../shared/rules';
import type { CropRect, Mission } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { photoUrl, uploadPhoto } from '../api';
import { clampCrop, cropSizeRange, defaultCrop, resizeCrop } from '../lib/image';
import { ErrorMessage, Field } from './common';

const PREVIEW_SIZE_PX = 320;

/**
 * Draws a region of an image onto a canvas, filling it.
 *
 * @param canvas - Destination.
 * @param image - Source image.
 * @param crop - Region of the image to draw.
 */
function drawCrop(canvas: HTMLCanvasElement, image: HTMLImageElement, crop: CropRect): void {
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Canvas is not available');
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, canvas.width, canvas.height);
}

/**
 * Renders the final 512×512 PNG.
 *
 * @param image - Source image.
 * @param crop - Region to use.
 * @returns The PNG file.
 */
function renderPng(image: HTMLImageElement, crop: CropRect): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_SIZE_PX;
  canvas.height = IMAGE_SIZE_PX;
  drawCrop(canvas, image, crop);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob === null ? reject(new Error('Encoding failed')) : resolve(blob)),
      'image/png',
    );
  });
}

/**
 * Editor of a mission's photo.
 *
 * @param props - Mission Day slug, the mission, and a callback for when
 *   the new photo has been stored.
 * @returns The editor element.
 */
export function PhotoCropper({
  slug,
  mission,
  onUploaded,
}: {
  slug: string;
  mission: Mission;
  onUploaded: (mission: Mission) => void;
}) {
  const { t } = useI18n();
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [loadFailed, setLoadFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number; crop: CropRect } | null>(null);

  useEffect(() => {
    if (image !== null && crop !== null && canvasRef.current !== null) {
      drawCrop(canvasRef.current, image, crop);
    }
  }, [image, crop]);

  /**
   * Opens the file the organiser picked.
   *
   * @param file - Selected file.
   */
  const openFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const loaded = new Image();
    setLoadFailed(false);
    setError(undefined);
    loaded.onload = () => {
      setImage(loaded);
      setCrop(defaultCrop(loaded.naturalWidth, loaded.naturalHeight));
      URL.revokeObjectURL(url);
    };
    loaded.onerror = () => {
      setLoadFailed(true);
      URL.revokeObjectURL(url);
    };
    loaded.src = url;
  };

  /**
   * Moves the crop while the image is being dragged. Dragging right shows
   * more of the left of the photo, so the movement is inverted.
   *
   * @param event - Pointer movement.
   */
  const onPointerMove = (event: PointerEvent) => {
    if (dragRef.current === null || image === null) {
      return;
    }
    const start = dragRef.current;
    const scale = start.crop.size / PREVIEW_SIZE_PX;
    setCrop(
      clampCrop(
        {
          x: start.crop.x - (event.clientX - start.x) * scale,
          y: start.crop.y - (event.clientY - start.y) * scale,
          size: start.crop.size,
        },
        image.naturalWidth,
        image.naturalHeight,
      ),
    );
  };

  /** Crops the photo and sends it to the server. */
  const upload = async () => {
    if (image === null || crop === null) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      onUploaded(await uploadPhoto(slug, mission.id, await renderPng(image, crop), crop));
      setImage(null);
      setCrop(null);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const range = image === null ? null : cropSizeRange(image.naturalWidth, image.naturalHeight);

  return (
    <div class="photo-editor">
      {mission.hasPhoto && image === null && (
        <img
          class="photo-current"
          src={photoUrl(slug, mission)}
          alt={t('mission.photoCurrent')}
          width={PREVIEW_SIZE_PX}
          height={PREVIEW_SIZE_PX}
        />
      )}
      <Field label={t('mission.photoChoose')}>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file !== undefined) openFile(file);
          }}
        />
      </Field>
      {loadFailed && <p class="alert">{t('mission.photoLoadError')}</p>}
      {image !== null && crop !== null && range !== null && (
        <div class="cropper">
          <p class="field-help">{t('mission.photoHelp')}</p>
          <canvas
            ref={canvasRef}
            class="crop-preview"
            width={PREVIEW_SIZE_PX}
            height={PREVIEW_SIZE_PX}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = { x: event.clientX, y: event.clientY, crop };
            }}
            onPointerMove={onPointerMove}
            onPointerUp={() => {
              dragRef.current = null;
            }}
          />
          <Field label={t('mission.photoZoom')}>
            {/* The slider is reversed: moving right means a smaller crop, so more zoom. */}
            <input
              type="range"
              min={range.min}
              max={range.max}
              value={range.max + range.min - crop.size}
              onInput={(event) =>
                setCrop(
                  resizeCrop(
                    crop,
                    range.max + range.min - Number(event.currentTarget.value),
                    image.naturalWidth,
                    image.naturalHeight,
                  ),
                )
              }
            />
          </Field>
          <button type="button" class="button primary" disabled={busy} onClick={upload}>
            {busy ? t('mission.photoUploading') : t('mission.photoUpload')}
          </button>
        </div>
      )}
      <ErrorMessage error={error} />
    </div>
  );
}
