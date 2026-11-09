/**
 * Root of the admin application: header, session and screen selection.
 */
import { LANGUAGES, type Language } from '../../shared/rules';
import type { Mission, MissionDayWithRole } from '../../shared/types';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/messages';
import { getMe, getMissionDay, listMissions } from './api';
import { ErrorMessage } from './components/common';
import { useAsync } from './hooks';
import type { Route } from './lib/routes';
import { HomePage } from './pages/HomePage';
import { MapPage } from './pages/MapPage';
import { MissionEditPage } from './pages/MissionEditPage';
import { MissionsPage } from './pages/MissionsPage';
import { SelectionPage } from './pages/SelectionPage';
import { SettingsPage } from './pages/SettingsPage';
import { Link, useRoute } from './router';

/** A route that belongs to one Mission Day. */
type MissionDayRoute = Extract<Route, { slug: string }>;

const TABS: { name: MissionDayRoute['name']; path: string; label: MessageKey }[] = [
  { name: 'missions', path: 'missions', label: 'nav.missions' },
  { name: 'map', path: 'map', label: 'nav.map' },
  { name: 'selection', path: 'selection', label: 'nav.selection' },
  { name: 'settings', path: 'settings', label: 'nav.settings' },
];

/**
 * Everything under one Mission Day. Mission Day and missions are loaded
 * once here and handed down, so moving between tabs is instant and every
 * tab sees the same data.
 *
 * @param props - The current route.
 * @returns The page element.
 */
function MissionDayArea({ route }: { route: MissionDayRoute }) {
  const { t } = useI18n();
  const loaded = useAsync(
    () => Promise.all([getMissionDay(route.slug), listMissions(route.slug)]),
    [route.slug],
  );

  if (loaded.loading) {
    return <main class="page">{t('app.loading')}</main>;
  }
  if (loaded.data === undefined) {
    return (
      <main class="page">
        <ErrorMessage error={loaded.error} />
        <Link href="/admin">{t('nav.allMissionDays')}</Link>
      </main>
    );
  }

  const [missionDay, missions] = loaded.data;

  /**
   * Replaces the missions after a change.
   *
   * @param next - The new list.
   */
  const setMissions = (next: Mission[]) => loaded.setData([missionDay, next]);

  /**
   * Replaces the Mission Day after a change.
   *
   * @param next - The new Mission Day.
   */
  const setMissionDay = (next: MissionDayWithRole) => loaded.setData([next, missions]);

  /**
   * Replaces one edited mission.
   *
   * @param updated - The new version.
   */
  const replaceMission = (updated: Mission) =>
    setMissions(missions.map((mission) => (mission.id === updated.id ? updated : mission)));

  /**
   * Chooses the content of the current tab.
   *
   * @returns The screen element.
   */
  const screen = () => {
    switch (route.name) {
      case 'missions':
        return (
          <MissionsPage
            missionDay={missionDay}
            missions={missions}
            onCreated={(mission) => setMissions([...missions, mission])}
          />
        );
      case 'mission': {
        const mission = missions.find((item) => item.id === route.missionId);
        if (mission === undefined) {
          return <p class="alert">{t('error.not_found')}</p>;
        }
        return (
          // The key resets the form when moving to a different mission.
          <MissionEditPage
            key={mission.id}
            missionDay={missionDay}
            mission={mission}
            onChange={replaceMission}
            onDeleted={(id) => setMissions(missions.filter((item) => item.id !== id))}
          />
        );
      }
      case 'map':
        return <MapPage missions={missions} />;
      case 'selection':
        return <SelectionPage missionDay={missionDay} missions={missions} onChange={setMissions} />;
      case 'settings':
        return <SettingsPage missionDay={missionDay} onChange={setMissionDay} />;
    }
  };

  const activeTab = route.name === 'mission' ? 'missions' : route.name;

  return (
    <main class="page">
      <div class="heading-row">
        <h1>
          {missionDay.city} {missionDay.year}
        </h1>
        <Link href="/admin" class="back-link">
          {t('nav.allMissionDays')}
        </Link>
      </div>
      <nav class="tabs">
        {TABS.map((tab) => (
          <Link
            key={tab.name}
            href={`/admin/${missionDay.slug}/${tab.path}`}
            class={tab.name === activeTab ? 'tab active' : 'tab'}
          >
            {t(tab.label)}
          </Link>
        ))}
      </nav>
      {screen()}
    </main>
  );
}

/**
 * The application shell.
 *
 * @returns The application element.
 */
export function App() {
  const { t, language, setLanguage } = useI18n();
  const route = useRoute();
  const me = useAsync(getMe, []);

  return (
    <>
      <header class="app-header">
        <Link href="/admin" class="brand">
          {t('app.title')}
        </Link>
        <div class="header-end">
          {me.data !== undefined && <span class="muted user-email">{me.data.email}</span>}
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
      </header>
      {me.loading && <main class="page">{t('app.loading')}</main>}
      {me.error !== undefined && (
        <main class="page">
          <ErrorMessage error={me.error} />
        </main>
      )}
      {me.data !== undefined && route.name === 'home' && <HomePage user={me.data} />}
      {me.data !== undefined && route.name === 'notFound' && (
        <main class="page">
          <p class="alert">{t('error.not_found')}</p>
        </main>
      )}
      {me.data !== undefined && 'slug' in route && <MissionDayArea route={route} />}
    </>
  );
}
