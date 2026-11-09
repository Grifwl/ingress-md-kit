/**
 * Choosing the final missions, their recommended order and the mosaic.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { mosaicAdjacentPairs, mosaicCells, type MosaicPair } from '../../../shared/mosaic';
import { MISSION_FORMATS, fullMissionName, validateSelection } from '../../../shared/rules';
import type { Mission, MissionDay } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { defaultOverlayUrl, photoUrl, saveSelection } from '../api';
import { ErrorMessage, IssueList } from '../components/common';
import { Mosaic } from '../components/Mosaic';
import { findBannerLikePairs } from '../lib/bannerCheck';
import { applySelection, placeInSelection, selectedInOrder } from '../lib/selection';

/**
 * Runs the banner-set check whenever the images in the mosaic change.
 * Being only advice, a failure to load some image simply shows no warning.
 *
 * @param missionDay - The Mission Day.
 * @param selected - Selected missions, in order.
 * @returns The pairs that look like one picture.
 */
function useBannerWarnings(
  missionDay: MissionDay,
  selected: readonly Mission[],
): MosaicPair<Mission>[] {
  const [pairs, setPairs] = useState<MosaicPair<Mission>[]>([]);
  const signature = selected.map((m) => `${m.id}:${m.photoVersion}`).join('|');

  useEffect(() => {
    let active = true;
    const photographed = mosaicCells(selected).map((mission) =>
      mission?.hasPhoto ? mission : null,
    );
    findBannerLikePairs(mosaicAdjacentPairs(photographed), (mission) =>
      photoUrl(missionDay.slug, mission),
    ).then(
      (found) => {
        if (active) setPairs(found);
      },
      () => {
        if (active) setPairs([]);
      },
    );
    return () => {
      active = false;
    };
    // `signature` captures everything about `selected` that matters here.
  }, [missionDay.slug, signature]);

  return pairs;
}

/**
 * The selection screen.
 *
 * @param props - The Mission Day, its missions and a callback for changes.
 * @returns The page element.
 */
export function SelectionPage({
  missionDay,
  missions,
  onChange,
}: {
  missionDay: MissionDay;
  missions: readonly Mission[];
  onChange: (missions: Mission[]) => void;
}) {
  const { t } = useI18n();
  const [error, setError] = useState<unknown>();
  const draggedRef = useRef<string | null>(null);

  const selected = useMemo(() => selectedInOrder(missions), [missions]);
  const candidates = useMemo(() => missions.filter((mission) => !mission.selected), [missions]);
  const issues = useMemo(() => validateSelection(missionDay, missions), [missionDay, missions]);
  const bannerPairs = useBannerWarnings(missionDay, selected);
  const expected = MISSION_FORMATS[missionDay.format].missions;
  const selectedIds = selected.map((mission) => mission.id);

  /**
   * Shows a new selection at once and saves it, reverting on failure.
   *
   * @param ids - New selection, in order.
   */
  const commit = async (ids: string[]) => {
    const previous = [...missions];
    setError(undefined);
    onChange(applySelection(missions, ids));
    try {
      onChange(await saveSelection(missionDay.slug, ids));
    } catch (failure) {
      onChange(previous);
      setError(failure);
    }
  };

  /**
   * Drops the dragged mission at a position of the selection.
   *
   * @param event - Drop event.
   * @param index - Destination position.
   */
  const dropAt = (event: DragEvent, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    if (draggedRef.current !== null) {
      void commit(placeInSelection(selectedIds, draggedRef.current, index));
      draggedRef.current = null;
    }
  };

  /**
   * Returns the dragged mission to the candidates.
   *
   * @param event - Drop event.
   */
  const dropOnCandidates = (event: DragEvent) => {
    event.preventDefault();
    const dragged = draggedRef.current;
    if (dragged !== null && selectedIds.includes(dragged)) {
      void commit(selectedIds.filter((id) => id !== dragged));
    }
    draggedRef.current = null;
  };

  /**
   * Gets the name displayed for a mission.
   *
   * @param mission - The mission.
   * @returns Its landmark, or a placeholder.
   */
  const label = (mission: Mission) =>
    mission.landmark === '' ? t('missions.untitled') : mission.landmark;

  /**
   * Builds the attributes that make a row draggable.
   *
   * @param id - Mission of the row.
   * @returns The attributes.
   */
  const dragProps = (id: string) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => {
      draggedRef.current = id;
      // Firefox only starts a drag when some data has been set.
      event.dataTransfer?.setData('text/plain', id);
    },
  });

  /**
   * Allows dropping on an element.
   *
   * @param event - Drag-over event.
   */
  const allowDrop = (event: DragEvent) => event.preventDefault();

  return (
    <div class="stack">
      <div class="heading-row">
        <h2>{t('selection.title')}</h2>
        <span class={selected.length === expected ? 'badge ok' : 'badge warn'}>
          {t('selection.progress', { count: selected.length, expected })}
        </span>
      </div>
      <ErrorMessage error={error} />

      <div class="selection-columns">
        <section
          class="card"
          onDragOver={allowDrop}
          onDrop={(event) => dropAt(event, selectedIds.length)}
        >
          <h3>{t('selection.selected')}</h3>
          <p class="muted">{t('selection.selectedHelp')}</p>
          {selected.length === 0 && <p class="drop-hint">{t('selection.emptySelected')}</p>}
          <ol class="pick-list">
            {selected.map((mission, index) => (
              <li
                key={mission.id}
                {...dragProps(mission.id)}
                onDragOver={allowDrop}
                onDrop={(event) => dropAt(event, index)}
              >
                <span class="waypoint-number">{index + 1}</span>
                <span class="dot" style={{ backgroundColor: mission.colour }} />
                <span class="pick-name">{label(mission)}</span>
                <button
                  type="button"
                  class="icon-button"
                  title={t('common.moveUp')}
                  aria-label={t('common.moveUp')}
                  disabled={index === 0}
                  onClick={() => commit(placeInSelection(selectedIds, mission.id, index - 1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="icon-button"
                  title={t('common.moveDown')}
                  aria-label={t('common.moveDown')}
                  disabled={index === selected.length - 1}
                  onClick={() => commit(placeInSelection(selectedIds, mission.id, index + 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="icon-button"
                  title={t('common.remove')}
                  aria-label={t('common.remove')}
                  onClick={() => commit(selectedIds.filter((id) => id !== mission.id))}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section class="card" onDragOver={allowDrop} onDrop={dropOnCandidates}>
          <h3>{t('selection.candidates')}</h3>
          {candidates.length === 0 && <p class="muted">{t('selection.emptyCandidates')}</p>}
          <ul class="pick-list">
            {candidates.map((mission) => (
              <li key={mission.id} {...dragProps(mission.id)}>
                <span class="dot" style={{ backgroundColor: mission.colour }} />
                <span class="pick-name">{label(mission)}</span>
                <button
                  type="button"
                  class="icon-button"
                  title={t('selection.add')}
                  aria-label={t('selection.add')}
                  onClick={() => commit([...selectedIds, mission.id])}
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section class="card">
        <h2>{t('selection.mosaic')}</h2>
        <p class="muted">{t('selection.mosaicHelp')}</p>
        <Mosaic
          missionDay={missionDay}
          selected={selected}
          overlayUrl={defaultOverlayUrl(missionDay)}
        />
      </section>

      <section class="card">
        <h2>{t('selection.validation')}</h2>
        {issues.length === 0 && bannerPairs.length === 0 && (
          <p class="success">{t('selection.allGood')}</p>
        )}
        <IssueList issues={issues} missions={missions} missionDay={missionDay} />
        {bannerPairs.length > 0 && (
          <ul class="issues">
            {bannerPairs.map((pair) => (
              <li key={`${pair.first.id}-${pair.second.id}`} class="issue warning">
                <span class="issue-severity">{t('severity.warning')}</span>
                <span>
                  {t('selection.bannerWarning', {
                    first: fullMissionName(missionDay, pair.first.landmark),
                    second: fullMissionName(missionDay, pair.second.landmark),
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
