/**
 * The home page of the instance: what the tool is, the Mission Days it
 * has published and how to ask for access. The text is the same for every
 * community that runs the tool; only the list and the contact come from
 * the instance itself, so nothing here names a city or a person.
 */
import { useEffect, useState } from 'preact/hooks';
import { LANGUAGES, MEDAL_MISSIONS, type Language } from '../../shared/rules';
import type { HomeContact, HomeMissionDay, HomeView } from '../../shared/types';
import logoUrl from '../brand/logo.svg';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/messages';
import { formatDate } from '../lib/dates';

/** Points of the "what the tool does" list, in the order they happen. */
const FEATURES: MessageKey[] = [
  'site.feature.missions',
  'site.feature.partners',
  'site.feature.images',
  'site.feature.exports',
  'site.feature.participants',
];

/**
 * One block of Mission Days, upcoming or past.
 *
 * @param props - Heading and the Mission Days to list.
 * @returns The section, or nothing when the list is empty.
 */
function MissionDayList({ title, days }: { title: string; days: HomeMissionDay[] }) {
  const { t, language } = useI18n();
  if (days.length === 0) {
    return null;
  }
  return (
    <section>
      <h2>{title}</h2>
      <ul class="days">
        {days.map((day) => (
          <li key={day.slug}>
            <a class="day" href={`/${encodeURIComponent(day.slug)}`}>
              <strong>{t('participant.title', { city: day.city, year: day.year })}</strong>
              <span class="muted">
                {day.date === null ? t('site.dateUnknown') : formatDate(day.date, language)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The "want to use it?" block, shown only when the instance has a contact.
 *
 * @param props - The contact, already checked and shaped by the Worker.
 * @returns The section.
 */
function ContactSection({ contact: link }: { contact: HomeContact }) {
  const { t } = useI18n();
  return (
    <section class="card">
      <h2>{t('site.useTitle')}</h2>
      <p>{t('site.useBody')}</p>
      <p class="contact">
        {link.href === null ? (
          link.label
        ) : (
          <a href={link.href} rel="noopener">
            {link.label}
          </a>
        )}
      </p>
    </section>
  );
}

/**
 * Root of the home page.
 *
 * @returns The page element.
 */
export function HomeApp() {
  const { t, language, setLanguage } = useI18n();
  const [view, setView] = useState<HomeView | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/public/home')
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<HomeView>;
      })
      .then(setView, () => setFailed(true));
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const upcoming = view?.missionDays.filter((day) => !day.past) ?? [];
  const past = view?.missionDays.filter((day) => day.past) ?? [];

  return (
    <main class="page">
      <div class="toolbar">
        <select
          aria-label={t('app.language')}
          value={language}
          onChange={(event) => setLanguage(event.currentTarget.value as Language)}
        >
          {LANGUAGES.map((option) => (
            <option key={option} value={option}>
              {option.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <header class="hero">
        <img class="logo" src={logoUrl} alt="" width={72} height={72} />
        <h1>{t('app.title')}</h1>
        <p class="tagline">{t('site.tagline')}</p>
      </header>

      <section>
        <h2>{t('site.whatTitle')}</h2>
        <p>{t('site.whatBody', { medal: MEDAL_MISSIONS })}</p>
      </section>

      <section>
        <h2>{t('site.toolTitle')}</h2>
        <ul class="features">
          {FEATURES.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </section>

      {view === null && <p class="muted">{failed ? t('site.unavailable') : t('app.loading')}</p>}
      {view !== null && view.missionDays.length === 0 && (
        <section>
          <h2>{t('site.missionDaysTitle')}</h2>
          <p class="muted">{t('site.noMissionDays')}</p>
        </section>
      )}
      <MissionDayList title={t('site.upcoming')} days={upcoming} />
      <MissionDayList title={t('site.past')} days={past} />

      {view !== null && view.contact !== null && <ContactSection contact={view.contact} />}

      <footer class="footer">
        <p>{t('site.disclaimer')}</p>
        <p>
          <a href="/admin">{t('site.organisers')}</a>
        </p>
      </footer>
    </main>
  );
}
