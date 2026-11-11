/**
 * The Biocards a public page shows: front and back of each card, drawn in
 * the visitor's browser like the mission images.
 */
import { useEffect, useState } from 'preact/hooks';
import { resolveLocalized } from '../../shared/letter';
import type { Language } from '../../shared/rules';
import type { PublicBiocardCard, PublicBiocards } from '../../shared/types';
import {
  drawBiocardBack,
  drawBiocardFront,
  encodeBiocardPreview,
  loadBiocardTemplates,
  type BiocardPicture,
} from './biocard';

/** Both sides of one drawn card, as image addresses. */
interface DrawnCard {
  key: string;
  name: string;
  front: string;
  back: string;
}

/**
 * Shows both sides of every card. They are regular images rather than
 * canvases, so that they also appear when the page is printed. The
 * templates are read once for all the cards, since finding their
 * see-through part reads every pixel, and the cards appear one by one as
 * they are drawn; a card that cannot be drawn is left out rather than
 * shown broken.
 *
 * @param props - The cards, the root of the page's API, the page's
 *   overlay (used only when the cards carry it), the language of the
 *   descriptions, the photos for a collage and the alternative texts.
 * @returns The images, or nothing until the first card is drawn.
 */
export function BiocardGallery({
  biocards,
  base,
  overlayUrl,
  language,
  collageUrls,
  frontAlt,
  backAlt,
}: {
  biocards: PublicBiocards;
  base: string;
  overlayUrl: string | null;
  language: Language;
  collageUrls: readonly string[];
  frontAlt: string;
  backAlt: string;
}) {
  const [drawn, setDrawn] = useState<DrawnCard[]>([]);
  const collageKey = collageUrls.join('|');

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    const file = (name: string, version: number) => `${base}/biocard/${name}?v=${version}`;

    /**
     * Tells where the picture of a card comes from.
     *
     * @param card - The card.
     * @returns Its picture.
     */
    const pictureOf = (card: PublicBiocardCard): BiocardPicture => {
      switch (card.picture) {
        case 'collage':
          return { kind: 'collage', urls: collageUrls };
        case 'upload':
          return { kind: 'photo', url: file('photo', card.photoVersion) };
        default:
          return {
            kind: 'photo',
            url: `${base}/missions/${card.key}/photo?v=${card.photoVersion}`,
          };
      }
    };

    /** Draws the cards in order, publishing each one as soon as it is ready. */
    const draw = async () => {
      const templates = await loadBiocardTemplates(
        file('front', biocards.frontVersion),
        file('back', biocards.backVersion),
        biocards.fontVersion === null ? null : file('font', biocards.fontVersion),
      );
      // Only a partner's overlay goes on the cards, never the default one.
      const overlay = biocards.overlay ? overlayUrl : null;
      for (const card of biocards.cards) {
        try {
          const description = resolveLocalized(card.description, language);
          const sides = [
            await drawBiocardFront(templates, pictureOf(card), card.name, biocards.layout, overlay),
            drawBiocardBack(templates, description, biocards.layout),
          ];
          const blobs = await Promise.all(sides.map(encodeBiocardPreview));
          if (!active) return;
          const [front, back] = blobs.map((blob) => URL.createObjectURL(blob));
          objectUrls.push(front!, back!);
          setDrawn((previous) => [
            ...previous,
            { key: card.key, name: card.name, front: front!, back: back! },
          ]);
        } catch {
          // A card whose photo fails to load is skipped; the rest still show.
        }
      }
    };
    setDrawn([]);
    draw().catch(() => {
      if (active) setDrawn([]);
    });
    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    // The collage is compared by its addresses, which identify the photos,
    // so that a new array with the same photos does not redraw the cards.
  }, [biocards, base, overlayUrl, language, collageKey]);

  if (drawn.length === 0) {
    return null;
  }
  return (
    <div class="biocard-gallery">
      {drawn.map((card) => (
        <div key={card.key} class="biocard-pair">
          <img src={card.front} alt={`${frontAlt}: ${card.name}`} />
          <img src={card.back} alt={`${backAlt}: ${card.name}`} />
        </div>
      ))}
    </div>
  );
}
