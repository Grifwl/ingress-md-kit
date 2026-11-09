/**
 * Map of missions, drawn with Leaflet and OpenStreetMap tiles.
 */
import L from 'leaflet';
import { useEffect, useRef } from 'preact/hooks';
import type { Waypoint } from '../../../shared/types';

/** What the map needs to draw one mission. */
export interface MapMission {
  id: string;
  colour: string;
  waypoints: readonly Waypoint[];
}

/** World view used until there is something to frame. */
const INITIAL_CENTER: L.LatLngTuple = [20, 0];
const INITIAL_ZOOM = 2;

/** Closest zoom when framing, so that a single portal keeps some context. */
const MAX_FIT_ZOOM = 17;

/**
 * Draws missions on a map. Each mission is one independent line through
 * its own portals: the data is grouped per mission precisely so that a
 * line can never connect two of them.
 *
 * @param props - Missions, an optional click handler, and `fitKey`: the map
 *   reframes only when this value changes, so adding a portal does not
 *   move the view under the organiser's cursor.
 * @returns The map element.
 */
export function MissionMap({
  missions,
  onMapClick,
  fitKey,
}: {
  missions: readonly MapMission[];
  onMapClick?: (lat: number, lng: number) => void;
  fitKey: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  useEffect(() => {
    const map = L.map(containerRef.current!).setView(INITIAL_CENTER, INITIAL_ZOOM);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.on('click', (event: L.LeafletMouseEvent) => {
      clickRef.current?.(event.latlng.lat, event.latlng.lng);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current!;
    layer.clearLayers();
    for (const mission of missions) {
      const points = mission.waypoints.map((point): L.LatLngTuple => [point.lat, point.lng]);
      if (points.length > 1) {
        L.polyline(points, { color: mission.colour, weight: 3 }).addTo(layer);
      }
      mission.waypoints.forEach((point, index) => {
        // bindTooltip's string form is inserted as HTML, and portal titles
        // come from third parties, so the title is passed as a text node.
        L.circleMarker([point.lat, point.lng], {
          radius: 6,
          color: mission.colour,
          fillColor: '#ffffff',
          fillOpacity: 1,
          weight: 3,
        })
          .bindTooltip(document.createTextNode(`${index + 1}. ${point.title}`) as unknown as string)
          .addTo(layer);
      });
    }
  }, [missions]);

  useEffect(() => {
    const points = missions.flatMap((mission) =>
      mission.waypoints.map((point): L.LatLngTuple => [point.lat, point.lng]),
    );
    if (points.length > 0) {
      mapRef.current!.fitBounds(L.latLngBounds(points), {
        padding: [30, 30],
        maxZoom: MAX_FIT_ZOOM,
      });
    }
    // Reframing is tied to fitKey alone, as explained above.
  }, [fitKey]);

  return <div class="map" ref={containerRef} />;
}
