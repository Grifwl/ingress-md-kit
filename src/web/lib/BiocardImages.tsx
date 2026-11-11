/**
 * The Mission Day's own Biocard on a public page: front and back, drawn
 * in the visitor's browser like the mission images.
 */
import { useEffect, useState } from 'preact/hooks';
import { resolveLocalized } from '../../shared/letter';
import type { Language } from '../../shared/rules';
import type { PublicBiocard } from '../../shared/types';
import {
  drawBiocardBack,
  drawBiocardFront,
  encodeBiocardSide,
  loadBiocardTemplates,
} from './biocard';

/**
 * Shows both sides of the card. They are regular images rather than
 * canvases, so that they also appear when the page is printed; if they
 * cannot be drawn, nothing is shown rather than a broken card.
 *
 * @param props - The card, the root of the page's API, the language of
 *   the description, the photos for a collage and the alternative texts.
 * @returns The images, or nothing while they are being drawn.
 */
export function BiocardImages({
  biocard,
  base,
  language,
  collageUrls,
  frontAlt,
  backAlt,
}: {
  biocard: PublicBiocard;
  base: string;
  language: Language;
  collageUrls: readonly string[];
  frontAlt: string;
  backAlt: string;
}) {
  const [sources, setSources] = useState<[string, string] | null>(null);
  const description = resolveLocalized(biocard.description, language);
  const collageKey = collageUrls.join('|');

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    const file = (name: string, version: number) => `${base}/biocard/${name}?v=${version}`;

    /** Draws both sides and turns them into image addresses. */
    const draw = async () => {
      const templates = await loadBiocardTemplates(
        file('front', biocard.frontVersion),
        file('back', biocard.backVersion),
        biocard.fontVersion === null ? null : file('font', biocard.fontVersion),
      );
      const picture =
        biocard.photo === 'collage'
          ? { kind: 'collage' as const, urls: collageUrls }
          : { kind: 'photo' as const, url: file('photo', biocard.photoVersion) };
      const sides = [
        await drawBiocardFront(templates, picture, biocard.name, biocard.layout),
        drawBiocardBack(templates, description, biocard.layout),
      ];
      const blobs = await Promise.all(sides.map(encodeBiocardSide));
      if (active) {
        objectUrls.push(...blobs.map((blob) => URL.createObjectURL(blob)));
        setSources([objectUrls[0]!, objectUrls[1]!]);
      }
    };
    draw().catch(() => {
      if (active) setSources(null);
    });
    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    // The collage is compared by its addresses, which identify the photos,
    // so that a new array with the same photos does not redraw the card.
  }, [biocard, base, description, collageKey]);

  if (sources === null) {
    return null;
  }
  return (
    <div class="biocard-pair">
      <img src={sources[0]} alt={frontAlt} />
      <img src={sources[1]} alt={backAlt} />
    </div>
  );
}
