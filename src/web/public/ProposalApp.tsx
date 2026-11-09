/**
 * Public proposal for one partner. It is written in the partner's letter
 * language, whatever the language of the visitor's browser, and it is laid
 * out so that printing it produces a document ready to attach to an email.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { languageOfProposalWord, parseProposalSegment } from '../../shared/letter';
import { mosaicCells } from '../../shared/mosaic';
import { MOSAIC_COLUMNS, type Language } from '../../shared/rules';
import type { ProposalMission, ProposalView } from '../../shared/types';
import { MissionMap } from '../admin/components/MissionMap';
import { translate, type MessageKey, type MessageParams } from '../i18n/messages';
import { ComposedImage } from '../lib/ComposedImage';
import { TILE_SIZE, routeMapView } from './routeSketch';

/** Side and margin of the map of each mission, in map pixels. */
const SKETCH_SIZE = 256;
const SKETCH_PADDING = 28;

/** Missions on each printed sheet; every format is a multiple of this. */
const MISSIONS_PER_SHEET = 6;

/** Sections of the letter common to every partner of the Mission Day. */
const INTRODUCTION: { key: keyof ProposalView['letter']; title: MessageKey }[] = [
  { key: 'aboutUs', title: 'settings.aboutUs' },
  { key: 'whatIsIngress', title: 'settings.whatIsIngress' },
  { key: 'whatIsMissionDay', title: 'settings.whatIsMissionDay' },
  { key: 'whyThisCity', title: 'settings.whyThisCity' },
];

/** Fields the partner completes by hand in the conformity block. */
const CONSENT_FIELDS: MessageKey[] = [
  'proposal.consentName',
  'proposal.consentPosition',
  'proposal.consentDate',
];

/**
 * Reads the proposal token from the address of the page.
 *
 * @returns The token and language of the address, or null if it has none.
 */
function readAddress(): { token: string; language: Language } | null {
  const parsed = parseProposalSegment(location.pathname.split('/').filter(Boolean).pop() ?? '');
  return parsed === null
    ? null
    : { token: parsed.token, language: languageOfProposalWord(parsed.word) };
}

/**
 * A block of the letter; empty texts are left out altogether.
 *
 * @param props - Optional title, and the text.
 * @returns The block element, or nothing.
 */
function LetterBlock({ title, text }: { title?: string; text: string }) {
  if (text.trim() === '') {
    return null;
  }
  return (
    <div class="letter-block">
      {title !== undefined && <h2>{title}</h2>}
      <p class="prose">{text}</p>
    </div>
  );
}

/**
 * Block the partner can sign to give its written approval, either by hand
 * on a printed copy or with an electronic signature on the saved PDF.
 *
 * @param props - The proposal and a translation function.
 * @returns The block element.
 */
function ConsentBlock({
  view,
  t,
}: {
  view: ProposalView;
  t: (key: MessageKey, params?: MessageParams) => string;
}) {
  return (
    <div class="consent">
      <h2>{t('proposal.consent')}</h2>
      <p class="prose">
        {t('proposal.consentText', {
          partner: view.partnerName,
          city: view.city,
          year: view.year,
        })}
      </p>
      <dl class="consent-fields">
        {CONSENT_FIELDS.map((field) => (
          <div key={field} class="consent-field">
            <dt>{t(field)}</dt>
            <dd />
          </div>
        ))}
        <div class="consent-field signature">
          <dt>{t('proposal.consentSignature')}</dt>
          <dd />
        </div>
      </dl>
    </div>
  );
}

/**
 * Drawing of one mission's route. Being built from a single mission's
 * portals, it can only ever show that mission.
 *
 * @param props - The mission.
 * @returns The drawing element.
 */
function RouteSketch({ mission }: { mission: ProposalMission }) {
  const view = routeMapView(mission.waypoints, SKETCH_SIZE, SKETCH_PADDING);
  if (view === null) {
    return <div class="route-sketch" />;
  }
  return (
    <svg
      class="route-sketch"
      viewBox={`0 0 ${SKETCH_SIZE} ${SKETCH_SIZE}`}
      role="img"
      aria-label={mission.name}
    >
      {view.tiles.map((tile) => (
        <image
          key={tile.url}
          href={tile.url}
          x={tile.x}
          y={tile.y}
          width={TILE_SIZE}
          height={TILE_SIZE}
        />
      ))}
      <polyline
        points={view.points.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="none"
        stroke={mission.colour}
        stroke-width="7"
      />
      {view.points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r="9"
          fill="#ffffff"
          stroke={mission.colour}
          stroke-width="5"
        />
      ))}
    </svg>
  );
}

/**
 * The round image of a mission, as the scanner shows it.
 *
 * @param props - The mission, and the addresses to use.
 * @returns The image element.
 */
function MissionImage({
  mission,
  base,
  overlayUrl,
}: {
  mission: ProposalMission;
  base: string;
  overlayUrl: string | null;
}) {
  return (
    <div class="medal" style={{ backgroundColor: mission.colour }}>
      {mission.hasPhoto && (
        <ComposedImage
          photoUrl={`${base}/missions/${mission.id}/photo?v=${mission.photoVersion}`}
          overlayUrl={overlayUrl}
          alt={mission.name}
        />
      )}
    </div>
  );
}

/**
 * One page section; when printed, each starts on a new sheet.
 *
 * @param props - Optional title, CSS class and content.
 * @returns The section element.
 */
function Sheet({
  title,
  class: className,
  children,
}: {
  title?: string;
  class?: string;
  children: ComponentChildren;
}) {
  return (
    <section class={`sheet ${className ?? ''}`}>
      {title !== undefined && <h2 class="sheet-title">{title}</h2>}
      {children}
    </section>
  );
}

/**
 * Displays a loaded proposal.
 *
 * @param props - The proposal and the root of its API.
 * @returns The document element.
 */
function Proposal({ view, base }: { view: ProposalView; base: string }) {
  /**
   * Translates a message into the language of the letter.
   *
   * @param key - Message key.
   * @param params - Placeholder values.
   * @returns The text.
   */
  const t = (key: MessageKey, params?: MessageParams) => translate(view.language, key, params);

  const title = t('proposal.title', { city: view.city, year: view.year });
  const overlayUrl = view.hasOverlay ? `${base}/overlay?v=${view.overlayVersion}` : null;
  const hasRequest = view.letter.logoRequest.trim() !== '';
  const hasPartnerSheet =
    hasRequest || view.letter.whyYou.trim() !== '' || view.letter.closing.trim() !== '';
  const mapMissions = useMemo(
    () => view.missions.map(({ id, colour, waypoints }) => ({ id, colour, waypoints })),
    [view],
  );

  useEffect(() => {
    document.documentElement.lang = view.language;
    document.title = `${title} · ${view.partnerName}`;
  }, [view, title]);

  return (
    <main class={view.hasMapScreenshot ? 'document has-screenshot' : 'document'}>
      <button type="button" class="print-button" onClick={() => print()}>
        {t('proposal.print')}
      </button>

      <Sheet class="cover">
        {view.hasLogo && (
          <img
            class="partner-logo"
            src={`${base}/logo?v=${view.logoVersion}`}
            alt={view.partnerName}
          />
        )}
        <h1>{title}</h1>
        <p class="subtitle">{t('proposal.forPartner', { partner: view.partnerName })}</p>
        {INTRODUCTION.map(({ key, title: blockTitle }) => (
          <LetterBlock key={key} title={t(blockTitle)} text={view.letter[key]} />
        ))}
      </Sheet>

      {/* Everything specific to this partner goes on a sheet of its own. */}
      {hasPartnerSheet && (
        <Sheet class="request">
          <LetterBlock title={t('proposal.whyYou')} text={view.letter.whyYou} />
          {hasRequest && (
            <div class="request-box">
              <h2>{t('proposal.logoRequest')}</h2>
              <p class="prose">{view.letter.logoRequest}</p>
            </div>
          )}
          <LetterBlock text={view.letter.closing} />
          {hasRequest && <ConsentBlock view={view} t={t} />}
        </Sheet>
      )}

      {view.missions.length > 0 && (
        <Sheet title={t('proposal.mosaic')}>
          <p class="note">{t('proposal.mosaicHelp')}</p>
          <div class="mosaic" style={{ gridTemplateColumns: `repeat(${MOSAIC_COLUMNS}, 1fr)` }}>
            {mosaicCells(view.missions).map((mission, index) =>
              mission === null ? (
                <div key={`empty-${index}`} />
              ) : (
                <MissionImage
                  key={mission.id}
                  mission={mission}
                  base={base}
                  overlayUrl={overlayUrl}
                />
              ),
            )}
          </div>
        </Sheet>
      )}

      {view.missions.length > 0 && (
        <Sheet title={t('proposal.missions')}>
          <ol class="missions">
            {view.missions.map((mission, index) => (
              <li
                key={mission.id}
                class={(index + 1) % MISSIONS_PER_SHEET === 0 ? 'mission sheet-end' : 'mission'}
              >
                <MissionImage mission={mission} base={base} overlayUrl={overlayUrl} />
                <div class="mission-text">
                  <h3>{mission.name}</h3>
                  <p class="prose">{mission.description}</p>
                  <p class="note">{t('proposal.portals', { count: mission.waypoints.length })}</p>
                </div>
                <RouteSketch mission={mission} />
              </li>
            ))}
          </ol>
          <p class="note">
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
              {t('proposal.mapCredit')}
            </a>
          </p>
        </Sheet>
      )}

      {view.missions.length > 0 && (
        <Sheet title={t('proposal.map')} class="map-sheet">
          <div class="map-interactive">
            <MissionMap missions={mapMissions} fitKey="proposal" />
          </div>
          {view.hasMapScreenshot && (
            <img
              class="map-screenshot"
              src={`${base}/map-screenshot?v=${view.mapScreenshotVersion}`}
              alt={t('proposal.map')}
            />
          )}
          {view.myMapsUrl !== null && (
            <p>
              <a href={view.myMapsUrl} target="_blank" rel="noopener">
                {t('proposal.openMyMaps')}
              </a>
            </p>
          )}
        </Sheet>
      )}
    </main>
  );
}

/**
 * Root of the page: finds the proposal named in the address and shows it.
 *
 * @returns The page element.
 */
export function ProposalApp() {
  const address = useMemo(readAddress, []);
  const [view, setView] = useState<ProposalView | null>(null);
  const [failed, setFailed] = useState(address === null);
  const base = `/api/public/proposals/${address?.token ?? ''}`;

  useEffect(() => {
    if (address === null) {
      return;
    }
    fetch(base)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<ProposalView>;
      })
      .then(setView, () => setFailed(true));
  }, [address, base]);

  if (view !== null) {
    return <Proposal view={view} base={base} />;
  }
  return (
    <main class="document">
      <p class="status">
        {translate(address?.language ?? 'en', failed ? 'proposal.invalid' : 'proposal.loading')}
      </p>
    </main>
  );
}
