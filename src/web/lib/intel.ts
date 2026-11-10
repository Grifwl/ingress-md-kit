/**
 * Links to the Ingress Intel map.
 */

/**
 * Builds the Intel address of a portal, which agents open to find it.
 *
 * @param point - Coordinates of the portal.
 * @returns The address.
 */
export function intelUrl(point: { lat: number; lng: number }): string {
  return `https://intel.ingress.com/?pll=${point.lat},${point.lng}`;
}
