/**
 * Default letter texts of the instance, reserved to its administrators.
 */
import { useState } from 'preact/hooks';
import type { LetterSections } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { getLetterDefaults, saveLetterDefaults } from '../api';
import { ErrorMessage } from '../components/common';
import { LetterEditor } from '../components/LetterEditor';
import { useAsync } from '../hooks';
import { Link } from '../router';

/**
 * Form holding the texts once they have been loaded.
 *
 * @param props - Texts currently saved.
 * @returns The form element.
 */
function LetterDefaultsForm({ initial }: { initial: LetterSections }) {
  const { t } = useI18n();
  const [letter, setLetter] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();

  /**
   * Saves the texts.
   *
   * @param event - Form submission.
   */
  const save = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(undefined);
    try {
      await saveLetterDefaults(letter);
      setSaved(true);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="stack" onSubmit={save}>
      <section class="card">
        <LetterEditor
          value={letter}
          onChange={(next) => {
            setSaved(false);
            setLetter(next);
          }}
        />
      </section>
      <ErrorMessage error={error} />
      <div class="actions">
        <button class="button primary" disabled={busy}>
          {busy ? t('common.saving') : t('common.save')}
        </button>
        {saved && <span class="muted">{t('common.saved')}</span>}
      </div>
    </form>
  );
}

/**
 * The default letter texts screen.
 *
 * @returns The page element.
 */
export function LetterDefaultsPage() {
  const { t } = useI18n();
  const defaults = useAsync(getLetterDefaults, []);

  return (
    <main class="page">
      <div class="heading-row">
        <h1>{t('letterDefaults.title')}</h1>
        <Link href="/admin" class="back-link">
          {t('nav.allMissionDays')}
        </Link>
      </div>
      <p class="muted">{t('letterDefaults.help')}</p>
      <ErrorMessage error={defaults.error} />
      {defaults.loading && <p>{t('app.loading')}</p>}
      {defaults.data !== undefined && <LetterDefaultsForm initial={defaults.data} />}
    </main>
  );
}
