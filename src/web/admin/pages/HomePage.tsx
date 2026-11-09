/**
 * List of the organiser's Mission Days, with the instance-wide actions.
 */
import type { CurrentUser } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { listMissionDays } from '../api';
import { ErrorMessage } from '../components/common';
import { useAsync } from '../hooks';
import { Link } from '../router';

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
      <div class="heading-row">
        <h1>{t('home.title')}</h1>
        {user.isInstanceAdmin && (
          <div class="actions">
            <Link href="/admin/letter-defaults" class="button">
              {t('letterDefaults.title')}
            </Link>
            <Link href="/admin/new" class="button primary">
              {t('home.createTitle')}
            </Link>
          </div>
        )}
      </div>
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
    </main>
  );
}
