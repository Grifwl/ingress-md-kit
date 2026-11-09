import { describe, expect, it } from 'vitest';
import { TILE_SIZE, routeMapView } from './routeSketch';

const SIZE = 256;
const PADDING = 28;

describe('routeMapView', () => {
  it('returns nothing for a route without portals', () => {
    expect(routeMapView([], SIZE, PADDING)).toBeNull();
  });

  it('centres a single portal at the closest zoom', () => {
    const view = routeMapView([{ lat: 10, lng: 20 }], SIZE, PADDING)!;
    expect(view.points[0]!.x).toBeCloseTo(SIZE / 2);
    expect(view.points[0]!.y).toBeCloseTo(SIZE / 2);
    expect(view.tiles[0]!.url).toMatch(/\/18\/\d+\/\d+\.png$/);
  });

  it('keeps every point inside the margins', () => {
    const route = [
      { lat: 0.5, lng: 10 },
      { lat: 0.51, lng: 10.02 },
      { lat: 0.49, lng: 10.005 },
    ];
    for (const point of routeMapView(route, SIZE, PADDING)!.points) {
      expect(point.x).toBeGreaterThanOrEqual(PADDING - 1e-6);
      expect(point.x).toBeLessThanOrEqual(SIZE - PADDING + 1e-6);
      expect(point.y).toBeGreaterThanOrEqual(PADDING - 1e-6);
      expect(point.y).toBeLessThanOrEqual(SIZE - PADDING + 1e-6);
    }
  });

  it('draws north at the top', () => {
    const [south, north] = routeMapView(
      [
        { lat: 41, lng: 2 },
        { lat: 41.001, lng: 2 },
      ],
      SIZE,
      PADDING,
    )!.points;
    expect(north!.y).toBeLessThan(south!.y);
  });

  it('uses a wider zoom for a longer route', () => {
    const zoomOf = (url: string) => Number(url.split('/')[3]);
    const short = routeMapView(
      [
        { lat: 41, lng: 2 },
        { lat: 41.001, lng: 2.001 },
      ],
      SIZE,
      PADDING,
    )!;
    const long = routeMapView(
      [
        { lat: 41, lng: 2 },
        { lat: 41.1, lng: 2.1 },
      ],
      SIZE,
      PADDING,
    )!;
    expect(zoomOf(long.tiles[0]!.url)).toBeLessThan(zoomOf(short.tiles[0]!.url));
  });

  it('covers the whole drawing with tiles', () => {
    const { tiles } = routeMapView([{ lat: 41.5, lng: 2.5 }], SIZE, PADDING)!;
    expect(Math.min(...tiles.map((tile) => tile.x))).toBeLessThanOrEqual(0);
    expect(Math.min(...tiles.map((tile) => tile.y))).toBeLessThanOrEqual(0);
    expect(Math.max(...tiles.map((tile) => tile.x + TILE_SIZE))).toBeGreaterThanOrEqual(SIZE);
    expect(Math.max(...tiles.map((tile) => tile.y + TILE_SIZE))).toBeGreaterThanOrEqual(SIZE);
  });

  it('wraps tile columns across the date line', () => {
    const { tiles } = routeMapView([{ lat: 0, lng: 180 }], SIZE, PADDING)!;
    const columns = tiles.map((tile) => Number(tile.url.split('/')[4]));
    expect(columns.every((column) => column >= 0 && column < 2 ** 18)).toBe(true);
    expect(new Set(columns)).toContain(0);
  });
});
