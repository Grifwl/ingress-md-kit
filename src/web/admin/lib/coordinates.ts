/**
 * Reading portal coordinates typed or pasted by an organiser.
 */

/** A geographic position. */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Extracts coordinates from an Intel link (its `pll` parameter) or from
 * plain `lat, lng` text.
 *
 * @param input - Text entered by the organiser.
 * @returns The position, or null when none can be read or it is impossible.
 */
export function parseCoordinates(input: string): LatLng | null {
  const match =
    /[?&]pll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(input) ??
    /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(input);
  if (match === null) {
    return null;
  }
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
