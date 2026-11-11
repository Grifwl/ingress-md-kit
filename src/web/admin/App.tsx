/**
 * Root of the admin application: header, session and screen selection.
 */
import { LANGUAGES, type Language } from '../../shared/rules';
import type { CurrentUser, Member, Mission, MissionDayWithRole, Partner } from '../../shared/types';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/messages';
import { ApiError, getMe, getMissionDay, listMembers, listMissions, listPartners } from './api';
import { ErrorMessage } from './components/common';
import { useAsync } from './hooks';
import type { Route } from './lib/routes';
import { BiocardsPage } from './pages/BiocardsPage';
import { ExportsPage } from './pages/ExportsPage';
import { HomePage } from './pages/HomePage';
import { InstanceSettingsPage } from './pages/InstanceSettingsPage';
import { LetterDefaultsPage } from './pages/LetterDefaultsPage';
import { MapPage } from './pages/MapPage';
import { MissionEditPage } from './pages/MissionEditPage';
import { MissionsPage } from './pages/MissionsPage';
import { NewMissionDayPage } from './pages/NewMissionDayPage';
import { PartnerEditPage } from './pages/PartnerEditPage';
import { PartnersPage } from './pages/PartnersPage';
import { ProfilePage } from './pages/ProfilePage';
import { SelectionPage } from './pages/SelectionPage';
import { SettingsPage } from './pages/SettingsPage';
import { OutsiderTeamPage, TeamPage } from './pages/TeamPage';
import { Link, useRoute } from './router';

/** A route that belongs to one Mission Day. */
type MissionDayRoute = Extract<Route, { slug: string }>;

const TABS: { name: MissionDayRoute['name']; path: string; label: MessageKey }[] = [
  { name: 'missions', path: 'missions', label: 'nav.missions' },
  { name: 'map', path: 'map', label: 'nav.map' },
  { name: 'selection', path: 'selection', label: 'nav.selection' },
  { name: 'partners', path: 'partners', label: 'nav.partners' },
  { name: 'exports', path: 'exports', label: 'nav.exports' },
  { name: 'biocards', path: 'biocards', label: 'nav.biocards' },
  { name: 'settings', path: 'settings', label: 'nav.settings' },
  { name: 'team', path: 'team', label: 'nav.team' },
];

/**
 * Everything under one Mission Day. Mission Day, missions, partners and
 * team are loaded once here and handed down, so moving between tabs is
 * instant and every tab sees the same data.
 *
 * @param props - The current route and the signed-in organiser.
 * @returns The page element.
 */
function MissionDayArea({ route, user }: { route: MissionDayRoute; user: CurrentUser }) {
  const { t } = useI18n();
  const loaded = useAsync(
    () =>
      Promise.all([
        getMissionDay(route.slug),
        listMissions(route.slug),
        listPartners(route.slug),
        listMembers(route.slug),
      ]),
    [route.slug],
  );

  if (loaded.loading) {
    return <main class="page">{t('app.loading')}</main>;
  }
  if (loaded.data === undefined) {
    // An instance administrator outside the team can still manage it.
    const outsider =
      route.name === 'team' &&
      user.isInstanceAdmin &&
      loaded.error instanceof ApiError &&
      loaded.error.status === 404;
    return (
      <main class="page">
        <div class="heading-row">
          <h1>{outsider ? route.slug : ''}</h1>
          <Link href="/admin" class="back-link">
            {t('nav.allMissionDays')}
          </Link>
        </div>
        {outsider ? (
          <OutsiderTeamPage slug={route.slug} user={user} />
        ) : (
          <ErrorMessage error={loaded.error} />
        )}
      </main>
    );
  }

  const [missionDay, missions, partners, members] = loaded.data;

  /**
   * Replaces the missions after a change.
   *
   * @param next - The new list.
   */
  const setMissions = (next: Mission[]) => loaded.setData([missionDay, next, partners, members]);

  /**
   * Replaces the Mission Day after a change.
   *
   * @param next - The new Mission Day.
   */
  const setMissionDay = (next: MissionDayWithRole) =>
    loaded.setData([next, missions, partners, members]);

  /**
   * Replaces the partners after a change.
   *
   * @param next - The new list.
   */
  const setPartners = (next: Partner[]) => loaded.setData([missionDay, missions, next, members]);

  /**
   * Replaces the team after a change.
   *
   * @param next - The new list.
   */
  const setMembers = (next: Member[]) => loaded.setData([missionDay, missions, partners, next]);

  /**
   * Replaces one edited partner.
   *
   * @param updated - The new version.
   */
  const replacePartner = (updated: Partner) =>
    setPartners(partners.map((partner) => (partner.id === updated.id ? updated : partner)));

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
        return (
          <SettingsPage missionDay={missionDay} partners={partners} onChange={setMissionDay} />
        );
      case 'team':
        return (
          <TeamPage
            slug={missionDay.slug}
            user={user}
            role={missionDay.role}
            members={members}
            onChange={setMembers}
            onOwnRoleChange={(role) => setMissionDay({ ...missionDay, role })}
          />
        );
      case 'exports':
        return (
          <ExportsPage
            missionDay={missionDay}
            missions={missions}
            partners={partners}
            onMissionsChange={setMissions}
            onMissionDayChange={setMissionDay}
          />
        );
      case 'biocards':
        return (
          <BiocardsPage
            missionDay={missionDay}
            missions={missions}
            onMissionDayChange={setMissionDay}
            onMissionChange={replaceMission}
          />
        );
      case 'partners':
        return (
          <PartnersPage
            missionDay={missionDay}
            partners={partners}
            onCreated={(partner) => setPartners([...partners, partner])}
          />
        );
      case 'partner': {
        const partner = partners.find((item) => item.id === route.partnerId);
        if (partner === undefined) {
          return <p class="alert">{t('error.not_found')}</p>;
        }
        return (
          <PartnerEditPage
            key={partner.id}
            missionDay={missionDay}
            missions={missions}
            members={members}
            partner={partner}
            onChange={replacePartner}
            onDeleted={(id) => setPartners(partners.filter((item) => item.id !== id))}
          />
        );
      }
    }
  };

  const activeTab =
    route.name === 'mission' ? 'missions' : route.name === 'partner' ? 'partners' : route.name;

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
          {me.data !== undefined && (
            <Link href="/admin/profile" class="muted user-email">
              {me.data.codename === '' ? me.data.email : me.data.codename}
            </Link>
          )}
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
      {me.data !== undefined && route.name === 'letterDefaults' && <LetterDefaultsPage />}
      {me.data !== undefined && route.name === 'instanceSettings' && <InstanceSettingsPage />}
      {me.data !== undefined && route.name === 'profile' && (
        <ProfilePage user={me.data} onChange={me.setData} />
      )}
      {me.data !== undefined && route.name === 'newMissionDay' && (
        <NewMissionDayPage user={me.data} />
      )}
      {me.data !== undefined && route.name === 'notFound' && (
        <main class="page">
          <p class="alert">{t('error.not_found')}</p>
        </main>
      )}
      {me.data !== undefined && 'slug' in route && <MissionDayArea route={route} user={me.data} />}
    </>
  );
}
