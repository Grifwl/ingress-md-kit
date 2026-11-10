/**
 * The signed-in organiser's own profile, shared by all their Mission Days.
 */
import { useState } from 'preact/hooks';
import type { CurrentUser, Faction } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { saveProfile } from '../api';
import { ErrorMessage, Field } from '../components/common';
import { Link } from '../router';

/** Name of the cookie that picks the identity in local development. */
const DEV_USER_COOKIE = 'dev_user';

/**
 * Lets a developer act as another organiser on their own computer, to try
 * what owners and editors see. The Worker honours the cookie only when it
 * runs with `ENVIRONMENT=dev`, and the block is left out of production
 * builds altogether.
 *
 * @param props - The current identity.
 * @returns The block element.
 */
function DevIdentity({ email }: { email: string }) {
  const { t } = useI18n();
  const [value, setValue] = useState(email);

  /**
   * Stores the chosen identity and reloads everything as that person.
   *
   * @param next - Email to act as; empty goes back to the default one.
   */
  const switchTo = (next: string) => {
    const cookie = encodeURIComponent(next.trim().toLowerCase());
    document.cookie =
      next.trim() === ''
        ? `${DEV_USER_COOKIE}=; path=/; max-age=0`
        : `${DEV_USER_COOKIE}=${cookie}; path=/; SameSite=Strict`;
    location.reload();
  };

  return (
    <section class="card">
      <h2>{t('profile.devTitle')}</h2>
      <p class="muted">{t('profile.devHelp')}</p>
      <form
        class="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          switchTo(value);
        }}
      >
        <input type="email" value={value} onInput={(e) => setValue(e.currentTarget.value)} />
        <button class="button">{t('profile.devSwitch')}</button>
        <button type="button" class="button" onClick={() => switchTo('')}>
          {t('profile.devReset')}
        </button>
      </form>
    </section>
  );
}

/**
 * The profile screen.
 *
 * @param props - The signed-in organiser and a callback receiving saved changes.
 * @returns The page element.
 */
export function ProfilePage({
  user,
  onChange,
}: {
  user: CurrentUser;
  onChange: (user: CurrentUser) => void;
}) {
  const { t } = useI18n();
  const [codename, setCodename] = useState(user.codename);
  const [faction, setFaction] = useState<Faction | null>(user.faction);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();

  /**
   * Saves the profile.
   *
   * @param event - Form submission.
   */
  const save = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(undefined);
    try {
      onChange(await saveProfile({ codename, faction }));
      setSaved(true);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main class="page">
      <div class="heading-row">
        <h1>{t('profile.title')}</h1>
        <Link href="/admin" class="back-link">
          {t('nav.allMissionDays')}
        </Link>
      </div>
      <form class="card" onSubmit={save}>
        <p class="muted">{t('profile.help', { email: user.email })}</p>
        <div class="grid-2">
          <Field label={t('settings.codename')}>
            <input value={codename} onInput={(e) => setCodename(e.currentTarget.value)} />
          </Field>
          <Field label={t('team.faction')}>
            <select
              value={faction ?? ''}
              onChange={(e) =>
                setFaction(e.currentTarget.value === '' ? null : (e.currentTarget.value as Faction))
              }
            >
              <option value="">—</option>
              <option value="ENL">{t('faction.ENL')}</option>
              <option value="RES">{t('faction.RES')}</option>
            </select>
          </Field>
        </div>
        <ErrorMessage error={error} />
        <div class="actions">
          <button class="button primary" disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
          {saved && <span class="muted">{t('common.saved')}</span>}
        </div>
      </form>
      {import.meta.env.DEV && <DevIdentity email={user.email} />}
    </main>
  );
}
