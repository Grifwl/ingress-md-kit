/**
 * The participant view: what agents need to play a Mission Day. It is
 * opened from links shared in agents' channels, mostly on phones, so it
 * reads top to bottom on a narrow screen and follows the visitor's
 * language rather than the organisers'.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { resolveLocalized } from '../../shared/letter';
import { participantIntroText } from '../../shared/participant';
import { mosaicCells } from '../../shared/mosaic';
import { LANGUAGES, MEDAL_MISSIONS, MOSAIC_COLUMNS, type Language } from '../../shared/rules';
import type { ParticipantMission, ParticipantView } from '../../shared/types';
import { MissionMap } from '../admin/components/MissionMap';
import { useI18n } from '../i18n';
import { BiocardImages } from '../lib/BiocardImages';
import { ComposedImage } from '../lib/ComposedImage';
import { formatDate } from '../lib/dates';
import { intelUrl } from '../lib/intel';

/**
 * Reads the Mission Day slug from the address of the page.
 *
 * @returns The slug.
 */
function readSlug(): string {
  return location.pathname.split('/').filter(Boolean)[0] ?? '';
}

/**
 * The image of a mission, as the scanner shows it.
 *
 * @param props - The mission and the addresses of its images.
 * @returns The image element.
 */
function MissionImage({
  mission,
  base,
  overlayUrl,
}: {
  mission: ParticipantMission;
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
 * One mission of the list, with its start and the rest of its portals.
 *
 * @param props - The mission, the addresses of its images and the language.
 * @returns The list item.
 */
function MissionItem({
  mission,
  base,
  overlayUrl,
}: {
  mission: ParticipantMission;
  base: string;
  overlayUrl: string | null;
}) {
  const { t, language } = useI18n();
  const description = resolveLocalized(mission.description, language);
  const start = mission.waypoints[0];

  return (
    <li class="mission">
      <MissionImage mission={mission} base={base} overlayUrl={overlayUrl} />
      <div class="mission-text">
        <h3>{mission.name}</h3>
        {description !== '' && <p>{description}</p>}
        {start !== undefined && (
          <p>
            {t('participant.start')}{' '}
            <a href={intelUrl(start)} target="_blank" rel="noopener">
              {start.title}
            </a>
          </p>
        )}
        {mission.waypoints.length > 0 && (
          <details>
            <summary>{t('participant.portals', { count: mission.waypoints.length })}</summary>
            <ol class="portals">
              {mission.waypoints.map((point, index) => (
                <li key={index}>
                  <a href={intelUrl(point)} target="_blank" rel="noopener">
                    {point.title}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </li>
  );
}

/**
 * Displays a loaded participant view.
 *
 * @param props - The data and the root of its API.
 * @returns The page content.
 */
function Participant({ view, base }: { view: ParticipantView; base: string }) {
  const { t, language } = useI18n();
  const title = t('participant.title', { city: view.city, year: view.year });
  // The organisers' presentation replaces the default sentence, but only
  // in the languages they wrote it in: a visitor never gets it in another
  // language, but the default sentence in their own.
  const introValues = { missions: view.missions.length, medal: MEDAL_MISSIONS };
  const intro =
    participantIntroText(view.intro, language, introValues) ??
    t('participant.intro', { ...introValues });
  const overlayUrl = view.overlayTag === null ? null : `${base}/overlay?v=${view.overlayTag}`;
  const mapMissions = useMemo(
    () => view.missions.map(({ id, colour, waypoints }) => ({ id, colour, waypoints })),
    [view],
  );
  const collageUrls = useMemo(
    () =>
      view.missions
        .filter((mission) => mission.hasPhoto)
        .map((mission) => `${base}/missions/${mission.id}/photo?v=${mission.photoVersion}`),
    [view, base],
  );

  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <>
      <header class="hero">
        <h1>{title}</h1>
        {view.date !== null && <p class="date">{formatDate(view.date, language)}</p>}
        <p class="intro">{intro}</p>
      </header>

      {view.missions.length === 0 && <p class="status">{t('participant.empty')}</p>}

      {view.missions.length > 0 && (
        <section>
          <h2>{t('proposal.mosaic')}</h2>
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
        </section>
      )}

      {view.missions.length > 0 && (
        <section>
          <h2>{t('proposal.map')}</h2>
          <div class="map-frame">
            <MissionMap missions={mapMissions} fitKey="participant" />
          </div>
          {view.myMapsUrl !== null && (
            <p>
              <a href={view.myMapsUrl} target="_blank" rel="noopener">
                {t('proposal.openMyMaps')}
              </a>
            </p>
          )}
        </section>
      )}

      {view.biocard !== null && (
        <section>
          <h2>{t('participant.biocard')}</h2>
          <BiocardImages
            biocard={view.biocard}
            base={base}
            language={language}
            collageUrls={collageUrls}
            frontAlt={t('biocard.front')}
            backAlt={t('biocard.back')}
          />
        </section>
      )}

      {view.missions.length > 0 && (
        <section>
          <h2>{t('proposal.missions')}</h2>
          <p class="note">{t('participant.orderNote')}</p>
          <ol class="missions">
            {view.missions.map((mission) => (
              <MissionItem key={mission.id} mission={mission} base={base} overlayUrl={overlayUrl} />
            ))}
          </ol>
        </section>
      )}
    </>
  );
}

/**
 * Root of the page: loads the Mission Day named in the address.
 *
 * @returns The page element.
 */
export function ParticipantApp() {
  const { t, language, setLanguage } = useI18n();
  const base = `/api/public/mission-days/${encodeURIComponent(readSlug())}`;
  const [view, setView] = useState<ParticipantView | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(base)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<ParticipantView>;
      })
      .then(setView, () => setFailed(true));
  }, [base]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <main class="page">
      <div class="toolbar">
        <select
          aria-label={t('app.language')}
          value={language}
          onChange={(event) => setLanguage(event.currentTarget.value as Language)}
        >
          {LANGUAGES.map((option) => (
            <option key={option} value={option}>
              {option.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
      {view !== null && <Participant view={view} base={base} />}
      {view === null && (
        <p class="status">{t(failed ? 'participant.unavailable' : 'app.loading')}</p>
      )}
      <footer class="note">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
          {t('proposal.mapCredit')}
        </a>
      </footer>
    </main>
  );
}
