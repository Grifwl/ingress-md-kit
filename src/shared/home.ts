/**
 * Rules of the instance home page, shared by the Worker, which decides
 * what is listed and how the contact is shown, and the admin screen,
 * which checks the contact before saving it.
 */
import type { HomeContact, HomeMissionDay, MissionDayStatus } from './types';

/** Longest contact label an administrator may set. */
export const CONTACT_LABEL_MAX_LENGTH = 200;

/** Longest contact address an administrator may set. */
export const CONTACT_URL_MAX_LENGTH = 500;

/** What deciding whether a Mission Day is over needs to know. */
interface MissionDayTiming {
  year: number;
  date: string | null;
  status: MissionDayStatus;
}

/**
 * Tells whether a Mission Day is over. Organisers marking it as done is
 * enough; otherwise its date must have passed, or, without a date, its
 * whole year. The day itself still counts as upcoming, so the page does
 * not move it to the past while agents are playing.
 *
 * @param day - Year, date and status of the Mission Day.
 * @param today - Today's date in `YYYY-MM-DD` form.
 * @returns True when it belongs to the past.
 */
export function isPastMissionDay(day: MissionDayTiming, today: string): boolean {
  if (day.status === 'done') {
    return true;
  }
  if (day.date !== null) {
    return day.date < today;
  }
  return day.year < Number(today.slice(0, 4));
}

/**
 * Key that sorts Mission Days chronologically. One without a date goes
 * after every dated one of its year: month 13 sorts after December.
 *
 * @param day - Year and date of the Mission Day.
 * @returns A string that sorts by time.
 */
function chronologicalKey(day: Pick<HomeMissionDay, 'year' | 'date'>): string {
  return day.date ?? `${String(day.year).padStart(4, '0')}-13`;
}

/**
 * Orders the listed Mission Days: the upcoming ones first, soonest at the
 * top, then the past ones, most recent at the top. That way both lists
 * start with the Mission Day closest to today.
 *
 * @param days - The Mission Days, in any order.
 * @returns A new, sorted array.
 */
export function sortHomeMissionDays(days: readonly HomeMissionDay[]): HomeMissionDay[] {
  return [...days].sort((a, b) => {
    if (a.past !== b.past) {
      return a.past ? 1 : -1;
    }
    const order = chronologicalKey(a).localeCompare(chronologicalKey(b));
    const byTime = a.past ? -order : order;
    return byTime !== 0 ? byTime : a.city.localeCompare(b.city);
  });
}

/** Addresses a contact link may use; any other scheme is refused. */
export const CONTACT_URL_PROTOCOLS: readonly string[] = ['https:', 'http:', 'mailto:'];

/**
 * Tells whether an address may be used as the contact link. Only web and
 * email addresses are allowed, so that nothing typed into the setting can
 * ever run in a visitor's browser.
 *
 * @param url - Candidate address.
 * @returns True when it parses and uses an allowed scheme.
 */
export function isAllowedContactUrl(url: string): boolean {
  if (url.length > CONTACT_URL_MAX_LENGTH || /\s/.test(url)) {
    return false;
  }
  try {
    return CONTACT_URL_PROTOCOLS.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * Text that stands in for the label when only an address was given: the
 * email without `mailto:`, or the host and path of a web address.
 *
 * @param url - An allowed address.
 * @returns A readable form of it.
 */
function readableUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol === 'mailto:') {
    return decodeURIComponent(parsed.pathname);
  }
  return parsed.host + (parsed.pathname === '/' ? '' : parsed.pathname);
}

/**
 * Decides how the home page displays the contact of the instance: the
 * label linking to the address. Without an address the label is plain
 * text; without a label the address is shown in a readable form. An
 * address that is not allowed is ignored, as a second line of defence
 * behind the check made when it is saved.
 *
 * @param label - Text to show, as the administrators wrote it.
 * @param url - Address to link to, or an empty string.
 * @returns The contact to display, or null when there is none.
 */
export function contactLink(label: string, url: string): HomeContact | null {
  const text = label.trim();
  const address = url.trim();
  const href = address !== '' && isAllowedContactUrl(address) ? address : null;
  if (text === '' && href === null) {
    return null;
  }
  return { label: text !== '' ? text : readableUrl(href!), href };
}
