/**
 * Settings of the participant view: whether it is public, and whose
 * overlay its images carry. Only owners change them, because publishing
 * opens the Mission Day to anyone with the address.
 */
import { useState } from 'preact/hooks';
import { mayShowLogo } from '../../../shared/partners';
import type { MissionDayWithRole, Partner } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { saveParticipantView } from '../api';
import { ErrorMessage, Field } from './common';

/**
 * The participant view section of the settings screen.
 *
 * @param props - The Mission Day, its partners and a callback receiving saved changes.
 * @returns The section element.
 */
export function ParticipantViewSettings({
  missionDay,
  partners,
  onChange,
}: {
  missionDay: MissionDayWithRole;
  partners: readonly Partner[];
  onChange: (missionDay: MissionDayWithRole) => void;
}) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(missionDay.participantViewEnabled);
  const [partnerId, setPartnerId] = useState(missionDay.participantPartnerId ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();

  const isOwner = missionDay.role === 'owner';
  const address = `${location.origin}/${missionDay.slug}`;
  // Only partners whose logo may be shown, and who have an overlay, can
  // be chosen; the Worker checks the same before saving.
  const eligible = partners.filter((partner) => partner.hasOverlay && mayShowLogo(partner));
  const chosen = partners.find((partner) => partner.id === missionDay.participantPartnerId);
  const chosenLapsed =
    missionDay.participantPartnerId !== null &&
    (chosen === undefined || !chosen.hasOverlay || !mayShowLogo(chosen));
  const notApproved = missionDay.status === 'draft' || missionDay.status === 'applied';

  /**
   * Saves both settings.
   *
   * @param event - Form submission.
   */
  const save = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(undefined);
    try {
      onChange(await saveParticipantView(missionDay.slug, enabled, partnerId || null));
      setSaved(true);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="card" onSubmit={save}>
      <h2>{t('participantSettings.title')}</h2>
      <p class="muted">{t('participantSettings.help')}</p>
      <p>
        <a href={address} target="_blank" rel="noopener" class="slug-preview">
          {address}
        </a>
      </p>
      {missionDay.participantViewEnabled && notApproved && (
        <p class="alert">{t('participantSettings.notApproved')}</p>
      )}
      {chosenLapsed && <p class="alert">{t('participantSettings.partnerLapsed')}</p>}
      {isOwner ? (
        <>
          <label class="check">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                setSaved(false);
                setEnabled(e.currentTarget.checked);
              }}
            />
            {t('participantSettings.enabled')}
          </label>
          <Field
            label={t('participantSettings.partner')}
            help={t('participantSettings.partnerHelp')}
          >
            <select
              value={partnerId}
              onChange={(e) => {
                setSaved(false);
                setPartnerId(e.currentTarget.value);
              }}
            >
              <option value="">{t('participantSettings.defaultOverlay')}</option>
              {eligible.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>
          </Field>
          <ErrorMessage error={error} />
          <div class="actions">
            <button class="button primary" disabled={busy}>
              {busy ? t('common.saving') : t('common.save')}
            </button>
            {saved && <span class="muted">{t('common.saved')}</span>}
          </div>
        </>
      ) : (
        <p class="muted">
          {t(
            missionDay.participantViewEnabled
              ? 'participantSettings.isPublished'
              : 'participantSettings.isHidden',
          )}{' '}
          {t('participantSettings.ownersOnly')}
        </p>
      )}
    </form>
  );
}
