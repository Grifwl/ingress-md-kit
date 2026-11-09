/**
 * Small drawing of one mission's route. It is plain vector data, light
 * enough for every mission to have one and sharp when printed.
 */
import type { Waypoint } from '../../shared/types';

/** A point of the drawing. */
export interface SketchPoint {
  x: number;
  y: number;
}

/** Degrees below which a route counts as having no extent. */
const MIN_SPAN = 1e-9;

/**
 * Fits a route into a square, keeping its shape. Longitude is narrowed
 * by the latitude, as on a map, or routes would look stretched.
 *
 * @param waypoints - Portals of the mission, in order.
 * @param size - Side of the square.
 * @param padding - Margin left on each side.
 * @returns The points, in order, with y growing downwards.
 */
export function sketchRoute(
  waypoints: readonly Pick<Waypoint, 'lat' | 'lng'>[],
  size: number,
  padding: number,
): SketchPoint[] {
  if (waypoints.length === 0) {
    return [];
  }
  const meanLat = waypoints.reduce((sum, point) => sum + point.lat, 0) / waypoints.length;
  const narrowing = Math.cos((meanLat * Math.PI) / 180);
  const projected = waypoints.map((point) => ({ x: point.lng * narrowing, y: -point.lat }));

  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const span = Math.max(maxX - minX, maxY - minY);
  const scale = span < MIN_SPAN ? 0 : (size - 2 * padding) / span;

  // The route is centred, so a narrow one does not hug a side.
  const offsetX = (size - (maxX - minX) * scale) / 2;
  const offsetY = (size - (maxY - minY) * scale) / 2;
  return projected.map((point) => ({
    x: (point.x - minX) * scale + offsetX,
    y: (point.y - minY) * scale + offsetY,
  }));
}
