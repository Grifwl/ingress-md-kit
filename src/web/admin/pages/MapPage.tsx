/**
 * Overview map of the candidate missions.
 */
import { useMemo, useState } from 'preact/hooks';
import type { Mission } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { MissionMap } from '../components/MissionMap';

/**
 * The map screen.
 *
 * @param props - The missions of the Mission Day.
 * @returns The page element.
 */
export function MapPage({ missions }: { missions: readonly Mission[] }) {
  const { t } = useI18n();
  const [onlySelected, setOnlySelected] = useState(false);
  const shown = useMemo(
    () => (onlySelected ? missions.filter((mission) => mission.selected) : missions),
    [missions, onlySelected],
  );

  return (
    <div class="stack">
      <div class="heading-row">
        <h2>{t('map.title')}</h2>
        <label class="check">
          <input
            type="checkbox"
            checked={onlySelected}
            onChange={(e) => setOnlySelected(e.currentTarget.checked)}
          />
          {t('map.onlySelected')}
        </label>
      </div>
      <MissionMap missions={shown} fitKey={String(onlySelected)} />
    </div>
  );
}
