import { describe, expect, it } from 'vitest';
import type { Mission, Waypoint } from '../../../shared/types';
import { buildKml, buildMissionSheet, kmlColour } from './sheets';

const missionDay = { year: 2027, city: 'Example City' };

/**
 * Builds a mission with two portals.
 *
 * @param landmark - Landmark of the mission.
 * @param title - Title of its portals.
 * @returns The mission.
 */
function mission(landmark: string, title = 'Portal'): Mission {
  const waypoints: Waypoint[] = [1, 2].map((value, position) => ({
    position,
    portalGuid: `g${value}`,
    title,
    lat: value,
    lng: -value,
    imageUrl: null,
  }));
  return {
    id: landmark,
    landmark,
    description: { en: 'A "walk".' },
    colour: '#336699',
    waypoints,
  } as unknown as Mission;
}

describe('buildMissionSheet', () => {
  it('writes one row per portal with its Intel link', () => {
    const lines = buildMissionSheet(missionDay, [mission('Bridge')], 'en').split('\r\n');
    expect(lines[0]).toBe('﻿order,name,description,position,title,lat,lng,intel');
    expect(lines[1]).toBe(
      '1,"MD 2027: Example City, Bridge","A ""walk"".",1,"Portal",1,-1,"https://intel.ingress.com/?pll=1,-1"',
    );
    expect(lines).toHaveLength(4);
  });

  it('neutralises titles that a spreadsheet would run as formulas', () => {
    const text = buildMissionSheet(missionDay, [mission('B', '=HYPERLINK("x")')], 'en');
    expect(text).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('writes the same bilingual description as the other exports', () => {
    const bilingual = { ...mission('Bridge'), description: { ca: 'Un passeig.', en: 'A walk.' } };
    expect(buildMissionSheet(missionDay, [bilingual], 'ca')).toContain('"Un passeig.\n\nA walk."');
  });

  it('numbers missions in the order received', () => {
    const text = buildMissionSheet(missionDay, [mission('A'), mission('B')], 'en');
    expect(text.split('\r\n')[3]).toMatch(/^2,"MD 2027: Example City, B"/);
  });
});

describe('kmlColour', () => {
  it('uses the alpha, blue, green, red order', () => {
    expect(kmlColour('#336699')).toBe('ff996633');
  });
});

describe('buildKml', () => {
  /**
   * Counts the occurrences of a text.
   *
   * @param text - Where to look.
   * @param part - What to look for.
   * @returns How many times it appears.
   */
  const count = (text: string, part: string) => text.split(part).length - 1;

  it('has one route per mission, and none joining them', () => {
    const kml = buildKml(missionDay, [mission('A'), mission('B')]);
    expect(count(kml, '<LineString>')).toBe(2);
    expect(kml).toContain('<coordinates>-1,1,0 -2,2,0</coordinates>');
  });

  it('keeps portals and routes in two top-level folders', () => {
    const kml = buildKml(missionDay, [mission('A')]);
    expect(kml).toContain('<Folder><name>Portals</name>');
    expect(kml).toContain('<Folder><name>Routes</name>');
    expect(count(kml, '<Point>')).toBe(2);
  });

  it('stays within two folders however many missions there are', () => {
    const many = Array.from({ length: 24 }, (_, index) => mission(`M${index}`));
    const kml = buildKml(missionDay, many);
    expect(count(kml, '<Folder>')).toBe(2);
    expect(count(kml, '<Point>')).toBe(48);
    expect(count(kml, '<LineString>')).toBe(24);
  });

  it('gives each portal its mission and a coloured icon', () => {
    const kml = buildKml(missionDay, [mission('A')]);
    expect(kml).toContain(
      '<description>MD 2027: Example City, A</description><styleUrl>#mission-1</styleUrl>',
    );
    expect(kml).toMatch(/<color>ff996633<\/color><scale>1<\/scale><Icon><href>https:/);
  });

  it('escapes titles', () => {
    expect(buildKml(missionDay, [mission('A', 'Fish & <Chips>')])).toContain(
      'Fish &amp; &lt;Chips&gt;',
    );
  });

  it('leaves out the route of a mission with a single portal', () => {
    const one = { ...mission('A'), waypoints: mission('A').waypoints.slice(0, 1) };
    expect(count(buildKml(missionDay, [one]), '<LineString>')).toBe(0);
  });
});
