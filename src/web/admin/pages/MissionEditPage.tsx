/**
 * Editing one candidate mission: texts, photo, portals and route.
 */
import { useMemo, useState } from 'preact/hooks';
import {
  LANGUAGES,
  MISSION_DESCRIPTION_MAX_LENGTH,
  MISSION_NAME_MAX_LENGTH,
  WAYPOINTS_MAX,
  WAYPOINTS_MIN,
  characterCount,
  fullMissionName,
  validateMission,
} from '../../../shared/rules';
import type { LocalizedText, Mission, MissionDayWithRole, Waypoint } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { deleteMission, saveWaypoints, updateMission } from '../api';
import { ConfirmButton, ErrorMessage, Field, IssueList } from '../components/common';
import { MissionMap } from '../components/MissionMap';
import { PhotoCropper } from '../components/PhotoCropper';
import { parseCoordinates } from '../lib/coordinates';
import { Link, navigate } from '../router';

/**
 * Renumbers waypoints after an addition, removal or move.
 *
 * @param waypoints - Waypoints in their new order.
 * @returns The same waypoints with consecutive positions.
 */
function renumber(waypoints: readonly Waypoint[]): Waypoint[] {
  return waypoints.map((waypoint, position) => ({ ...waypoint, position }));
}

/**
 * Character counter that highlights when a limit is exceeded.
 *
 * @param props - Current text and limit.
 * @returns The counter element.
 */
function Counter({ text, max }: { text: string; max: number }) {
  const length = characterCount(text);
  return (
    <span class={length > max ? 'counter over' : 'counter'}>
      {length}/{max}
    </span>
  );
}

/**
 * The mission editor.
 *
 * @param props - The Mission Day, the mission, and callbacks for changes.
 * @returns The page element.
 */
export function MissionEditPage({
  missionDay,
  mission,
  onChange,
  onDeleted,
}: {
  missionDay: MissionDayWithRole;
  mission: Mission;
  onChange: (mission: Mission) => void;
  onDeleted: (missionId: string) => void;
}) {
  const { t } = useI18n();
  const [landmark, setLandmark] = useState(mission.landmark);
  const [description, setDescription] = useState<LocalizedText>(mission.description);
  const [notes, setNotes] = useState(mission.notes);
  const [colour, setColour] = useState(mission.colour);
  const [waypoints, setWaypoints] = useState<Waypoint[]>(mission.waypoints);
  const [coordinates, setCoordinates] = useState('');
  const [badCoordinates, setBadCoordinates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();

  const missionsPath = `/admin/${missionDay.slug}/missions`;
  const fullName = fullMissionName(missionDay, landmark);

  // The checks and the map follow the form as it is typed, before saving.
  const draft = useMemo<Mission>(
    () => ({ ...mission, landmark, description, notes, colour, waypoints }),
    [mission, landmark, description, notes, colour, waypoints],
  );
  const issues = useMemo(() => validateMission(draft, missionDay), [draft, missionDay]);
  const mapMissions = useMemo(() => [draft], [draft]);

  /**
   * Appends a portal to the route.
   *
   * @param lat - Latitude.
   * @param lng - Longitude.
   */
  const addWaypoint = (lat: number, lng: number) => {
    setSaved(false);
    setWaypoints((current) => [
      ...current,
      {
        position: current.length,
        portalGuid: null,
        title: t('mission.portalDefaultTitle', { number: current.length + 1 }),
        lat,
        lng,
        imageUrl: null,
      },
    ]);
  };

  /**
   * Adds the portal described in the coordinates field.
   *
   * @param event - Form or button event.
   */
  const addFromCoordinates = (event: Event) => {
    event.preventDefault();
    const position = parseCoordinates(coordinates);
    setBadCoordinates(position === null);
    if (position !== null) {
      addWaypoint(position.lat, position.lng);
      setCoordinates('');
    }
  };

  /**
   * Swaps a portal with its neighbour.
   *
   * @param index - Position of the portal.
   * @param offset - -1 to move it earlier, 1 to move it later.
   */
  const moveWaypoint = (index: number, offset: -1 | 1) => {
    setSaved(false);
    setWaypoints((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + offset, 0, item!);
      return renumber(next);
    });
  };

  /**
   * Saves texts and portals together.
   *
   * @param event - Form submission.
   */
  const save = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(undefined);
    try {
      await updateMission(missionDay.slug, mission.id, { landmark, description, notes, colour });
      onChange(
        await saveWaypoints(missionDay.slug, mission.id, waypoints).then((updated) => ({
          ...updated,
          landmark,
          description,
          notes,
          colour,
        })),
      );
      setSaved(true);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  /** Deletes the mission and returns to the list. */
  const remove = async () => {
    setError(undefined);
    try {
      await deleteMission(missionDay.slug, mission.id);
      onDeleted(mission.id);
      navigate(missionsPath);
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <div class="stack">
      <Link href={missionsPath} class="back-link">
        ← {t('mission.back')}
      </Link>

      <form class="stack" onSubmit={save}>
        <section class="card">
          <Field label={t('mission.landmark')}>
            <input value={landmark} onInput={(e) => setLandmark(e.currentTarget.value)} />
          </Field>
          <p class="full-name">
            <span class="field-label">{t('mission.fullName')}</span> {fullName}{' '}
            <Counter text={fullName} max={MISSION_NAME_MAX_LENGTH} />
          </p>
          <h3>{t('mission.description')}</h3>
          {LANGUAGES.map((language) => (
            <Field key={language} label={language.toUpperCase()}>
              <textarea
                rows={3}
                value={description[language] ?? ''}
                onInput={(e) =>
                  setDescription({ ...description, [language]: e.currentTarget.value })
                }
              />
              <Counter text={description[language] ?? ''} max={MISSION_DESCRIPTION_MAX_LENGTH} />
            </Field>
          ))}
          <div class="grid-2">
            <Field label={t('mission.notes')}>
              <textarea rows={3} value={notes} onInput={(e) => setNotes(e.currentTarget.value)} />
            </Field>
            <Field label={t('mission.colour')}>
              <input
                type="color"
                value={colour}
                onInput={(e) => setColour(e.currentTarget.value)}
              />
            </Field>
          </div>
        </section>

        <section class="card">
          <div class="heading-row">
            <h2>{t('mission.route')}</h2>
            <span
              class={
                waypoints.length < WAYPOINTS_MIN || waypoints.length > WAYPOINTS_MAX
                  ? 'badge warn'
                  : 'badge ok'
              }
            >
              {t('mission.portalCount', {
                count: waypoints.length,
                min: WAYPOINTS_MIN,
                max: WAYPOINTS_MAX,
              })}
            </span>
          </div>
          <p class="muted">{t('mission.routeHelp')}</p>
          <MissionMap missions={mapMissions} onMapClick={addWaypoint} fitKey={mission.id} />
          <div class="inline-form">
            <input
              placeholder={t('mission.coordinates')}
              aria-label={t('mission.coordinates')}
              value={coordinates}
              onInput={(e) => setCoordinates(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addFromCoordinates(e);
              }}
            />
            <button type="button" class="button" onClick={addFromCoordinates}>
              {t('mission.addPortal')}
            </button>
          </div>
          {badCoordinates && <p class="alert">{t('mission.invalidCoordinates')}</p>}
          {waypoints.length === 0 && <p class="muted">{t('mission.noPortals')}</p>}
          <ol class="waypoints">
            {waypoints.map((waypoint, index) => (
              <li key={`${waypoint.lat},${waypoint.lng},${index}`}>
                <span class="waypoint-number">{index + 1}</span>
                <input
                  aria-label={t('mission.portalTitle')}
                  value={waypoint.title}
                  onInput={(e) => {
                    const title = e.currentTarget.value;
                    setSaved(false);
                    setWaypoints((current) =>
                      current.map((item, at) => (at === index ? { ...item, title } : item)),
                    );
                  }}
                />
                <button
                  type="button"
                  class="icon-button"
                  title={t('common.moveUp')}
                  aria-label={t('common.moveUp')}
                  disabled={index === 0}
                  onClick={() => moveWaypoint(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="icon-button"
                  title={t('common.moveDown')}
                  aria-label={t('common.moveDown')}
                  disabled={index === waypoints.length - 1}
                  onClick={() => moveWaypoint(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="icon-button"
                  title={t('common.remove')}
                  aria-label={t('common.remove')}
                  onClick={() => {
                    setSaved(false);
                    setWaypoints((current) => renumber(current.filter((_, at) => at !== index)));
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        </section>

        <ErrorMessage error={error} />
        <div class="actions">
          <button class="button primary" disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
          {saved && <span class="muted">{t('common.saved')}</span>}
          {missionDay.role === 'owner' && <ConfirmButton onConfirm={remove} disabled={busy} />}
        </div>
      </form>

      <section class="card">
        <h2>{t('mission.photo')}</h2>
        <PhotoCropper
          slug={missionDay.slug}
          mission={mission}
          onUploaded={(updated) =>
            onChange({
              ...mission,
              hasPhoto: updated.hasPhoto,
              photoVersion: updated.photoVersion,
              crop: updated.crop,
              photoFullSize: updated.photoFullSize,
            })
          }
        />
      </section>

      {issues.length > 0 && (
        <section class="card">
          <h2>{t('mission.review')}</h2>
          <IssueList issues={issues} missionDay={missionDay} />
        </section>
      )}
    </div>
  );
}
