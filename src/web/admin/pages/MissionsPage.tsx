/**
 * List of candidate missions.
 */
import { useState } from 'preact/hooks';
import { fullMissionName, validateMission } from '../../../shared/rules';
import type { Mission, MissionDay } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { createMission, photoUrl } from '../api';
import { ErrorMessage } from '../components/common';
import { Link, navigate } from '../router';

/**
 * The candidates screen.
 *
 * @param props - The Mission Day, its missions and a callback for a new one.
 * @returns The page element.
 */
export function MissionsPage({
  missionDay,
  missions,
  onCreated,
}: {
  missionDay: MissionDay;
  missions: readonly Mission[];
  onCreated: (mission: Mission) => void;
}) {
  const { t } = useI18n();
  const [landmark, setLandmark] = useState('');
  const [error, setError] = useState<unknown>();
  const selectedCount = missions.filter((mission) => mission.selected).length;

  /**
   * Creates a mission and opens it for editing.
   *
   * @param event - Form submission.
   */
  const add = async (event: Event) => {
    event.preventDefault();
    setError(undefined);
    try {
      const mission = await createMission(missionDay.slug, landmark.trim());
      onCreated(mission);
      setLandmark('');
      navigate(`/admin/${missionDay.slug}/missions/${mission.id}`);
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <div class="stack">
      <div class="heading-row">
        <h2>{t('missions.title')}</h2>
        <span class="muted">
          {t('missions.count', { count: missions.length, selected: selectedCount })}
        </span>
      </div>
      <form class="inline-form" onSubmit={add}>
        <input
          required
          placeholder={t('missions.newPlaceholder')}
          aria-label={t('missions.newPlaceholder')}
          value={landmark}
          onInput={(e) => setLandmark(e.currentTarget.value)}
        />
        <button class="button primary">{t('missions.add')}</button>
      </form>
      <ErrorMessage error={error} />
      {missions.length === 0 && <p class="muted">{t('missions.empty')}</p>}
      <ul class="mission-list">
        {missions.map((mission) => {
          const problems = validateMission(mission, missionDay).length;
          return (
            <li key={mission.id}>
              <Link href={`/admin/${missionDay.slug}/missions/${mission.id}`} class="mission-row">
                <span class="thumb" style={{ backgroundColor: mission.colour }}>
                  {mission.hasPhoto && (
                    <img src={photoUrl(missionDay.slug, mission)} alt="" loading="lazy" />
                  )}
                </span>
                <span class="mission-name">
                  {mission.landmark === ''
                    ? t('missions.untitled')
                    : fullMissionName(missionDay, mission.landmark)}
                </span>
                <span class="muted">
                  {t('missions.portals', { count: mission.waypoints.length })}
                </span>
                {mission.selected && (
                  <span class="badge">
                    {t('missions.selectedBadge', { order: mission.recommendedOrder ?? '' })}
                  </span>
                )}
                <span class={problems > 0 ? 'badge warn' : 'badge ok'}>
                  {problems > 0 ? t('missions.problems', { count: problems }) : t('missions.ok')}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
