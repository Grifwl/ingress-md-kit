/**
 * List of the organiser's Mission Days, with the instance-wide actions.
 */
import type { CurrentUser } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { listInstanceMissionDays, listMissionDays } from '../api';
import { ErrorMessage } from '../components/common';
import { useAsync } from '../hooks';
import { Link } from '../router';

/**
 * Mission Days of the instance that the administrator is not part of.
 * They can only open the team of each one, to recover a Mission Day whose
 * owners have gone or to add themself.
 *
 * @returns The section element, or nothing when there are none.
 */
function OtherMissionDays() {
  const { t } = useI18n();
  const all = useAsync(listInstanceMissionDays, []);
  const others = all.data?.filter((day) => day.role === null) ?? [];

  if (all.error === undefined && others.length === 0) {
    return null;
  }
  return (
    <section class="stack">
      <h2>{t('home.othersTitle')}</h2>
      <p class="muted">{t('home.othersHelp')}</p>
      <ErrorMessage error={all.error} />
      <ul class="tiles">
        {others.map((day) => (
          <li key={day.slug}>
            <Link href={`/admin/${day.slug}/team`} class="tile">
              <strong>
                {day.city} {day.year}
              </strong>
              <span class="muted">{t('nav.team')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
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
      <div class="heading-row">
        <h1>{t('home.title')}</h1>
        {user.isInstanceAdmin && (
          <div class="actions">
            <Link href="/admin/instance" class="button">
              {t('instance.title')}
            </Link>
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
      {user.isInstanceAdmin && <OtherMissionDays />}
    </main>
  );
}
