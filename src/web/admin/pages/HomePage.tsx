/**
 * List of the organiser's Mission Days, and creation of new ones.
 */
import { useState } from 'preact/hooks';
import { MISSION_FORMATS, type MissionFormat } from '../../../shared/rules';
import type { CurrentUser } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { createMissionDay, listMissionDays } from '../api';
import { ErrorMessage, Field } from '../components/common';
import { useAsync } from '../hooks';
import { Link, navigate } from '../router';

const FORMATS = Object.keys(MISSION_FORMATS) as MissionFormat[];

/**
 * Form an instance administrator uses to create a Mission Day.
 *
 * @returns The form element.
 */
function CreateMissionDayForm() {
  const { t } = useI18n();
  const [slug, setSlug] = useState('');
  const [city, setCity] = useState('');
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [format, setFormat] = useState<MissionFormat>('standard18');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [error, setError] = useState<unknown>();

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
    <form class="card" onSubmit={submit}>
      <h2>{t('home.createTitle')}</h2>
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
        <Field label={t('home.slug')} help={t('home.slugHelp')}>
          <input required value={slug} onInput={(e) => setSlug(e.currentTarget.value)} />
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
      <ErrorMessage error={error} />
      <button class="button primary">{t('home.create')}</button>
    </form>
  );
}

/**
 * The first screen of the admin area.
 *
 * @param props - The signed-in organiser.
 * @returns The page element.
 */
export function HomePage({ user }: { user: CurrentUser }) {
  const { t } = useI18n();
  const missionDays = useAsync(listMissionDays, []);

  return (
    <main class="page">
      <h1>{t('home.title')}</h1>
      <ErrorMessage error={missionDays.error} />
      {missionDays.loading && <p>{t('app.loading')}</p>}
      {missionDays.data?.length === 0 && <p class="muted">{t('home.empty')}</p>}
      <ul class="tiles">
        {missionDays.data?.map((day) => (
          <li key={day.id}>
            <Link href={`/admin/${day.slug}`} class="tile">
              <strong>
                {day.city} {day.year}
              </strong>
              <span class="muted">
                {t(`format.${day.format}`)} · {t(`status.${day.status}`)} · {t(`role.${day.role}`)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {user.isInstanceAdmin && <CreateMissionDayForm />}
    </main>
  );
}
