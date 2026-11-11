/**
 * Settings of the whole instance, reserved to its administrators. For now
 * it holds the contact shown on the public home page.
 */
import { useState } from 'preact/hooks';
import {
  CONTACT_LABEL_MAX_LENGTH,
  CONTACT_URL_MAX_LENGTH,
  contactLink,
  isAllowedContactUrl,
} from '../../../shared/home';
import type { InstanceSettings } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { getInstanceSettings, saveInstanceSettings } from '../api';
import { ErrorMessage, Field } from '../components/common';
import { useAsync } from '../hooks';
import { Link } from '../router';

/**
 * Form holding the settings once they have been loaded. A preview shows
 * the contact exactly as the home page will, so that the administrator
 * can check the text and try the link before saving.
 *
 * @param props - Settings currently saved.
 * @returns The form element.
 */
function InstanceSettingsForm({ initial }: { initial: InstanceSettings }) {
  const { t } = useI18n();
  const [settings, setSettings] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();

  const url = settings.contactUrl.trim();
  // Checked here too, so that a wrong address is flagged while typing
  // rather than only when the Worker refuses it.
  const urlInvalid = url !== '' && !isAllowedContactUrl(url);
  const preview = contactLink(settings.contactLabel, urlInvalid ? '' : url);

  /**
   * Changes one field of the form.
   *
   * @param field - Field to change.
   * @param value - Its new value.
   */
  const update = (field: keyof InstanceSettings, value: string) => {
    setSaved(false);
    setSettings((current) => ({ ...current, [field]: value }));
  };

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
      setSettings(await saveInstanceSettings(settings));
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
        <h2>{t('instance.contactTitle')}</h2>
        <p class="muted">{t('instance.contactHelp')}</p>
        <Field label={t('instance.contactLabel')} help={t('instance.contactLabelHelp')}>
          <input
            value={settings.contactLabel}
            maxLength={CONTACT_LABEL_MAX_LENGTH}
            placeholder="@codename"
            onInput={(event) => update('contactLabel', event.currentTarget.value)}
          />
        </Field>
        <Field label={t('instance.contactUrl')} help={t('instance.contactUrlHelp')}>
          <input
            value={settings.contactUrl}
            maxLength={CONTACT_URL_MAX_LENGTH}
            placeholder="https://t.me/codename"
            aria-invalid={urlInvalid}
            onInput={(event) => update('contactUrl', event.currentTarget.value)}
          />
        </Field>
        {urlInvalid && <p class="alert">{t('error.invalid_contact_url')}</p>}
        <p>
          <span class="muted">{t('instance.preview')} </span>
          {preview === null && <span class="muted">{t('instance.noContact')}</span>}
          {preview !== null && preview.href === null && <strong>{preview.label}</strong>}
          {preview !== null && preview.href !== null && (
            <a href={preview.href} target="_blank" rel="noopener">
              <strong>{preview.label}</strong>
            </a>
          )}
        </p>
      </section>
      <ErrorMessage error={error} />
      <div class="actions">
        <button class="button primary" disabled={busy || urlInvalid}>
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
