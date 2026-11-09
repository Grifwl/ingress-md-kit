/**
 * List of the partners of a Mission Day.
 */
import { useState } from 'preact/hooks';
import type { MissionDay, Partner } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { createPartner, partnerFileUrl } from '../api';
import { ErrorMessage } from '../components/common';
import { Link, navigate } from '../router';

/**
 * Chooses the look of a status badge.
 *
 * @param status - Status of the partner.
 * @returns The CSS classes.
 */
function statusClass(status: Partner['status']): string {
  if (status === 'accepted') return 'badge ok';
  return status === 'declined' ? 'badge warn' : 'badge';
}

/**
 * The partners screen.
 *
 * @param props - The Mission Day, its partners and a callback for a new one.
 * @returns The page element.
 */
export function PartnersPage({
  missionDay,
  partners,
  onCreated,
}: {
  missionDay: MissionDay;
  partners: readonly Partner[];
  onCreated: (partner: Partner) => void;
}) {
  const { t, language } = useI18n();
  const [name, setName] = useState('');
  const [error, setError] = useState<unknown>();

  /**
   * Creates a partner and opens it for editing.
   *
   * @param event - Form submission.
   */
  const add = async (event: Event) => {
    event.preventDefault();
    setError(undefined);
    try {
      const partner = await createPartner(missionDay.slug, name.trim(), language);
      onCreated(partner);
      setName('');
      navigate(`/admin/${missionDay.slug}/partners/${partner.id}`);
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <div class="stack">
      <h2>{t('partners.title')}</h2>
      <form class="inline-form" onSubmit={add}>
        <input
          required
          placeholder={t('partners.newPlaceholder')}
          aria-label={t('partners.newPlaceholder')}
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <button class="button primary">{t('partners.add')}</button>
      </form>
      <ErrorMessage error={error} />
      {partners.length === 0 && <p class="muted">{t('partners.empty')}</p>}
      <ul class="mission-list">
        {partners.map((partner) => (
          <li key={partner.id}>
            <Link href={`/admin/${missionDay.slug}/partners/${partner.id}`} class="mission-row">
              <span class="thumb logo">
                {partner.hasLogo && (
                  <img src={partnerFileUrl(missionDay.slug, partner, 'logo')} alt="" />
                )}
              </span>
              <span class="mission-name">{partner.name}</span>
              <span class="muted">{t(`kind.${partner.kind}`)}</span>
              {missionDay.samplePartnerId === partner.id && (
                <span class="badge">{t('partners.sampleBadge')}</span>
              )}
              <span class={statusClass(partner.status)}>
                {t(`partnerStatus.${partner.status}`)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
