/**
 * The 6-column mosaic of the selected missions.
 */
import { mosaicCells } from '../../../shared/mosaic';
import { fullMissionName, MOSAIC_COLUMNS } from '../../../shared/rules';
import type { Mission, MissionDay } from '../../../shared/types';
import { photoUrl } from '../api';

/**
 * Displays the selected missions. Layout comes from `mosaicCells`, the
 * only place that knows how the grid is ordered.
 *
 * @param props - The Mission Day and its selected missions, in order.
 * @returns The grid element.
 */
export function Mosaic({
  missionDay,
  selected,
}: {
  missionDay: MissionDay;
  selected: readonly Mission[];
}) {
  return (
    <div class="mosaic" style={{ gridTemplateColumns: `repeat(${MOSAIC_COLUMNS}, 1fr)` }}>
      {mosaicCells(selected).map((mission, index) => {
        if (mission === null) {
          return <div key={`empty-${index}`} class="mosaic-cell empty" />;
        }
        const name = fullMissionName(missionDay, mission.landmark);
        return (
          <div
            key={mission.id}
            class="mosaic-cell"
            style={{ backgroundColor: mission.colour }}
            title={name}
          >
            {mission.hasPhoto ? (
              <img src={photoUrl(missionDay.slug, mission)} alt={name} loading="lazy" />
            ) : (
              <span class="mosaic-landmark">{mission.landmark}</span>
            )}
            <span class="mosaic-order">{mission.recommendedOrder}</span>
          </div>
        );
      })}
    </div>
  );
}
