import { describe, expect, it } from 'vitest';
import {
  MISSION_DESCRIPTION_MAX_LENGTH,
  MISSION_FORMATS,
  WAYPOINTS_MAX,
  WAYPOINTS_MIN,
  canExportForNiantic,
  characterCount,
  fullMissionName,
  hasSequenceHint,
  isValidSlug,
  suggestSlug,
  validateMission,
  validateSelection,
} from './rules';
import type { Mission, Waypoint } from './types';

const missionDay = { year: 2027, city: 'Example City', format: 'lite6' as const };

/**
 * Builds a list of distinct waypoints.
 *
 * @param count - How many to create.
 * @param seed - Offset that makes portals differ between missions.
 * @returns Waypoints at different coordinates.
 */
function waypoints(count: number, seed = 0): Waypoint[] {
  return Array.from({ length: count }, (_, index) => ({
    position: index,
    portalGuid: `guid-${seed}-${index}`,
    title: `Portal ${index}`,
    lat: seed + index / 100,
    lng: seed - index / 100,
    imageUrl: null,
  }));
}

/**
 * Builds a mission that passes every check, to be altered by each test.
 *
 * @param overrides - Fields to replace.
 * @returns A compliant mission.
 */
function validMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: 'm1',
    missionDayId: 'md1',
    landmark: 'Old Bridge',
    description: { en: 'A walk along the river.' },
    photoVersion: 1,
    hasPhoto: true,
    crop: null,
    selected: true,
    recommendedOrder: 1,
    notes: '',
    colour: '#336699',
    waypoints: waypoints(WAYPOINTS_MIN),
    ...overrides,
  };
}

/**
 * Lists only the codes of a mission's issues.
 *
 * @param mission - Mission to validate.
 * @returns The issue codes.
 */
function codes(mission: Mission): string[] {
  return validateMission(mission, missionDay).map((issue) => issue.code);
}

describe('names and slugs', () => {
  it('builds the handbook name', () => {
    expect(fullMissionName(missionDay, 'Old Bridge')).toBe('MD 2027: Example City, Old Bridge');
  });

  it.each([
    ['Example City', 2027, 'example-city-2027'],
    ['Vila Àmplia', 2028, 'vila-amplia-2028'],
    ["L'Exemple del Mar", 2027, 'l-exemple-del-mar-2027'],
    ['Il·lusió', 2027, 'illusio-2027'],
    ['  Lots   of  spaces ', 2027, 'lots-of-spaces-2027'],
    ['Example', 0, 'example'],
    ['', 2027, ''],
    ['···', 2027, ''],
  ])('suggests an address for "%s" %d', (city, year, expected) => {
    expect(suggestSlug(city, year)).toBe(expected);
  });

  it('suggests only valid addresses, even for very long names', () => {
    const slug = suggestSlug(`${'x'.repeat(58)} y`, 2027);
    expect(isValidSlug(slug)).toBe(true);
    expect(slug.endsWith('-2027')).toBe(true);
  });

  it('counts code points rather than UTF-16 units', () => {
    expect(characterCount('🌉a')).toBe(2);
  });

  it.each(['example-2027', 'two-words-2028'])('accepts the slug %s', (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each([
    'admin',
    'api',
    'assets',
    'letter-defaults',
    'new',
    'Upper-2027',
    'a',
    'bad--slug',
    '-x-2027',
    'a/b-2027',
  ])('rejects the slug %s', (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });
});

describe('validateMission', () => {
  it('accepts a compliant mission', () => {
    expect(codes(validMission())).toEqual([]);
  });

  it('flags a name over the limit', () => {
    expect(codes(validMission({ landmark: 'x'.repeat(40) }))).toContain('mission.nameTooLong');
  });

  it('accepts a description exactly at the limit and flags one over it', () => {
    const atLimit = 'x'.repeat(MISSION_DESCRIPTION_MAX_LENGTH);
    expect(codes(validMission({ description: { en: atLimit } }))).toEqual([]);
    expect(codes(validMission({ description: { en: `${atLimit}x` } }))).toContain(
      'mission.descriptionTooLong',
    );
  });

  it('treats blank descriptions as missing', () => {
    expect(codes(validMission({ description: { en: '  ' } }))).toContain(
      'mission.descriptionMissing',
    );
  });

  it('enforces the portal limits at both ends', () => {
    expect(codes(validMission({ waypoints: waypoints(WAYPOINTS_MIN - 1) }))).toContain(
      'mission.tooFewWaypoints',
    );
    expect(codes(validMission({ waypoints: waypoints(WAYPOINTS_MAX) }))).toEqual([]);
    expect(codes(validMission({ waypoints: waypoints(WAYPOINTS_MAX + 1) }))).toContain(
      'mission.tooManyWaypoints',
    );
  });

  it('detects the same portal twice, by GUID or by coordinates', () => {
    const byGuid = waypoints(WAYPOINTS_MIN);
    byGuid[1] = { ...byGuid[0]!, position: 1 };
    expect(codes(validMission({ waypoints: byGuid }))).toContain('mission.duplicatePortal');

    const byPlace = waypoints(WAYPOINTS_MIN).map((waypoint) => ({
      ...waypoint,
      portalGuid: null,
    }));
    byPlace[2] = { ...byPlace[0]!, position: 2 };
    expect(codes(validMission({ waypoints: byPlace }))).toContain('mission.duplicatePortal');
  });

  it('requires a photo', () => {
    expect(codes(validMission({ hasPhoto: false }))).toContain('mission.photoMissing');
  });

  it('only warns about sequence hints', () => {
    const issues = validateMission(validMission({ landmark: 'Bridge 3/18' }), missionDay);
    expect(issues).toEqual([expect.objectContaining({ severity: 'warning' })]);
    expect(canExportForNiantic(issues)).toBe(true);
  });
});

describe('hasSequenceHint', () => {
  it.each(['Bridge 3/18', 'Walk 2 of 6', 'Tram #4', 'on to the next mission', 'la següent missió'])(
    'recognises "%s"',
    (text) => {
      expect(hasSequenceHint(text)).toBe(true);
    },
  );

  it.each(['Old Bridge', 'Plaça del 1 d’Octubre', 'Year 2027 walk'])('accepts "%s"', (text) => {
    expect(hasSequenceHint(text)).toBe(false);
  });
});

describe('validateSelection', () => {
  /**
   * Builds a compliant set with the number of missions of the format.
   *
   * @returns Six selected missions in order.
   */
  function fullSet(): Mission[] {
    return Array.from({ length: MISSION_FORMATS.lite6.missions }, (_, index) =>
      validMission({
        id: `m${index}`,
        landmark: `Place ${index}`,
        recommendedOrder: index + 1,
        waypoints: waypoints(WAYPOINTS_MIN, index + 1),
      }),
    );
  }

  /**
   * Lists the codes reported for a set.
   *
   * @param missions - Candidates to validate.
   * @returns The issue codes.
   */
  function setCodes(missions: Mission[]): string[] {
    return validateSelection(missionDay, missions).map((issue) => issue.code);
  }

  it('accepts a compliant set', () => {
    expect(validateSelection(missionDay, fullSet())).toEqual([]);
  });

  it('ignores candidates that are not selected', () => {
    const set = fullSet();
    set.push(validMission({ id: 'extra', selected: false, recommendedOrder: null, landmark: '' }));
    expect(validateSelection(missionDay, set)).toEqual([]);
  });

  it('flags the wrong number of missions and blocks the export', () => {
    const issues = validateSelection(missionDay, fullSet().slice(0, 5));
    expect(issues.map((issue) => issue.code)).toContain('selection.wrongCount');
    expect(canExportForNiantic(issues)).toBe(false);
  });

  it('flags gaps and repeats in the order', () => {
    const set = fullSet();
    set[1]!.recommendedOrder = 1;
    expect(setCodes(set)).toContain('selection.orderInvalid');
  });

  it('flags two missions with the same name', () => {
    const set = fullSet();
    set[1]!.landmark = set[0]!.landmark;
    expect(setCodes(set)).toContain('selection.duplicateName');
  });

  it('warns about portals shared between missions, once per mission', () => {
    const set = fullSet();
    set[1]!.waypoints[0] = { ...set[0]!.waypoints[0]! };
    const shared = validateSelection(missionDay, set).filter(
      (issue) => issue.code === 'selection.sharedPortal',
    );
    expect(shared.map((issue) => issue.missionId).sort()).toEqual(['m0', 'm1']);
    expect(shared.every((issue) => issue.severity === 'warning')).toBe(true);
  });
});
