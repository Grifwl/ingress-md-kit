/**
 * Settings of the whole instance, reserved to its administrators. For now
 * it holds the contact shown on the public home page.
 */
import { useState } from 'preact/hooks';
import { CONTACT_MAX_LENGTH } from '../../../shared/home';
import type { InstanceSettings } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { getInstanceSettings, saveInstanceSettings } from '../api';
import { ErrorMessage, Field } from '../components/common';
import { useAsync } from '../hooks';
import { Link } from '../router';

/**
 * Form holding the settings once they have been loaded.
 *
 * @param props - Settings currently saved.
 * @returns The form element.
 */
function InstanceSettingsForm({ initial }: { initial: InstanceSettings }) {
  const { t } = useI18n();
  const [contact, setContact] = useState(initial.contact);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();

  /**
   * Saves the settings.
   *
   * @param event - Form submission.
   */
  const save = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(undefined);
    try {
      const result = await saveInstanceSettings({ contact });
      setContact(result.contact);
      setSaved(true);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="stack" onSubmit={save}>
      <section class="card stack">
        <Field label={t('instance.contact')} help={t('instance.contactHelp')}>
          <input
            value={contact}
            maxLength={CONTACT_MAX_LENGTH}
            onInput={(event) => {
              setSaved(false);
              setContact(event.currentTarget.value);
            }}
          />
        </Field>
      </section>
      <ErrorMessage error={error} />
      <div class="actions">
        <button class="button primary" disabled={busy}>
          {busy ? t('common.saving') : t('common.save')}
        </button>
        {saved && <span class="muted">{t('common.saved')}</span>}
        <a href="/" target="_blank" rel="noopener">
          {t('instance.viewHome')}
        </a>
      </div>
    </form>
  );
}

/**
 * The instance settings screen.
 *
 * @returns The page element.
 */
export function InstanceSettingsPage() {
  const { t } = useI18n();
  const settings = useAsync(getInstanceSettings, []);

  return (
    <main class="page">
      <div class="heading-row">
        <h1>{t('instance.title')}</h1>
        <Link href="/admin" class="back-link">
          {t('nav.allMissionDays')}
        </Link>
      </div>
      <p class="muted">{t('instance.help')}</p>
      <ErrorMessage error={settings.error} />
      {settings.loading && <p>{t('app.loading')}</p>}
      {settings.data !== undefined && <InstanceSettingsForm initial={settings.data} />}
    </main>
  );
}
