/**
 * Bringing back a file edited with Ultimate Mission Maker. Nothing is saved
 * until the organiser has seen what would change and confirmed it.
 */
import { useState } from 'preact/hooks';
import { fullMissionName } from '../../../shared/rules';
import type { Mission, MissionDay } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { diffUmmImport, hasChanges, parseUmmFile, type UmmMissionDiff } from '../../lib/umm';
import {
  createMission,
  getUmmManifest,
  listMissions,
  saveUmmManifest,
  saveWaypoints,
} from '../api';
import { ErrorMessage, Field } from './common';

/** A file that has been read and is waiting for confirmation. */
interface PendingImport {
  diffs: UmmMissionDiff[];
  manifest: string[];
}

/**
 * The import section.
 *
 * @param props - The Mission Day, its missions and a callback for the result.
 * @returns The section element.
 */
export function UmmImport({
  missionDay,
  missions,
  onImported,
}: {
  missionDay: MissionDay;
  missions: readonly Mission[];
  onImported: (missions: Mission[]) => void;
}) {
  const { t, tDynamic } = useI18n();
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  /**
   * Reads a file and works out its changes.
   *
   * @param input - The file input.
   */
  const open = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) {
      return;
    }
    setPending(null);
    setFileError(null);
    setError(undefined);
    setDone(false);
    const parsed = parseUmmFile(await file.text());
    if (!parsed.ok) {
      setFileError(parsed.error);
      return;
    }
    try {
      const manifest = await getUmmManifest(missionDay.slug);
      setPending({ diffs: diffUmmImport(parsed.missions, manifest, missions), manifest });
    } catch (failure) {
      setError(failure);
    }
  };

  /** Saves the changes, one mission at a time. */
  const confirm = async () => {
    if (pending === null) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      // One request per mission keeps each within the free-tier limit of
      // database queries; if one fails, importing again finishes the work.
      const manifest = [...pending.manifest];
      for (const diff of pending.diffs.filter(hasChanges)) {
        const missionId = diff.missionId ?? (await createMission(missionDay.slug, '')).id;
        await saveWaypoints(missionDay.slug, missionId, diff.waypoints);
        manifest[diff.position] = missionId;
      }
      await saveUmmManifest(missionDay.slug, manifest);
      onImported(await listMissions(missionDay.slug));
      setPending(null);
      setDone(true);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Finds the name to display for an entry.
   *
   * @param diff - The entry.
   * @returns The name of the mission.
   */
  const nameOf = (diff: UmmMissionDiff) => {
    const mission = missions.find((item) => item.id === diff.missionId);
    return mission === undefined
      ? t('exports.importNew', { position: diff.position + 1 })
      : fullMissionName(missionDay, mission.landmark);
  };

  const changed = pending?.diffs.filter(hasChanges) ?? [];

  return (
    <section class="card">
      <h2>{t('exports.importTitle')}</h2>
      <p class="muted">{t('exports.importHelp')}</p>
      <Field label={t('exports.importFile')}>
        <input
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={(event) => open(event.currentTarget)}
        />
      </Field>
      {fileError !== null && <p class="alert">{tDynamic(`exports.importError.${fileError}`)}</p>}
      <ErrorMessage error={error} />
      {done && <p class="success">{t('exports.importDone')}</p>}

      {pending !== null && (
        <>
          <p>
            {t('exports.importSummary', {
              changed: changed.length,
              same: pending.diffs.length - changed.length,
            })}
          </p>
          {changed.length > 0 && (
            <table class="import-table">
              <thead>
                <tr>
                  <th>{t('exports.importMission')}</th>
                  <th>{t('exports.importChanges')}</th>
                </tr>
              </thead>
              <tbody>
                {changed.map((diff) => (
                  <tr key={diff.position}>
                    <td>{nameOf(diff)}</td>
                    <td>
                      {t('exports.importCounts', { added: diff.added, removed: diff.removed })}
                      {diff.reordered && ` · ${t('exports.importReordered')}`}
                      {diff.outOfRange && (
                        <div class="counter over">
                          {t('exports.importOutOfRange', { count: diff.waypoints.length })}
                        </div>
                      )}
                      {diff.otherObjectives > 0 && (
                        <div class="counter over">
                          {t('exports.importObjectives', { count: diff.otherObjectives })}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button
            type="button"
            class="button primary"
            disabled={busy || changed.length === 0}
            onClick={confirm}
          >
            {busy ? t('common.saving') : t('exports.importConfirm')}
          </button>
        </>
      )}
    </section>
  );
}
