/**
 * Settings of a Mission Day: general data, team and shared letter texts.
 */
import { useState } from 'preact/hooks';
import { MISSION_FORMATS, type MissionFormat } from '../../../shared/rules';
import type {
  LetterSections,
  MissionDayStatus,
  MissionDayWithRole,
  Team,
  TeamContact,
} from '../../../shared/types';
import { useI18n } from '../../i18n';
import {
  defaultOverlayUrl,
  deleteMissionDay,
  mapScreenshotUrl,
  updateMissionDay,
  uploadDefaultOverlay,
  uploadMapScreenshot,
} from '../api';
import { ConfirmButton, ErrorMessage, Field, FileUpload } from '../components/common';
import { LetterEditor } from '../components/LetterEditor';
import { navigate } from '../router';

const FORMATS = Object.keys(MISSION_FORMATS) as MissionFormat[];
const STATUSES: MissionDayStatus[] = ['draft', 'applied', 'approved', 'done'];

/**
 * Inputs for one member of the team.
 *
 * @param props - Current value and change handler.
 * @returns The inputs.
 */
function ContactInputs({
  value,
  onChange,
}: {
  value: TeamContact;
  onChange: (value: TeamContact) => void;
}) {
  const { t } = useI18n();
  return (
    <div class="grid-2">
      <Field label={t('settings.codename')}>
        <input
          value={value.codename}
          onInput={(e) => onChange({ ...value, codename: e.currentTarget.value })}
        />
      </Field>
      <Field label={t('settings.contact')}>
        <input
          value={value.contact}
          onInput={(e) => onChange({ ...value, contact: e.currentTarget.value })}
        />
      </Field>
    </div>
  );
}

/**
 * The settings screen.
 *
 * @param props - The Mission Day and a callback receiving saved changes.
 * @returns The page element.
 */
export function SettingsPage({
  missionDay,
  onChange,
}: {
  missionDay: MissionDayWithRole;
  onChange: (missionDay: MissionDayWithRole) => void;
}) {
  const { t } = useI18n();
  const [city, setCity] = useState(missionDay.city);
  const [year, setYear] = useState(missionDay.year);
  const [date, setDate] = useState(missionDay.date ?? '');
  const [format, setFormat] = useState(missionDay.format);
  const [status, setStatus] = useState(missionDay.status);
  const [myMapsUrl, setMyMapsUrl] = useState(missionDay.myMapsUrl ?? '');
  const [applicationTheme, setApplicationTheme] = useState(missionDay.applicationTheme);
  const [logoUrl, setLogoUrl] = useState(missionDay.logoUrl ?? '');
  const [team, setTeam] = useState<Team>(missionDay.team);
  const [letter, setLetter] = useState<LetterSections>(missionDay.letter);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();

  /**
   * Saves every section of the form.
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
        await updateMissionDay(missionDay.slug, {
          city,
          year,
          date: date === '' ? null : date,
          format,
          status,
          myMapsUrl: myMapsUrl === '' ? null : myMapsUrl,
          applicationTheme,
          logoUrl: logoUrl === '' ? null : logoUrl,
          team,
          letter,
        }),
      );
      setSaved(true);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  /** Deletes the Mission Day and returns to the list. */
  const remove = async () => {
    setError(undefined);
    try {
      await deleteMissionDay(missionDay.slug);
      navigate('/admin');
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <div class="stack">
      <form class="stack" onSubmit={save}>
        <section class="card">
          <h2>{t('settings.general')}</h2>
          <div class="grid-2">
            <Field label={t('home.city')}>
              <input required value={city} onInput={(e) => setCity(e.currentTarget.value)} />
            </Field>
            <Field label={t('home.year')}>
              <input
                required
                type="number"
                value={year}
                onInput={(e) => setYear(Number(e.currentTarget.value))}
              />
            </Field>
            <Field label={t('settings.date')}>
              <input type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} />
            </Field>
            <Field label={t('home.format')}>
              <select
                value={format}
                onChange={(e) => setFormat(e.currentTarget.value as MissionFormat)}
              >
                {FORMATS.map((option) => (
                  <option key={option} value={option}>
                    {t(`format.${option}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('settings.status')}>
              <select
                value={status}
                onChange={(e) => setStatus(e.currentTarget.value as MissionDayStatus)}
              >
                {STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {t(`status.${option}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('settings.myMapsUrl')}>
              <input
                type="url"
                value={myMapsUrl}
                onInput={(e) => setMyMapsUrl(e.currentTarget.value)}
              />
            </Field>
            <Field label={t('settings.applicationTheme')} help={t('settings.applicationThemeHelp')}>
              <input
                value={applicationTheme}
                onInput={(e) => setApplicationTheme(e.currentTarget.value)}
              />
            </Field>
            <Field label={t('settings.logoUrl')} help={t('settings.logoUrlHelp')}>
              <input
                type="url"
                value={logoUrl}
                onInput={(e) => setLogoUrl(e.currentTarget.value)}
              />
            </Field>
          </div>
        </section>

        <section class="card">
          <h2>{t('settings.team')}</h2>
          <h3>{t('settings.enlPoc')}</h3>
          <ContactInputs value={team.enlPoc} onChange={(enlPoc) => setTeam({ ...team, enlPoc })} />
          <h3>{t('settings.resPoc')}</h3>
          <ContactInputs value={team.resPoc} onChange={(resPoc) => setTeam({ ...team, resPoc })} />
          <h3>{t('settings.others')}</h3>
          {team.others.map((other, index) => (
            <div key={index} class="row-end">
              <ContactInputs
                value={other}
                onChange={(value) =>
                  setTeam({
                    ...team,
                    others: team.others.map((item, at) => (at === index ? value : item)),
                  })
                }
              />
              <button
                type="button"
                class="button"
                onClick={() =>
                  setTeam({ ...team, others: team.others.filter((_, at) => at !== index) })
                }
              >
                {t('common.remove')}
              </button>
            </div>
          ))}
          <button
            type="button"
            class="button"
            onClick={() =>
              setTeam({ ...team, others: [...team.others, { codename: '', contact: '' }] })
            }
          >
            {t('settings.addOrganiser')}
          </button>
        </section>

        <section class="card">
          <h2>{t('settings.letter')}</h2>
          <p class="muted">{t('settings.letterHelp')}</p>
          <LetterEditor value={letter} onChange={setLetter} />
        </section>

        <ErrorMessage error={error} />
        <div class="actions">
          <button class="button primary" disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
          {saved && <span class="muted">{t('common.saved')}</span>}
        </div>
      </form>

      <section class="card">
        <h2>{t('settings.images')}</h2>
        <FileUpload
          label={t('settings.defaultOverlay')}
          help={t('settings.defaultOverlayHelp')}
          accept="image/png"
          onUpload={async (file) => onChange(await uploadDefaultOverlay(missionDay.slug, file))}
        >
          {defaultOverlayUrl(missionDay) !== null && (
            <img
              class="file-preview overlay"
              src={defaultOverlayUrl(missionDay)!}
              alt={t('settings.defaultOverlay')}
            />
          )}
        </FileUpload>
        <FileUpload
          label={t('settings.mapScreenshot')}
          help={t('settings.mapScreenshotHelp')}
          accept="image/png,image/jpeg,image/webp"
          onUpload={async (file) => onChange(await uploadMapScreenshot(missionDay.slug, file))}
        >
          {mapScreenshotUrl(missionDay) !== null && (
            <img
              class="file-preview wide"
              src={mapScreenshotUrl(missionDay)!}
              alt={t('settings.mapScreenshot')}
            />
          )}
        </FileUpload>
      </section>

      {missionDay.role === 'owner' && (
        <section class="card">
          <h2>{t('settings.danger')}</h2>
          <p class="muted">{t('settings.dangerHelp')}</p>
          <ConfirmButton onConfirm={remove} />
        </section>
      )}
    </div>
  );
}
