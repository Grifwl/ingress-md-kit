/**
 * The Biocards screen: templates, where the texts go, the Mission Day's
 * own card, and the generation of the cards as a ZIP of PNG files.
 *
 * The templates are made outside the tool; here only the dynamic part is
 * handled, which is the picture, the name and the description of each card.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  BIOCARD_GENERIC_PHOTOS,
  BIOCARD_TEXT_ALIGNS,
  BIOCARD_VERTICAL_ALIGNS,
  biocardDescription,
  biocardFileName,
  biocardName,
  type BiocardGenericPhoto,
  type BiocardGeometry,
  type BiocardLayout,
  type BiocardSettings,
  type BiocardTextAlign,
  type BiocardTextBox,
  type BiocardVerticalAlign,
} from '../../../shared/biocard';
import { LANGUAGES, type Language } from '../../../shared/rules';
import type { LocalizedText, Mission, MissionDayWithRole } from '../../../shared/types';
import { useI18n } from '../../i18n';
import {
  drawBiocardBack,
  drawBiocardFront,
  encodeBiocardSide,
  loadBiocardTemplates,
  type BiocardPicture,
  type BiocardTemplates,
} from '../../lib/biocard';
import { downloadFile } from '../../lib/exports/download';
import { buildZip, type ZipEntry } from '../../lib/exports/zip';
import {
  biocardFileUrl,
  deleteBiocardFont,
  photoUrl,
  saveBiocardSettings,
  updateMission,
  uploadBiocardFile,
} from '../api';
import { ErrorMessage, Field, FileUpload } from '../components/common';
import { fractionToMm, mmToFraction, templateWarnings } from '../lib/biocards';
import { candidatesForList, selectedInOrder } from '../lib/selection';

/** Key of the Mission Day's own card among the cards of the screen. */
const GENERIC_KEY = 'generic';

/** Delay before a preview is redrawn, so that dragging a box stays smooth. */
const PREVIEW_DELAY_MS = 150;

/** One card to draw: its name, picture and description. */
interface CardSpec {
  key: string;
  label: string;
  name: string;
  picture: BiocardPicture;
  description: LocalizedText;
}

/** Which text box is being edited. */
type BoxName = keyof BiocardLayout;

/**
 * Draws one card for the preview whenever what it shows changes.
 *
 * @param templates - The loaded templates, or null.
 * @param card - The card to draw, or null.
 * @param layout - Where texts go.
 * @param description - Text of the back.
 * @returns Addresses of both sides and whether their texts fit, or null.
 */
function usePreview(
  templates: BiocardTemplates | null,
  card: CardSpec | null,
  layout: BiocardLayout,
  description: string,
): { front: string; back: string; frontFits: boolean; backFits: boolean } | null {
  const [preview, setPreview] = useState<{
    front: string;
    back: string;
    frontFits: boolean;
    backFits: boolean;
  } | null>(null);

  useEffect(() => {
    if (templates === null || card === null) {
      setPreview(null);
      return undefined;
    }
    let active = true;
    const urls: string[] = [];
    const timer = setTimeout(async () => {
      try {
        const front = await drawBiocardFront(templates, card.picture, card.name, layout);
        const back = drawBiocardBack(templates, description, layout);
        // Canvases are shown as images, which scale well in the editor.
        const [frontBlob, backBlob] = await Promise.all([
          encodeBiocardSide(front),
          encodeBiocardSide(back),
        ]);
        if (active) {
          urls.push(URL.createObjectURL(frontBlob), URL.createObjectURL(backBlob));
          setPreview({
            front: urls[0]!,
            back: urls[1]!,
            frontFits: front.fits,
            backFits: back.fits,
          });
        }
      } catch {
        if (active) setPreview(null);
      }
    }, PREVIEW_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
      // The previous images stay on screen until the new ones are ready,
      // so they are released a little later than the effect is undone.
      setTimeout(() => urls.forEach((url) => URL.revokeObjectURL(url)), 1000);
    };
  }, [templates, card, layout, description]);

  return preview;
}

/**
 * A preview with a text box that can be dragged and resized on it. The
 * dashed line shows where the card will be cut, when there is a margin.
 *
 * @param props - Image, box, physical reading of the template and change handler.
 * @returns The editor element.
 */
function BoxEditor({
  image,
  alt,
  box,
  geometry,
  onChange,
}: {
  image: string | null;
  alt: string;
  box: BiocardTextBox;
  geometry: BiocardGeometry;
  onChange: (box: BiocardTextBox) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const trimX = (geometry.bleedMm / geometry.widthMm) * 100;
  const trimY = (geometry.bleedMm / geometry.heightMm) * 100;

  /**
   * Follows the pointer to move or resize the box. Moves are read as
   * fractions of the frame, which is how boxes are stored.
   *
   * @param event - The pointer press.
   * @param mode - Whether the box moves or its corner is dragged.
   */
  const startDrag = (event: PointerEvent, mode: 'move' | 'resize') => {
    const element = frame.current;
    if (element === null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const bounds = element.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, box };

    /**
     * Applies the distance travelled since the press.
     *
     * @param move - Current pointer position.
     */
    const onMove = (move: PointerEvent) => {
      const dx = (move.clientX - start.x) / bounds.width;
      const dy = (move.clientY - start.y) / bounds.height;
      onChange(
        mode === 'move'
          ? { ...start.box, x: start.box.x + dx, y: start.box.y + dy }
          : {
              ...start.box,
              width: Math.max(0.02, start.box.width + dx),
              height: Math.max(0.02, start.box.height + dy),
            },
      );
    };
    /** Stops following the pointer. */
    const onUp = () => {
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
    };
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
  };

  return (
    <div
      class="biocard-editor"
      ref={frame}
      style={{ aspectRatio: `${geometry.widthMm} / ${geometry.heightMm}` }}
    >
      {image !== null && <img src={image} alt={alt} />}
      {geometry.bleedMm > 0 && (
        <div class="biocard-trim" style={{ inset: `${trimY}% ${trimX}%` }} aria-hidden="true" />
      )}
      <div
        class="biocard-box"
        style={{
          left: `${box.x * 100}%`,
          top: `${box.y * 100}%`,
          width: `${box.width * 100}%`,
          height: `${box.height * 100}%`,
        }}
        onPointerDown={(event) => startDrag(event, 'move')}
      >
        <span class="biocard-box-handle" onPointerDown={(event) => startDrag(event, 'resize')} />
      </div>
    </div>
  );
}

/**
 * Fields of a text box: position and size in millimetres, and its style.
 *
 * @param props - The box, the physical reading of its template and change handler.
 * @returns The fields.
 */
function BoxFields({
  box,
  geometry,
  onChange,
}: {
  box: BiocardTextBox;
  geometry: BiocardGeometry;
  onChange: (box: BiocardTextBox) => void;
}) {
  const { t } = useI18n();
  const axes = [
    { key: 'x', label: t('biocard.boxX'), size: geometry.widthMm },
    { key: 'y', label: t('biocard.boxY'), size: geometry.heightMm },
    { key: 'width', label: t('biocard.boxWidth'), size: geometry.widthMm },
    { key: 'height', label: t('biocard.boxHeight'), size: geometry.heightMm },
  ] as const;

  return (
    <div class="biocard-fields">
      {axes.map(({ key, label, size }) => (
        <Field key={key} label={label}>
          <input
            type="number"
            step="0.5"
            value={fractionToMm(box[key], size)}
            onChange={(e) => {
              const value = Number(e.currentTarget.value);
              if (Number.isFinite(value)) onChange({ ...box, [key]: mmToFraction(value, size) });
            }}
          />
        </Field>
      ))}
      <Field label={t('biocard.fontSize')}>
        <input
          type="number"
          min="1"
          max="200"
          step="0.5"
          value={box.fontSizePt}
          onChange={(e) => {
            const value = Number(e.currentTarget.value);
            if (value >= 1 && value <= 200) onChange({ ...box, fontSizePt: value });
          }}
        />
      </Field>
      <Field label={t('biocard.colour')}>
        <input
          type="color"
          value={box.colour}
          onInput={(e) => onChange({ ...box, colour: e.currentTarget.value })}
        />
      </Field>
      <Field label={t('biocard.align')}>
        <select
          value={box.align}
          onChange={(e) => onChange({ ...box, align: e.currentTarget.value as BiocardTextAlign })}
        >
          {BIOCARD_TEXT_ALIGNS.map((align) => (
            <option key={align} value={align}>
              {t(`biocard.align.${align}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('biocard.verticalAlign')}>
        <select
          value={box.verticalAlign}
          onChange={(e) =>
            onChange({ ...box, verticalAlign: e.currentTarget.value as BiocardVerticalAlign })
          }
        >
          {BIOCARD_VERTICAL_ALIGNS.map((align) => (
            <option key={align} value={align}>
              {t(`biocard.verticalAlign.${align}`)}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

/**
 * One row of the list of cards: whether to generate it, and for a
 * mission, the name on its card, saved when the field is left.
 *
 * @param props - The card, whether it is chosen, the mission behind it and handlers.
 * @returns The row element.
 */
function CardRow({
  card,
  mission,
  chosen,
  onToggle,
  onRename,
}: {
  card: CardSpec;
  mission: Mission | null;
  chosen: boolean;
  onToggle: (chosen: boolean) => void;
  onRename: (name: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(mission?.biocardName ?? '');
  const [error, setError] = useState<unknown>();

  return (
    <li class="biocard-row">
      <label class="check">
        <input
          type="checkbox"
          checked={chosen}
          onChange={(e) => onToggle(e.currentTarget.checked)}
        />
        <span>{card.label}</span>
      </label>
      {mission !== null && (
        <input
          type="text"
          aria-label={t('biocard.cardName')}
          placeholder={mission.landmark}
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
          onBlur={async () => {
            if (name === mission.biocardName) return;
            setError(undefined);
            try {
              await onRename(name);
            } catch (failure) {
              setError(failure);
            }
          }}
        />
      )}
      {mission !== null && !mission.hasPhoto && (
        <span class="badge warn">{t('biocard.noPhoto')}</span>
      )}
      <ErrorMessage error={error} />
    </li>
  );
}

/**
 * The Biocards screen.
 *
 * @param props - The Mission Day, its missions and change handlers.
 * @returns The page element.
 */
export function BiocardsPage({
  missionDay,
  missions,
  onMissionDayChange,
  onMissionChange,
}: {
  missionDay: MissionDayWithRole;
  missions: readonly Mission[];
  onMissionDayChange: (missionDay: MissionDayWithRole) => void;
  onMissionChange: (mission: Mission) => void;
}) {
  const { t, tDynamic, language: uiLanguage } = useI18n();
  const slug = missionDay.slug;
  const [settings, setSettings] = useState<BiocardSettings>(missionDay.biocard);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();
  const [templates, setTemplates] = useState<BiocardTemplates | null>(null);
  const [templateError, setTemplateError] = useState(false);
  const [language, setLanguage] = useState<Language>(uiLanguage);
  const [withEnglish, setWithEnglish] = useState(true);
  const [previewKey, setPreviewKey] = useState<string>(GENERIC_KEY);
  const [textLanguage, setTextLanguage] = useState<Language>(uiLanguage);
  const [progress, setProgress] = useState<string>();
  const [overflowing, setOverflowing] = useState<string[]>([]);

  const frontUrl = biocardFileUrl(missionDay, 'front');
  const backUrl = biocardFileUrl(missionDay, 'back');
  const fontUrl = biocardFileUrl(missionDay, 'font');
  const genericPhotoUrl = biocardFileUrl(missionDay, 'photo');

  // Templates are decoded once per file version, not on every change of
  // the layout, because finding the see-through part reads every pixel.
  useEffect(() => {
    setTemplates(null);
    setTemplateError(false);
    if (frontUrl === null || backUrl === null) {
      return undefined;
    }
    let active = true;
    loadBiocardTemplates(frontUrl, backUrl, fontUrl).then(
      (loaded) => active && setTemplates(loaded),
      () => active && setTemplateError(true),
    );
    return () => {
      active = false;
    };
  }, [frontUrl, backUrl, fontUrl]);

  const ordered = useMemo(() => candidatesForList(missions), [missions]);
  const selected = useMemo(() => selectedInOrder(missions), [missions]);
  const collageUrls = useMemo(
    () => selected.filter((mission) => mission.hasPhoto).map((mission) => photoUrl(slug, mission)),
    [selected, slug],
  );

  // Every card the screen can generate: the Mission Day's own one first,
  // then the selected missions in recommended order, then the others.
  const cards = useMemo<CardSpec[]>(() => {
    const genericPicture: BiocardPicture =
      settings.genericPhoto === 'collage'
        ? { kind: 'collage', urls: collageUrls }
        : genericPhotoUrl === null
          ? null
          : { kind: 'photo', url: genericPhotoUrl };
    return [
      {
        key: GENERIC_KEY,
        label: t('biocard.genericCard'),
        name: settings.genericName,
        picture: genericPicture,
        description: settings.genericDescription,
      },
      ...ordered.map((mission) => ({
        key: mission.id,
        label: mission.landmark === '' ? t('missions.untitled') : mission.landmark,
        name: biocardName(mission),
        picture: mission.hasPhoto ? { kind: 'photo' as const, url: photoUrl(slug, mission) } : null,
        description: mission.description,
      })),
    ];
  }, [settings, collageUrls, genericPhotoUrl, ordered, slug, t]);

  const [chosen, setChosen] = useState<ReadonlySet<string>>(
    () => new Set([GENERIC_KEY, ...selected.map((mission) => mission.id)]),
  );

  const previewCard = cards.find((card) => card.key === previewKey) ?? cards[0] ?? null;
  const previewDescription =
    previewCard === null ? '' : biocardDescription(previewCard.description, language, withEnglish);
  const preview = usePreview(templates, previewCard, settings.layout, previewDescription);

  const warnings =
    templates === null
      ? []
      : templateWarnings({
          front: {
            width: templates.front.naturalWidth,
            height: templates.front.naturalHeight,
            geometry: templates.frontGeometry,
          },
          back: {
            width: templates.back.naturalWidth,
            height: templates.back.naturalHeight,
            geometry: templates.backGeometry,
          },
          window: templates.window,
        });

  /**
   * Changes the draft settings, which are saved with the button.
   *
   * @param next - The new settings.
   */
  const change = (next: BiocardSettings) => {
    setSettings(next);
    setDirty(true);
    setSaved(false);
  };

  /**
   * Changes one text box of the layout.
   *
   * @param name - Which box.
   * @param box - Its new state.
   */
  const changeBox = (name: BoxName, box: BiocardTextBox) =>
    change({ ...settings, layout: { ...settings.layout, [name]: box } });

  /** Saves the layout and the texts of the Mission Day's own card. */
  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      onMissionDayChange(await saveBiocardSettings(slug, settings));
      setDirty(false);
      setSaved(true);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Saves the name a mission's card shows.
   *
   * @param mission - The mission.
   * @param name - Its card name; empty to use the landmark.
   */
  const rename = async (mission: Mission, name: string) => {
    onMissionChange(await updateMission(slug, mission.id, { biocardName: name.trim() }));
  };

  /** Draws every chosen card, both sides, and offers them as a ZIP. */
  const generate = async () => {
    if (templates === null) {
      return;
    }
    const list = cards.filter((card) => chosen.has(card.key));
    const entries: ZipEntry[] = [];
    const overflow: string[] = [];
    setError(undefined);
    try {
      for (const [index, card] of list.entries()) {
        setProgress(t('exports.progress', { done: index + 1, total: list.length }));
        // The Mission Day's own card is number 0, so missions keep 1, 2…
        const number =
          card.key === GENERIC_KEY ? 0 : list[0]?.key === GENERIC_KEY ? index : index + 1;
        const description = biocardDescription(card.description, language, withEnglish);
        const sides = [
          await drawBiocardFront(templates, card.picture, card.name, settings.layout),
          drawBiocardBack(templates, description, settings.layout),
        ] as const;
        if (!sides[0].fits || !sides[1].fits) {
          overflow.push(card.label);
        }
        for (const [sideIndex, side] of sides.entries()) {
          const blob = await encodeBiocardSide(side);
          entries.push({
            name: biocardFileName(number, card.name, sideIndex === 0 ? 'front' : 'back'),
            bytes: new Uint8Array(await blob.arrayBuffer()),
          });
        }
      }
    } catch (failure) {
      setError(failure);
      return;
    } finally {
      setProgress(undefined);
    }
    setOverflowing(overflow);
    downloadFile(buildZip(entries), `${slug}-biocards.zip`, 'application/zip');
  };

  const geometryText = (geometry: BiocardGeometry, width: number, height: number) =>
    t(geometry.bleedMm > 0 ? 'biocard.geometryBleed' : 'biocard.geometry', {
      width,
      height,
      widthMm: geometry.widthMm,
      heightMm: geometry.heightMm,
      bleed: geometry.bleedMm,
      dpi: Math.round(geometry.dpi),
    });

  return (
    <div class="stack">
      <h2>{t('biocard.title')}</h2>
      <p class="muted">{t('biocard.intro')}</p>

      <section class="card">
        <h3>{t('biocard.templates')}</h3>
        <div class="grid-2">
          <FileUpload
            label={t('biocard.front')}
            help={t('biocard.frontHelp')}
            accept="image/png"
            onUpload={async (file) =>
              onMissionDayChange(await uploadBiocardFile(slug, 'front', file))
            }
          >
            {frontUrl !== null && (
              <img class="file-preview overlay biocard-thumb" src={frontUrl} alt="" />
            )}
            {templates !== null && (
              <p class="field-help">
                {geometryText(
                  templates.frontGeometry,
                  templates.front.naturalWidth,
                  templates.front.naturalHeight,
                )}
              </p>
            )}
          </FileUpload>
          <FileUpload
            label={t('biocard.back')}
            help={t('biocard.backHelp')}
            accept="image/png,image/jpeg"
            onUpload={async (file) =>
              onMissionDayChange(await uploadBiocardFile(slug, 'back', file))
            }
          >
            {backUrl !== null && <img class="file-preview biocard-thumb" src={backUrl} alt="" />}
            {templates !== null && (
              <p class="field-help">
                {geometryText(
                  templates.backGeometry,
                  templates.back.naturalWidth,
                  templates.back.naturalHeight,
                )}
              </p>
            )}
          </FileUpload>
          <FileUpload
            label={t('biocard.font')}
            help={t('biocard.fontHelp')}
            accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
            onUpload={async (file) =>
              onMissionDayChange(await uploadBiocardFile(slug, 'font', file))
            }
          >
            <p>{fontUrl === null ? t('biocard.fontDefault') : t('biocard.fontOwn')}</p>
            {fontUrl !== null && (
              <button
                type="button"
                class="button"
                onClick={async () => onMissionDayChange(await deleteBiocardFont(slug))}
              >
                {t('biocard.fontRemove')}
              </button>
            )}
          </FileUpload>
        </div>
        {templateError && <p class="alert">{t('biocard.templatesUnreadable')}</p>}
        {warnings.length > 0 && (
          <ul class="issues">
            {warnings.map((warning) => (
              <li key={warning.code} class="issue warning">
                <span class="issue-severity">{t('severity.warning')}</span>
                <span>{tDynamic(`biocard.warning.${warning.code}`, warning.params)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section class="card">
        <h3>{t('biocard.layout')}</h3>
        <p class="muted">{t('biocard.layoutHelp')}</p>
        {templates === null ? (
          <p class="muted">{t('biocard.needTemplates')}</p>
        ) : (
          <>
            <div class="grid-2">
              <Field label={t('biocard.previewCard')}>
                <select value={previewKey} onChange={(e) => setPreviewKey(e.currentTarget.value)}>
                  {cards.map((card) => (
                    <option key={card.key} value={card.key}>
                      {card.label}
                    </option>
                  ))}
                </select>
              </Field>
              <LanguageFields
                language={language}
                withEnglish={withEnglish}
                onLanguage={setLanguage}
                onWithEnglish={setWithEnglish}
              />
            </div>
            <div class="biocard-sides">
              <div class="biocard-side">
                <h4>{t('biocard.front')}</h4>
                <BoxEditor
                  image={preview?.front ?? null}
                  alt={t('biocard.front')}
                  box={settings.layout.name}
                  geometry={templates.frontGeometry}
                  onChange={(box) => changeBox('name', box)}
                />
                {preview !== null && !preview.frontFits && (
                  <p class="issue warning">{t('biocard.textOverflows')}</p>
                )}
                <BoxFields
                  box={settings.layout.name}
                  geometry={templates.frontGeometry}
                  onChange={(box) => changeBox('name', box)}
                />
              </div>
              <div class="biocard-side">
                <h4>{t('biocard.back')}</h4>
                <BoxEditor
                  image={preview?.back ?? null}
                  alt={t('biocard.back')}
                  box={settings.layout.description}
                  geometry={templates.backGeometry}
                  onChange={(box) => changeBox('description', box)}
                />
                {preview !== null && !preview.backFits && (
                  <p class="issue warning">{t('biocard.textOverflows')}</p>
                )}
                <BoxFields
                  box={settings.layout.description}
                  geometry={templates.backGeometry}
                  onChange={(box) => changeBox('description', box)}
                />
              </div>
            </div>
          </>
        )}
      </section>

      <section class="card">
        <h3>{t('biocard.genericCard')}</h3>
        <p class="muted">{t('biocard.genericHelp')}</p>
        <Field label={t('biocard.genericName')} help={t('biocard.genericNameHelp')}>
          <input
            type="text"
            value={settings.genericName}
            onInput={(e) => change({ ...settings, genericName: e.currentTarget.value })}
          />
        </Field>
        <Field label={t('biocard.genericPhoto')}>
          <select
            value={settings.genericPhoto}
            onChange={(e) =>
              change({ ...settings, genericPhoto: e.currentTarget.value as BiocardGenericPhoto })
            }
          >
            {BIOCARD_GENERIC_PHOTOS.map((source) => (
              <option key={source} value={source}>
                {t(`biocard.genericPhoto.${source}`)}
              </option>
            ))}
          </select>
        </Field>
        {settings.genericPhoto === 'upload' ? (
          <FileUpload
            label={t('biocard.photo')}
            help={t('biocard.photoHelp')}
            accept="image/png,image/jpeg,image/webp"
            onUpload={async (file) =>
              onMissionDayChange(await uploadBiocardFile(slug, 'photo', file))
            }
          >
            {genericPhotoUrl !== null && (
              <img class="file-preview" src={genericPhotoUrl} alt={t('biocard.photo')} />
            )}
          </FileUpload>
        ) : (
          <p class="field-help">{t('biocard.collageHelp', { count: collageUrls.length })}</p>
        )}
        <Field label={t('settings.letterLanguage')}>
          <select
            value={textLanguage}
            onChange={(e) => setTextLanguage(e.currentTarget.value as Language)}
          >
            {LANGUAGES.map((option) => (
              <option key={option} value={option}>
                {option.toUpperCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`${t('biocard.genericDescription')} (${textLanguage.toUpperCase()})`}>
          <textarea
            rows={5}
            value={settings.genericDescription[textLanguage] ?? ''}
            onInput={(e) =>
              change({
                ...settings,
                genericDescription: {
                  ...settings.genericDescription,
                  [textLanguage]: e.currentTarget.value,
                },
              })
            }
          />
        </Field>
        <label class="check">
          <input
            type="checkbox"
            checked={settings.showOnProposals}
            onChange={(e) => change({ ...settings, showOnProposals: e.currentTarget.checked })}
          />
          <span>{t('biocard.showOnProposals')}</span>
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={settings.showOnParticipantView}
            onChange={(e) =>
              change({ ...settings, showOnParticipantView: e.currentTarget.checked })
            }
          />
          <span>{t('biocard.showOnParticipantView')}</span>
        </label>
        <p class="field-help">{t('biocard.showHelp')}</p>
      </section>

      <div class="actions">
        <button type="button" class="button primary" disabled={busy || !dirty} onClick={save}>
          {busy ? t('common.saving') : t('common.save')}
        </button>
        {saved && <span class="muted">{t('common.saved')}</span>}
        {dirty && <span class="muted">{t('biocard.unsaved')}</span>}
      </div>
      <ErrorMessage error={error} />

      <section class="card">
        <h3>{t('biocard.cards')}</h3>
        <p class="muted">{t('biocard.cardsHelp')}</p>
        <ul class="biocard-list">
          {cards.map((card) => (
            <CardRow
              key={card.key}
              card={card}
              mission={missions.find((mission) => mission.id === card.key) ?? null}
              chosen={chosen.has(card.key)}
              onToggle={(isChosen) => {
                const next = new Set(chosen);
                if (isChosen) next.add(card.key);
                else next.delete(card.key);
                setChosen(next);
              }}
              onRename={(name) => {
                const mission = missions.find((item) => item.id === card.key);
                return mission === undefined ? Promise.resolve() : rename(mission, name);
              }}
            />
          ))}
        </ul>
        <div class="grid-2">
          <LanguageFields
            language={language}
            withEnglish={withEnglish}
            onLanguage={setLanguage}
            onWithEnglish={setWithEnglish}
          />
        </div>
        {overflowing.length > 0 && (
          <p class="issue warning">
            {t('biocard.overflowingCards', { cards: overflowing.join(', ') })}
          </p>
        )}
        <div class="actions">
          <button
            type="button"
            class="button primary"
            disabled={templates === null || chosen.size === 0 || progress !== undefined}
            onClick={generate}
          >
            {progress ?? t('biocard.generate')}
          </button>
          {dirty && <span class="muted">{t('biocard.generateUnsaved')}</span>}
        </div>
      </section>
    </div>
  );
}

/**
 * Language of the descriptions, and whether English is added after it.
 *
 * @param props - Current choices and their handlers.
 * @returns The two fields.
 */
function LanguageFields({
  language,
  withEnglish,
  onLanguage,
  onWithEnglish,
}: {
  language: Language;
  withEnglish: boolean;
  onLanguage: (language: Language) => void;
  onWithEnglish: (withEnglish: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <Field label={t('biocard.language')} help={t('biocard.languageHelp')}>
        <select value={language} onChange={(e) => onLanguage(e.currentTarget.value as Language)}>
          {LANGUAGES.map((option) => (
            <option key={option} value={option}>
              {option.toUpperCase()}
            </option>
          ))}
        </select>
      </Field>
      <label class="check">
        <input
          type="checkbox"
          checked={withEnglish}
          disabled={language === 'en'}
          onChange={(e) => onWithEnglish(e.currentTarget.checked)}
        />
        <span>{t('biocard.withEnglish')}</span>
      </label>
    </>
  );
}
