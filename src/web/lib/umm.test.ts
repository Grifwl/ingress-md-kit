import { describe, expect, it } from 'vitest';
import { WAYPOINTS_MIN } from '../../shared/rules';
import type { Mission, Waypoint } from '../../shared/types';
import fixture from './fixtures/umm-v2.json';
import { buildUmmFile, diffUmmImport, hasChanges, parseUmmFile, ummFileName } from './umm';

const missionDay = { year: 2027, city: 'Example City' };

/**
 * Builds a waypoint.
 *
 * @param guid - Portal identifier.
 * @param position - Place in the route.
 * @returns The waypoint.
 */
function waypoint(guid: string | null, position: number): Waypoint {
  return { position, portalGuid: guid, title: `T${position}`, lat: 1, lng: 2, imageUrl: null };
}

/**
 * Builds a mission.
 *
 * @param id - Identifier.
 * @param guids - Portals of its route.
 * @returns The mission.
 */
function mission(id: string, guids: (string | null)[]): Mission {
  return {
    id,
    landmark: 'Old Bridge',
    description: { en: 'A walk.', ca: 'Un passeig.' },
    waypoints: guids.map(waypoint),
  } as unknown as Mission;
}

/**
 * Reads the fixture, which must be valid.
 *
 * @returns Its missions.
 */
function fixtureMissions() {
  const result = parseUmmFile(JSON.stringify(fixture));
  if (!result.ok) throw new Error(result.error);
  return result.missions;
}

describe('buildUmmFile', () => {
  it('follows the format and uses the final names', () => {
    const file = buildUmmFile(missionDay, [mission('m1', ['g1', 'g2'])], 'ca');
    expect(file).toMatchObject({
      missionSetName: 'MD 2027: Example City',
      currentMission: 0,
      plannedBannerLength: 1,
      fileFormatVersion: 2,
    });
    expect(file.missions[0]).toMatchObject({
      missionTitle: 'MD 2027: Example City, Old Bridge',
      missionDescription: 'Un passeig.\n\nA walk.',
    });
    expect(file.missions[0]!.portals[0]).toMatchObject({
      guid: 'g1',
      location: { latitude: 1, longitude: 2 },
      type: 'PORTAL',
      objective: { type: 'HACK_PORTAL' },
    });
  });

  it('keeps candidates without portals', () => {
    expect(buildUmmFile(missionDay, [mission('m1', [])], 'en').missions[0]!.portals).toEqual([]);
  });

  it('can be read back', () => {
    const text = JSON.stringify(buildUmmFile(missionDay, [mission('m1', ['g1'])], 'en'));
    expect(parseUmmFile(text)).toMatchObject({ ok: true });
  });

  it('names the file after the Mission Day', () => {
    expect(ummFileName('example-2027')).toBe('example-2027-umm.json');
  });
});

describe('parseUmmFile', () => {
  it('takes only the portals', () => {
    const [first] = fixtureMissions();
    expect(first).not.toHaveProperty('missionTitle');
    expect(first!.waypoints[0]).toEqual({
      position: 0,
      portalGuid: 'guid-b',
      title: 'Portal B',
      lat: 0.002,
      lng: 0.003,
      imageUrl: 'https://example.org/b.jpg',
    });
  });

  it('counts objectives other than a hack', () => {
    expect(fixtureMissions()[0]!.otherObjectives).toBe(1);
  });

  it.each([
    ['an older version', { ...fixture, fileFormatVersion: 1 }],
    ['no version', { missions: [] }],
  ])('asks for a new export of %s', (_name, content) => {
    expect(parseUmmFile(JSON.stringify(content))).toEqual({
      ok: false,
      error: 'unsupported_version',
    });
  });

  it.each([
    ['text that is not JSON', 'not json'],
    ['JSON without an object', 'null'],
    ['a file without missions', JSON.stringify({ fileFormatVersion: 2 })],
    [
      'a portal without a location',
      JSON.stringify({
        fileFormatVersion: 2,
        missions: [{ portals: [{ guid: 'g', title: 't' }] }],
      }),
    ],
  ])('refuses %s', (_name, text) => {
    expect(parseUmmFile(text)).toEqual({ ok: false, error: 'invalid_file' });
  });
});

describe('diffUmmImport', () => {
  it('matches by position and reports the changes', () => {
    const current = [mission('m1', ['guid-a', 'guid-b', 'guid-gone'])];
    const [first] = diffUmmImport(fixtureMissions(), ['m1'], current);
    expect(first).toMatchObject({
      missionId: 'm1',
      added: 1,
      removed: 1,
      reordered: true,
      otherObjectives: 1,
    });
    expect(hasChanges(first!)).toBe(true);
  });

  it('turns missions beyond the export into new candidates', () => {
    const diff = diffUmmImport(fixtureMissions(), ['m1'], [mission('m1', [])]);
    expect(diff[1]).toMatchObject({ missionId: null, position: 1 });
    expect(hasChanges(diff[1]!)).toBe(true);
  });

  it('warns when the number of portals is out of range', () => {
    const [first] = diffUmmImport(fixtureMissions(), [], []);
    expect(first!.waypoints.length).toBeLessThan(WAYPOINTS_MIN);
    expect(first!.outOfRange).toBe(true);
  });

  it('finds no changes in an identical route', () => {
    const current = mission('m1', ['g1', 'g2']);
    const result = parseUmmFile(JSON.stringify(buildUmmFile(missionDay, [current], 'en')));
    if (!result.ok) throw new Error(result.error);
    expect(hasChanges(diffUmmImport(result.missions, ['m1'], [current])[0]!)).toBe(false);
  });
});
