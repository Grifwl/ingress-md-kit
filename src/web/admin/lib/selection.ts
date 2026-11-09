/**
 * Pure operations on the final selection, used by the selection screen.
 */
import type { Mission } from '../../../shared/types';

/**
 * Sorts the selected missions by their recommended order.
 *
 * @param missions - All candidates.
 * @returns The selected ones, first mission first.
 */
export function selectedInOrder(missions: readonly Mission[]): Mission[] {
  return missions
    .filter((mission) => mission.selected)
    .sort(
      (a, b) =>
        (a.recommendedOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.recommendedOrder ?? Number.MAX_SAFE_INTEGER),
    );
}

/**
 * Orders the list of candidates: the selected missions first, in their
 * recommended order, so the list agrees with every other screen, and then
 * the rest in the order they were received, which is creation order.
 *
 * @param missions - All candidates, in creation order.
 * @returns The same missions, ready to list.
 */
export function candidatesForList(missions: readonly Mission[]): Mission[] {
  return [...selectedInOrder(missions), ...missions.filter((mission) => !mission.selected)];
}

/**
 * Places a mission at a position of the selection, adding it if needed.
 *
 * @param ids - Current selection, in order.
 * @param id - Mission to place.
 * @param index - Position in the list once the mission has been taken out of it.
 * @returns The new selection.
 */
export function placeInSelection(ids: readonly string[], id: string, index: number): string[] {
  const others = ids.filter((other) => other !== id);
  const position = Math.max(0, Math.min(index, others.length));
  return [...others.slice(0, position), id, ...others.slice(position)];
}

/**
 * Returns the missions as they will be once a selection is saved, so the
 * screen can react at once while the request is in flight.
 *
 * @param missions - All candidates.
 * @param ids - New selection, in order.
 * @returns The updated missions.
 */
export function applySelection(missions: readonly Mission[], ids: readonly string[]): Mission[] {
  const positions = new Map(ids.map((id, index) => [id, index + 1]));
  return missions.map((mission) => ({
    ...mission,
    selected: positions.has(mission.id),
    recommendedOrder: positions.get(mission.id) ?? null,
  }));
}
