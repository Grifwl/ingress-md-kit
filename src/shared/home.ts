/**
 * Rules of the instance home page, shared by the Worker, which decides
 * what is listed, and the browser, which decides how a contact is linked.
 */
import type { HomeMissionDay, MissionDayStatus } from './types';

/** Longest contact text an administrator may set. */
export const CONTACT_MAX_LENGTH = 200;

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

/** A contact turned into something the page can display. */
export interface ContactLink {
  /** Text to show. */
  label: string;
  /** Address to link to, or null to show the text alone. */
  href: string | null;
}

/**
 * Decides how to display the contact of the instance. Only email
 * addresses and http(s) addresses become links, so that no other scheme
 * typed into the setting can ever run in a visitor's browser.
 *
 * @param contact - The contact as the administrators wrote it.
 * @returns The text and link, or null when there is no contact.
 */
export function contactLink(contact: string): ContactLink | null {
  const label = contact.trim();
  if (label === '') {
    return null;
  }
  if (/^[^@\s/:]+@[^@\s/]+\.[^@\s/]+$/.test(label)) {
    return { label, href: `mailto:${label}` };
  }
  if (/^https?:\/\/\S+$/i.test(label)) {
    try {
      const url = new URL(label);
      return { label: url.host + (url.pathname === '/' ? '' : url.pathname), href: url.href };
    } catch {
      return { label, href: null };
    }
  }
  return { label, href: null };
}
