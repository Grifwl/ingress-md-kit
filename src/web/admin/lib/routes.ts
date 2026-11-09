/**
 * The screens of the admin area and how browser paths map to them.
 */

/** A screen of the admin area. */
export type Route =
  | { name: 'home' }
  | { name: 'letterDefaults' }
  | { name: 'newMissionDay' }
  | { name: 'missions'; slug: string }
  | { name: 'mission'; slug: string; missionId: string }
  | { name: 'partners'; slug: string }
  | { name: 'partner'; slug: string; partnerId: string }
  | { name: 'map'; slug: string }
  | { name: 'selection'; slug: string }
  | { name: 'settings'; slug: string }
  | { name: 'notFound' };

/**
 * Decodes one path segment, leaving malformed escapes as they are.
 *
 * @param segment - Raw segment.
 * @returns The decoded text.
 */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Converts a browser path into a screen.
 *
 * @param pathname - Path, starting with /admin.
 * @returns The matching route.
 */
export function parseRoute(pathname: string): Route {
  // The fourth segment is the identifier of a mission or of a partner.
  const [root, slug, section, missionId, ...rest] = pathname
    .split('/')
    .filter((segment) => segment !== '')
    .map(decodeSegment);

  if (root !== 'admin' || rest.length > 0) {
    return { name: 'notFound' };
  }
  if (slug === undefined) {
    return { name: 'home' };
  }
  if (slug === 'new') {
    return section === undefined ? { name: 'newMissionDay' } : { name: 'notFound' };
  }
  if (slug === 'letter-defaults') {
    return section === undefined ? { name: 'letterDefaults' } : { name: 'notFound' };
  }
  if (section === undefined || section === 'missions') {
    return missionId === undefined
      ? { name: 'missions', slug }
      : { name: 'mission', slug, missionId };
  }
  if (section === 'partners') {
    return missionId === undefined
      ? { name: 'partners', slug }
      : { name: 'partner', slug, partnerId: missionId };
  }
  if (missionId === undefined && (section === 'map' || section === 'selection')) {
    return { name: section, slug };
  }
  if (missionId === undefined && section === 'settings') {
    return { name: 'settings', slug };
  }
  return { name: 'notFound' };
}
