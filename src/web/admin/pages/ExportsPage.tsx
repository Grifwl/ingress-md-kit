/**
 * Exports of a Mission Day. Those that end up with Niantic refuse to run
 * while there are errors; warnings never block anything.
 */
import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import {
  LANGUAGES,
  canExportForNiantic,
  fullMissionName,
  nianticExportIssues,
  validateSelection,
  type Language,
  type NianticContext,
  type ValidationIssue,
} from '../../../shared/rules';
import type { Mission, MissionDay, Partner } from '../../../shared/types';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/messages';
import { composeImage } from '../../lib/compose';
import { buildApplicationBlocks } from '../../lib/exports/application';
import { downloadFile } from '../../lib/exports/download';
import { buildKml, buildMissionSheet } from '../../lib/exports/sheets';
import { buildZip, missionImageName, type ZipEntry } from '../../lib/exports/zip';
import { UMM_MIME_TYPE, buildUmmFile, ummFileName } from '../../lib/umm';
import { defaultOverlayUrl, partnerFileUrl, photoUrl, saveUmmManifest } from '../api';
import { ErrorMessage, Field, IssueList } from '../components/common';
import { UmmImport } from '../components/UmmImport';
import { candidatesForList, selectedInOrder } from '../lib/selection';

const CSV_MIME_TYPE = 'text/csv;charset=utf-8';
const KML_MIME_TYPE = 'application/vnd.google-earth.kml+xml';

/**
 * One export: its description, what prevents it, and its button.
 *
 * @param props - Texts, the issues that block it, what it does, and an
 *   optional progress text.
 * @returns The card element.
 */
function ExportCard({
  title,
  help,
  blocked,
  onRun,
  progress,
  children,
}: {
  title: string;
  help: string;
  blocked: boolean;
  onRun: () => Promise<void>;
  progress?: string;
  children?: ComponentChildren;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  /** Runs the export, keeping the button disabled meanwhile. */
  const run = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await onRun();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="card">
      <h3>{title}</h3>
      <p class="muted">{help}</p>
      {children}
      <ErrorMessage error={error} />
      <button type="button" class="button primary" disabled={blocked || busy} onClick={run}>
        {busy ? (progress ?? t('exports.generating')) : t('exports.download')}
      </button>
    </section>
  );
}

/**
 * One answer of the application, with a button to copy it.
 *
 * @param props - Label and text.
 * @returns The block element.
 */
function Answer({ label, text }: { label: string; text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div class="answer">
      <div class="heading-row">
        <span class="field-label">{label}</span>
        <button
          type="button"
          class="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? t('partner.copied') : t('partner.copy')}
        </button>
      </div>
      <textarea readOnly rows={Math.min(8, text.split('\n').length + 1)} value={text} />
    </div>
  );
}

/**
 * The exports screen.
 *
 * @param props - The Mission Day, its missions and partners, and a callback
 *   for when an import changes the missions.
 * @returns The page element.
 */
export function ExportsPage({
  missionDay,
  missions,
  partners,
  onMissionsChange,
}: {
  missionDay: MissionDay;
  missions: readonly Mission[];
  partners: readonly Partner[];
  onMissionsChange: (missions: Mission[]) => void;
}) {
  const { t, tDynamic, language: uiLanguage } = useI18n();
  const [partnerId, setPartnerId] = useState('');
  const [language, setLanguage] = useState<Language>(uiLanguage);
  const [progress, setProgress] = useState<string>();

  const partner = partners.find((item) => item.id === partnerId) ?? null;
  const selected = useMemo(() => selectedInOrder(missions), [missions]);
  const selectionIssues = useMemo(
    () => validateSelection(missionDay, missions),
    [missionDay, missions],
  );
  const context: NianticContext = { missionDay, selected, partner };

  const ummIssues = nianticExportIssues('umm', context);
  const imageIssues = nianticExportIssues('images', context);
  const applicationIssues = nianticExportIssues('application', context);

  /**
   * Tells whether an export for Niantic has to be refused.
   *
   * @param issues - Issues specific to that export.
   * @returns True when it cannot run.
   */
  const isBlocked = (issues: readonly ValidationIssue[]) =>
    !canExportForNiantic([...selectionIssues, ...issues]);

  /**
   * Exports missions to a UMM file and remembers their positions, which
   * is how the file will be recognised when it comes back.
   *
   * @param list - Missions to include, in the order of the file.
   */
  const exportUmm = async (list: readonly Mission[]) => {
    await saveUmmManifest(
      missionDay.slug,
      list.map((mission) => mission.id),
    );
    const file = buildUmmFile(missionDay, list, language);
    downloadFile(JSON.stringify(file, null, 2), ummFileName(missionDay.slug), UMM_MIME_TYPE);
  };

  /** Composes every selected image with its overlay and zips them. */
  const exportImages = async () => {
    const overlayUrl =
      partner === null
        ? defaultOverlayUrl(missionDay)
        : partnerFileUrl(missionDay.slug, partner, 'overlay');
    const entries: ZipEntry[] = [];
    try {
      for (const [index, mission] of selected.entries()) {
        setProgress(t('exports.progress', { done: index + 1, total: selected.length }));
        const image = await composeImage(photoUrl(missionDay.slug, mission), overlayUrl);
        entries.push({
          name: missionImageName(index + 1, fullMissionName(missionDay, mission.landmark)),
          bytes: new Uint8Array(await image.arrayBuffer()),
        });
      }
    } finally {
      setProgress(undefined);
    }
    const suffix = partner === null ? 'default' : 'partner';
    downloadFile(buildZip(entries), `${missionDay.slug}-images-${suffix}.zip`, 'application/zip');
  };

  const answers = isBlocked(applicationIssues)
    ? []
    : buildApplicationBlocks(
        missionDay,
        selected,
        partner,
        language,
        partner === null ? '' : t(`partnerStatus.${partner.status}`),
      );

  /**
   * Shows what blocks an export, beyond the selection shown at the top.
   *
   * @param issues - Issues specific to that export.
   * @returns The list, or nothing.
   */
  const blockers = (issues: readonly ValidationIssue[]) =>
    issues.length === 0 ? null : (
      <IssueList issues={issues} missions={missions} missionDay={missionDay} />
    );

  return (
    <div class="stack">
      <h2>{t('exports.title')}</h2>

      <section class="card">
        <div class="grid-2">
          <Field label={t('exports.partner')} help={t('exports.partnerHelp')}>
            <select value={partnerId} onChange={(e) => setPartnerId(e.currentTarget.value)}>
              <option value="">{t('exports.noPartner')}</option>
              {partners.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {t(`partnerStatus.${item.status}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('exports.language')} help={t('exports.languageHelp')}>
            <select
              value={language}
              onChange={(e) => setLanguage(e.currentTarget.value as Language)}
            >
              {LANGUAGES.map((option) => (
                <option key={option} value={option}>
                  {option.toUpperCase()}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <h3>{t('selection.validation')}</h3>
        {selectionIssues.length === 0 ? (
          <p class="success">{t('selection.allGood')}</p>
        ) : (
          <IssueList issues={selectionIssues} missions={missions} missionDay={missionDay} />
        )}
      </section>

      <div class="exports-grid">
        <ExportCard
          title={t('exports.ummMatTitle')}
          help={t('exports.ummMatHelp')}
          blocked={isBlocked(ummIssues)}
          onRun={() => exportUmm(selected)}
        >
          {blockers(ummIssues)}
        </ExportCard>
        <ExportCard
          title={t('exports.imagesTitle')}
          help={t('exports.imagesHelp')}
          blocked={isBlocked(imageIssues)}
          onRun={exportImages}
          progress={progress}
        >
          {blockers(imageIssues)}
        </ExportCard>
        <ExportCard
          title={t('exports.ummAllTitle')}
          help={t('exports.ummAllHelp')}
          blocked={missions.length === 0}
          onRun={() => exportUmm(candidatesForList(missions))}
        />
        <ExportCard
          title={t('exports.csvTitle')}
          help={t('exports.csvHelp')}
          blocked={selected.length === 0}
          onRun={async () =>
            downloadFile(
              buildMissionSheet(missionDay, selected, language),
              `${missionDay.slug}-missions.csv`,
              CSV_MIME_TYPE,
            )
          }
        />
        <ExportCard
          title={t('exports.kmlTitle')}
          help={t('exports.kmlHelp')}
          blocked={selected.length === 0}
          onRun={async () =>
            downloadFile(
              buildKml(missionDay, selected),
              `${missionDay.slug}-map.kml`,
              KML_MIME_TYPE,
            )
          }
        />
      </div>

      <UmmImport missionDay={missionDay} missions={missions} onImported={onMissionsChange} />

      <section class="card">
        <h2>{t('exports.applicationTitle')}</h2>
        <p class="muted">{t('exports.applicationHelp')}</p>
        {blockers(applicationIssues)}
        {isBlocked(applicationIssues) && applicationIssues.length === 0 && (
          <p class="alert">{t('exports.applicationBlocked')}</p>
        )}
        {answers.map((answer) => (
          <Answer
            key={answer.key}
            label={tDynamic(`exports.answer.${answer.key}`) as MessageKey}
            text={answer.text}
          />
        ))}
      </section>
    </div>
  );
}
