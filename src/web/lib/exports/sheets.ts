/**
 * Text exports of the selected missions: the mission sheet (CSV) and the
 * map file for Google My Maps (KML).
 */
import { resolveLocalized } from '../../../shared/letter';
import { fullMissionName, type Language } from '../../../shared/rules';
import type { Mission, MissionDay } from '../../../shared/types';

/** Header row of the mission sheet. */
const CSV_HEADER = [
  'order',
  'name',
  'description',
  'position',
  'title',
  'lat',
  'lng',
  'intel',
] as const;

/**
 * Quotes a text cell. A leading character that a spreadsheet would read as
 * a formula is neutralised, because portal titles are written by strangers.
 *
 * @param value - Text of the cell.
 * @returns The CSV cell.
 */
function textCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Builds the mission sheet, with one row per portal. It starts with a byte
 * order mark so that spreadsheets read accents correctly.
 *
 * @param missionDay - Provides the names.
 * @param selected - Selected missions, in order.
 * @param language - Language of the descriptions.
 * @returns The contents of the file.
 */
export function buildMissionSheet(
  missionDay: Pick<MissionDay, 'year' | 'city'>,
  selected: readonly Mission[],
  language: Language,
): string {
  const rows = selected.flatMap((mission, index) =>
    mission.waypoints.map((waypoint, position) =>
      [
        String(index + 1),
        textCell(fullMissionName(missionDay, mission.landmark)),
        textCell(resolveLocalized(mission.description, language)),
        String(position + 1),
        textCell(waypoint.title),
        String(waypoint.lat),
        String(waypoint.lng),
        textCell(`https://intel.ingress.com/?pll=${waypoint.lat},${waypoint.lng}`),
      ].join(','),
    ),
  );
  return `\ufeff${[CSV_HEADER.join(','), ...rows].join('\r\n')}\r\n`;
}

/**
 * Escapes text for XML.
 *
 * @param value - Raw text.
 * @returns Text safe inside an element.
 */
function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Converts a web colour to KML's order: alpha, blue, green, red.
 *
 * @param colour - Colour such as `#336699`.
 * @returns The KML colour.
 */
export function kmlColour(colour: string): string {
  const [red, green, blue] = [colour.slice(1, 3), colour.slice(3, 5), colour.slice(5, 7)];
  return `ff${blue}${green}${red}`.toLowerCase();
}

/**
 * Builds the map file. It has only two top-level folders because My Maps
 * allows ten layers: portals grouped per mission, and one independent line
 * per mission, with nothing that joins two missions.
 *
 * @param missionDay - Provides the names.
 * @param selected - Selected missions, in order.
 * @returns The contents of the file.
 */
export function buildKml(
  missionDay: Pick<MissionDay, 'year' | 'city'>,
  selected: readonly Mission[],
): string {
  const named = selected.map((mission, index) => ({
    mission,
    styleId: `mission-${index + 1}`,
    name: xml(fullMissionName(missionDay, mission.landmark)),
  }));

  const styles = named.map(
    ({ mission, styleId }) =>
      `<Style id="${styleId}"><IconStyle><color>${kmlColour(mission.colour)}</color></IconStyle>` +
      `<LineStyle><color>${kmlColour(mission.colour)}</color><width>4</width></LineStyle></Style>`,
  );

  const portals = named.map(
    ({ mission, styleId, name }) =>
      `<Folder><name>${name}</name>${mission.waypoints
        .map(
          (waypoint, position) =>
            `<Placemark><name>${position + 1}. ${xml(waypoint.title)}</name>` +
            `<styleUrl>#${styleId}</styleUrl>` +
            `<Point><coordinates>${waypoint.lng},${waypoint.lat},0</coordinates></Point></Placemark>`,
        )
        .join('')}</Folder>`,
  );

  // A line needs two points, so a mission with fewer portals has no route.
  const routes = named
    .filter(({ mission }) => mission.waypoints.length > 1)
    .map(
      ({ mission, styleId, name }) =>
        `<Placemark><name>${name}</name><styleUrl>#${styleId}</styleUrl>` +
        `<LineString><coordinates>${mission.waypoints
          .map((waypoint) => `${waypoint.lng},${waypoint.lat},0`)
          .join(' ')}</coordinates></LineString></Placemark>`,
    );

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<kml xmlns="http://www.opengis.net/kml/2.2"><Document>` +
    `<name>${xml(`MD ${missionDay.year}: ${missionDay.city}`)}</name>${styles.join('')}` +
    `<Folder><name>Portals</name>${portals.join('')}</Folder>` +
    `<Folder><name>Routes</name>${routes.join('')}</Folder>` +
    `</Document></kml>\n`
  );
}
