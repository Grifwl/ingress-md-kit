/**
 * Creation of a Mission Day, reserved to instance administrators.
 */
import { useState } from 'preact/hooks';
import { MISSION_FORMATS, suggestSlug, type MissionFormat } from '../../../shared/rules';
import type { CurrentUser } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { createMissionDay } from '../api';
import { ErrorMessage, Field } from '../components/common';
import { Link, navigate } from '../router';

const FORMATS = Object.keys(MISSION_FORMATS) as MissionFormat[];

/**
 * The new Mission Day screen.
 *
 * @param props - The signed-in organiser.
 * @returns The page element.
 */
export function NewMissionDayPage({ user }: { user: CurrentUser }) {
  const { t } = useI18n();
  const [city, setCity] = useState('');
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [format, setFormat] = useState<MissionFormat>('standard18');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [error, setError] = useState<unknown>();

  // Null means the organiser has not written an address, so it keeps
  // following the city and the year as they are typed.
  const [customSlug, setCustomSlug] = useState<string | null>(null);
  const slug = customSlug ?? suggestSlug(city, year);

  /**
   * Creates the Mission Day and opens it.
   *
   * @param event - Form submission.
   */
  const submit = async (event: Event) => {
    event.preventDefault();
    setError(undefined);
    try {
      const created = await createMissionDay({ slug, city, year, format, ownerEmail });
      navigate(ownerEmail === '' ? `/admin/${created.slug}` : '/admin');
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <main class="page">
      <div class="heading-row">
        <h1>{t('home.createTitle')}</h1>
        <Link href="/admin" class="back-link">
          {t('nav.allMissionDays')}
        </Link>
      </div>
      {!user.isInstanceAdmin && <p class="alert">{t('error.instance_admin_required')}</p>}
      {user.isInstanceAdmin && (
        <form class="card" onSubmit={submit}>
          <div class="grid-2">
            <Field label={t('home.city')}>
              <input required value={city} onInput={(e) => setCity(e.currentTarget.value)} />
            </Field>
            <Field label={t('home.year')}>
              <input
                required
                type="number"
                value={year}
                onInput={(e) => setYear(Number(e.currentTarget.value))}
              />
            </Field>
            <Field label={t('home.format')}>
              <select
                value={format}
                onChange={(e) => setFormat(e.currentTarget.value as MissionFormat)}
              >
                {FORMATS.map((option) => (
                  <option key={option} value={option}>
                    {t(`format.${option}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('home.owner')} help={t('home.ownerHelp')}>
              <input
                type="email"
                value={ownerEmail}
                onInput={(e) => setOwnerEmail(e.currentTarget.value)}
              />
            </Field>
          </div>
          <Field label={t('home.slug')} help={t('home.slugHelp')}>
            <input
              required
              value={slug}
              onInput={(e) => setCustomSlug(e.currentTarget.value)}
              onBlur={() => {
                if (slug.trim() === '') setCustomSlug(null);
              }}
            />
            {slug !== '' && (
              <span class="slug-preview">
                {t('home.slugPreview', { url: `${location.origin}/${slug}` })}
              </span>
            )}
          </Field>
          <ErrorMessage error={error} />
          <button class="button primary">{t('home.create')}</button>
        </form>
      )}
    </main>
  );
}
