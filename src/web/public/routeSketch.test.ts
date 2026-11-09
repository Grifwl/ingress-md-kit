import { describe, expect, it } from 'vitest';
import { sketchRoute } from './routeSketch';

describe('sketchRoute', () => {
  it('returns nothing for a route without portals', () => {
    expect(sketchRoute([], 100, 10)).toEqual([]);
  });

  it('centres a single portal', () => {
    expect(sketchRoute([{ lat: 10, lng: 20 }], 100, 10)).toEqual([{ x: 50, y: 50 }]);
  });

  it('keeps every point inside the margins', () => {
    const route = [
      { lat: 0, lng: 0 },
      { lat: 0.01, lng: 0.02 },
      { lat: -0.01, lng: 0.005 },
    ];
    for (const point of sketchRoute(route, 100, 10)) {
      expect(point.x).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(point.x).toBeLessThanOrEqual(90 + 1e-6);
      expect(point.y).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(point.y).toBeLessThanOrEqual(90 + 1e-6);
    }
  });

  it('draws north at the top', () => {
    const [south, north] = sketchRoute(
      [
        { lat: 0, lng: 0 },
        { lat: 1, lng: 0 },
      ],
      100,
      10,
    );
    expect(north!.y).toBeLessThan(south!.y);
  });

  it('narrows longitude at high latitudes', () => {
    const [west, east] = sketchRoute(
      [
        { lat: 60, lng: 0 },
        { lat: 60.5, lng: 1 },
      ],
      100,
      10,
    );
    // At 60° a degree of longitude is about half a degree of latitude, so
    // this route is roughly square; unnarrowed, y would only reach 40.
    expect(Math.abs(east!.y - west!.y)).toBeCloseTo(80, 0);
    expect(Math.abs(east!.x - west!.x)).toBeGreaterThan(75);
  });
});
