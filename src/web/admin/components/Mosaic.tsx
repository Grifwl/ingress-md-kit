/**
 * The 6-column mosaic of the selected missions.
 */
import { mosaicCells } from '../../../shared/mosaic';
import { fullMissionName, MOSAIC_COLUMNS } from '../../../shared/rules';
import type { Mission, MissionDay } from '../../../shared/types';
import { ComposedImage } from '../../lib/ComposedImage';
import { photoUrl } from '../api';

/**
 * Displays the selected missions. Layout comes from `mosaicCells`, the
 * only place that knows how the grid is ordered.
 *
 * @param props - The Mission Day, its selected missions in order, and the
 *   overlay to apply, if any.
 * @returns The grid element.
 */
export function Mosaic({
  missionDay,
  selected,
  overlayUrl,
}: {
  missionDay: MissionDay;
  selected: readonly Mission[];
  overlayUrl: string | null;
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
              <ComposedImage
                photoUrl={photoUrl(missionDay.slug, mission)}
                overlayUrl={overlayUrl}
                alt={name}
              />
            ) : (
              <span class="mosaic-landmark">{mission.landmark}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
