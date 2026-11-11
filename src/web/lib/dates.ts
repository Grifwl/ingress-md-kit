/**
 * Date formatting shared by the public pages.
 */
import type { Language } from '../../shared/rules';

/**
 * Writes a date in the visitor's language. Noon is used so that no time
 * zone can move it to the previous or next day.
 *
 * @param date - Date in `YYYY-MM-DD` form.
 * @param language - Language of the page.
 * @returns The formatted date.
 */
export function formatDate(date: string, language: Language): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(language, { dateStyle: 'long' });
}
