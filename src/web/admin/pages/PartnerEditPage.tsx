/**
 * Editing one partner: details, permission request, conversation, files,
 * the link of its proposal and a preview of the images.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { proposalPath } from '../../../shared/letter';
import {
  PARTNER_KINDS,
  PARTNER_STATUSES,
  type PartnerKind,
  type PartnerStatus,
} from '../../../shared/partners';
import { LANGUAGES, type Language } from '../../../shared/rules';
import type { LocalizedText, Mission, MissionDayWithRole, Partner } from '../../../shared/types';
import { useI18n } from '../../i18n';
import {
  changePartnerStatus,
  defaultOverlayUrl,
  deletePartner,
  partnerFileUrl,
  regenerateProposalToken,
  updatePartner,
  uploadPartnerFile,
  type PartnerFileKind,
} from '../api';
import { ConfirmButton, ErrorMessage, Field, FileUpload } from '../components/common';
import { Mosaic } from '../components/Mosaic';
import { selectedInOrder } from '../lib/selection';
import { Link, navigate } from '../router';

/** How long the "copied" confirmation stays visible, in milliseconds. */
const COPIED_NOTICE_MS = 2000;

/**
 * Shows and manages the secret link of a proposal.
 *
 * @param props - The Mission Day slug, the partner and a change callback.
 * @returns The section element.
 */
function ProposalLink({
  slug,
  partner,
  onChange,
}: {
  slug: string;
  partner: Partner;
  onChange: (partner: Partner) => void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<unknown>();
  const url = `${location.origin}${proposalPath(slug, partner.letterLanguage, partner.proposalToken)}`;

  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timer = setTimeout(() => setCopied(false), COPIED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  /** Replaces the link, which stops the previous one from working. */
  const regenerate = async () => {
    setError(undefined);
    try {
      onChange(await regenerateProposalToken(slug, partner.id));
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <section class="card">
      <h2>{t('partner.proposal')}</h2>
      <p class="muted">{t('partner.proposalHelp')}</p>
      <div class="inline-form">
        <input readOnly value={url} aria-label={t('partner.proposal')} />
        <button
          type="button"
          class="button"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          {copied ? t('partner.copied') : t('partner.copy')}
        </button>
        <a class="button" href={url} target="_blank" rel="noreferrer">
          {t('partner.open')}
        </a>
      </div>
      <ConfirmButton
        onConfirm={regenerate}
        label={t('partner.regenerate')}
        confirmLabel={t('partner.confirmRegenerate')}
      />
      <ErrorMessage error={error} />
    </section>
  );
}

/**
 * Records the progress of the conversation and shows its history.
 *
 * @param props - The Mission Day slug, the partner and a change callback.
 * @returns The section element.
 */
function StatusSection({
  slug,
  partner,
  onChange,
}: {
  slug: string;
  partner: Partner;
  onChange: (partner: Partner) => void;
}) {
  const { t, language } = useI18n();
  const [status, setStatus] = useState<PartnerStatus>(partner.status);
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>();

  /** Saves the change of status. */
  const register = async () => {
    setError(undefined);
    try {
      onChange(await changePartnerStatus(slug, partner.id, status, note.trim()));
      setNote('');
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <section class="card">
      <h2>{t('partner.status')}</h2>
      <div class="grid-2">
        <Field label={t('partner.statusNew')}>
          <select
            value={status}
            onChange={(e) => setStatus(e.currentTarget.value as PartnerStatus)}
          >
            {PARTNER_STATUSES.map((option) => (
              <option key={option} value={option}>
                {t(`partnerStatus.${option}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('partner.statusNote')}>
          <input value={note} onInput={(e) => setNote(e.currentTarget.value)} />
        </Field>
      </div>
      <button type="button" class="button" onClick={register}>
        {t('partner.statusRegister')}
      </button>
      <ErrorMessage error={error} />
      <ol class="history">
        {[...partner.statusHistory].reverse().map((change, index) => (
          <li key={index}>
            <strong>{t(`partnerStatus.${change.status}`)}</strong>
            <span class="muted">
              {new Date(change.changedAt).toLocaleDateString(language)} · {change.changedBy}
            </span>
            {change.note !== '' && <span>{change.note}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The partner editor.
 *
 * @param props - The Mission Day, its missions, the partner and callbacks.
 * @returns The page element.
 */
export function PartnerEditPage({
  missionDay,
  missions,
  partner,
  onChange,
  onDeleted,
}: {
  missionDay: MissionDayWithRole;
  missions: readonly Mission[];
  partner: Partner;
  onChange: (partner: Partner) => void;
  onDeleted: (partnerId: string) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(partner.name);
  const [kind, setKind] = useState<PartnerKind>(partner.kind);
  const [contactPerson, setContactPerson] = useState(partner.contactPerson);
  const [contactEmail, setContactEmail] = useState(partner.contactEmail);
  const [whyYou, setWhyYou] = useState(partner.whyYou);
  const [logoRequest, setLogoRequest] = useState<LocalizedText>(partner.logoRequest);
  const [letterLanguage, setLetterLanguage] = useState<Language>(partner.letterLanguage);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();

  const slug = missionDay.slug;
  const partnersPath = `/admin/${slug}/partners`;
  const selected = useMemo(() => selectedInOrder(missions), [missions]);
  const overlayUrl = partner.hasOverlay
    ? partnerFileUrl(slug, partner, 'overlay')
    : defaultOverlayUrl(missionDay);

  /**
   * Saves the text fields.
   *
   * @param event - Form submission.
   */
  const save = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(undefined);
    try {
      onChange(
        await updatePartner(slug, partner.id, {
          name,
          kind,
          contactPerson,
          contactEmail,
          whyYou,
          logoRequest,
          letterLanguage,
        }),
      );
      setSaved(true);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  /** Deletes the partner and returns to the list. */
  const remove = async () => {
    setError(undefined);
    try {
      await deletePartner(slug, partner.id);
      onDeleted(partner.id);
      navigate(partnersPath);
    } catch (failure) {
      setError(failure);
    }
  };

  /**
   * Uploads one of the partner's files.
   *
   * @param kind_ - Which file.
   * @param file - The file.
   */
  const upload = async (kind_: PartnerFileKind, file: File) =>
    onChange(await uploadPartnerFile(slug, partner.id, kind_, file));

  return (
    <div class="stack">
      <Link href={partnersPath} class="back-link">
        ← {t('partner.back')}
      </Link>

      <ProposalLink slug={slug} partner={partner} onChange={onChange} />

      <form class="stack" onSubmit={save}>
        <section class="card">
          <h2>{t('partner.details')}</h2>
          <div class="grid-2">
            <Field label={t('partner.name')}>
              <input required value={name} onInput={(e) => setName(e.currentTarget.value)} />
            </Field>
            <Field label={t('partner.kind')}>
              <select value={kind} onChange={(e) => setKind(e.currentTarget.value as PartnerKind)}>
                {PARTNER_KINDS.map((option) => (
                  <option key={option} value={option}>
                    {t(`kind.${option}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('partner.contactPerson')}>
              <input
                value={contactPerson}
                onInput={(e) => setContactPerson(e.currentTarget.value)}
              />
            </Field>
            <Field label={t('partner.contactEmail')}>
              <input
                type="email"
                value={contactEmail}
                onInput={(e) => setContactEmail(e.currentTarget.value)}
              />
            </Field>
            <Field label={t('partner.letterLanguage')}>
              <select
                value={letterLanguage}
                onChange={(e) => setLetterLanguage(e.currentTarget.value as Language)}
              >
                {LANGUAGES.map((option) => (
                  <option key={option} value={option}>
                    {option.toUpperCase()}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t('partner.whyYou')}>
            <textarea rows={4} value={whyYou} onInput={(e) => setWhyYou(e.currentTarget.value)} />
          </Field>
          <Field
            label={`${t('partner.logoRequest')} (${letterLanguage.toUpperCase()})`}
            help={t('partner.logoRequestHelp')}
          >
            <textarea
              rows={6}
              value={logoRequest[letterLanguage] ?? ''}
              onInput={(e) =>
                setLogoRequest({ ...logoRequest, [letterLanguage]: e.currentTarget.value })
              }
            />
          </Field>
          <p class="field-help">{t('settings.placeholdersHelp')}</p>
        </section>

        <ErrorMessage error={error} />
        <div class="actions">
          <button class="button primary" disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
          {saved && <span class="muted">{t('common.saved')}</span>}
          {missionDay.role === 'owner' && <ConfirmButton onConfirm={remove} disabled={busy} />}
        </div>
      </form>

      <StatusSection slug={slug} partner={partner} onChange={onChange} />

      <section class="card">
        <h2>{t('partner.files')}</h2>
        <div class="grid-2">
          <FileUpload
            label={t('partner.logo')}
            help={t('partner.logoHelp')}
            accept="image/png,image/jpeg,image/webp"
            onUpload={(file) => upload('logo', file)}
          >
            {partner.hasLogo && (
              <img
                class="file-preview"
                src={partnerFileUrl(slug, partner, 'logo')}
                alt={t('partner.logo')}
              />
            )}
          </FileUpload>
          <FileUpload
            label={t('partner.overlay')}
            help={t('partner.overlayHelp')}
            accept="image/png"
            onUpload={(file) => upload('overlay', file)}
          >
            {partner.hasOverlay && (
              <img
                class="file-preview overlay"
                src={partnerFileUrl(slug, partner, 'overlay')}
                alt={t('partner.overlay')}
              />
            )}
          </FileUpload>
          <FileUpload
            label={t('partner.approval')}
            help={t('partner.approvalHelp')}
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onUpload={(file) => upload('approval', file)}
          >
            {partner.hasApproval && (
              <a href={partnerFileUrl(slug, partner, 'approval')}>
                {t('partner.approvalDownload', { name: partner.approvalName ?? '' })}
              </a>
            )}
          </FileUpload>
        </div>
      </section>

      <section class="card">
        <h2>{t('partner.preview')}</h2>
        <p class="muted">{t('partner.previewHelp')}</p>
        <Mosaic missionDay={missionDay} selected={selected} overlayUrl={overlayUrl} />
      </section>
    </div>
  );
}
