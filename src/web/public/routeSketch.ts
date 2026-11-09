/**
 * Small map of one mission's route: the OpenStreetMap tiles around it and
 * the route drawn on top. Tiles are positioned by hand instead of using a
 * full map per mission, which keeps a set of 24 light and prints reliably.
 */
import type { Waypoint } from '../../shared/types';

/** Side of a map tile, in map pixels. */
export const TILE_SIZE = 256;

/** Closest zoom used, so that a very short route still shows its streets. */
const MAX_ZOOM = 18;

/** Latitude where the square world of web maps ends. */
const MAX_LATITUDE = 85.05112878;

/** A point in the drawing. */
export interface MapPoint {
  x: number;
  y: number;
}

/** One map tile and where it goes in the drawing. */
export interface MapTile extends MapPoint {
  url: string;
}

/** What is needed to draw a route over its map. */
export interface RouteMapView {
  tiles: MapTile[];
  points: MapPoint[];
}

/**
 * Converts a position to pixels of the web map at a zoom level.
 *
 * @param point - Geographic position.
 * @param zoom - Zoom level.
 * @returns The position in map pixels.
 */
function worldPixel(point: Pick<Waypoint, 'lat' | 'lng'>, zoom: number): MapPoint {
  const scale = TILE_SIZE * 2 ** zoom;
  const lat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, point.lat));
  const sine = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((point.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale,
  };
}

/**
 * Works out the map of a route: the closest zoom at which it fits, the
 * tiles needed to cover the drawing, and the route's position over them.
 *
 * @param waypoints - Portals of the mission, in order.
 * @param size - Side of the square drawing, in map pixels.
 * @param padding - Margin kept around the route.
 * @returns The map, or null for a route without portals.
 */
export function routeMapView(
  waypoints: readonly Pick<Waypoint, 'lat' | 'lng'>[],
  size: number,
  padding: number,
): RouteMapView | null {
  if (waypoints.length === 0) {
    return null;
  }

  let zoom = MAX_ZOOM;
  let pixels = waypoints.map((point) => worldPixel(point, zoom));
  /**
   * Measures the largest side of the route at the current zoom.
   *
   * @returns Its extent, in map pixels.
   */
  const extent = () =>
    Math.max(
      Math.max(...pixels.map((p) => p.x)) - Math.min(...pixels.map((p) => p.x)),
      Math.max(...pixels.map((p) => p.y)) - Math.min(...pixels.map((p) => p.y)),
    );
  while (zoom > 0 && extent() > size - 2 * padding) {
    zoom -= 1;
    pixels = waypoints.map((point) => worldPixel(point, zoom));
  }

  const centre = {
    x: (Math.min(...pixels.map((p) => p.x)) + Math.max(...pixels.map((p) => p.x))) / 2,
    y: (Math.min(...pixels.map((p) => p.y)) + Math.max(...pixels.map((p) => p.y))) / 2,
  };
  const left = centre.x - size / 2;
  const top = centre.y - size / 2;

  const tiles: MapTile[] = [];
  const tileCount = 2 ** zoom;
  for (let row = Math.floor(top / TILE_SIZE); row * TILE_SIZE < top + size; row += 1) {
    if (row < 0 || row >= tileCount) {
      continue;
    }
    for (let column = Math.floor(left / TILE_SIZE); column * TILE_SIZE < left + size; column += 1) {
      // The world repeats sideways, so a column past either edge wraps around.
      const wrapped = ((column % tileCount) + tileCount) % tileCount;
      tiles.push({
        url: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${row}.png`,
        x: column * TILE_SIZE - left,
        y: row * TILE_SIZE - top,
      });
    }
  }

  return { tiles, points: pixels.map((p) => ({ x: p.x - left, y: p.y - top })) };
}
