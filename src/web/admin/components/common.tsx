/**
 * Small building blocks shared by the admin screens.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useI18n } from '../../i18n';
import type { ValidationIssue } from '../../../shared/rules';
import { fullMissionName } from '../../../shared/rules';
import type { Mission, MissionDay } from '../../../shared/types';
import { ApiError } from '../api';

/**
 * Turns any failure into a sentence for the organiser.
 *
 * @param error - The failure.
 * @param t - Translation function.
 * @returns The message to display.
 */
export function errorText(error: unknown, t: (key: string) => string): string {
  if (error instanceof ApiError) {
    const key = `error.${error.code}`;
    const message = t(key);
    return message === key ? t('error.generic') : message;
  }
  return t('error.generic');
}

/**
 * Shows a failure, or nothing when there is none.
 *
 * @param props - The failure.
 * @returns The alert element.
 */
export function ErrorMessage({ error }: { error: unknown }) {
  const { tDynamic } = useI18n();
  if (error === undefined || error === null) {
    return null;
  }
  return (
    <p class="alert" role="alert">
      {errorText(error, tDynamic)}
    </p>
  );
}

/**
 * A labelled form control, with optional help text.
 *
 * @param props - Label, help and the control.
 * @returns The field element.
 */
export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ComponentChildren;
}) {
  return (
    <label class="field">
      <span class="field-label">{label}</span>
      {children}
      {help !== undefined && <span class="field-help">{help}</span>}
    </label>
  );
}

/**
 * Button for destructive actions: the first click arms it and the second
 * one acts, which avoids a blocking browser dialog. It disarms by itself
 * so that it cannot be left waiting for an accidental click.
 *
 * @param props - Action to perform and whether it is disabled.
 * @returns The button element.
 */
export function ConfirmButton({
  onConfirm,
  disabled,
}: {
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) {
      return undefined;
    }
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      class="button danger"
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? t('common.confirmDelete') : t('common.delete')}
    </button>
  );
}

/**
 * Lists validation problems, with errors first.
 *
 * @param props - Issues, plus the data used to name each mission.
 * @returns The list element.
 */
export function IssueList({
  issues,
  missions,
  missionDay,
}: {
  issues: readonly ValidationIssue[];
  missions?: readonly Mission[];
  missionDay: MissionDay;
}) {
  const { t, tDynamic } = useI18n();
  const sorted = [...issues].sort((a, b) => a.severity.localeCompare(b.severity));

  return (
    <ul class="issues">
      {sorted.map((issue, index) => {
        const mission = missions?.find((item) => item.id === issue.missionId);
        return (
          <li key={index} class={`issue ${issue.severity}`}>
            <span class="issue-severity">{t(`severity.${issue.severity}`)}</span>
            <span>
              {mission !== undefined && (
                <strong>{fullMissionName(missionDay, mission.landmark)}: </strong>
              )}
              {tDynamic(`issue.${issue.code}`, issue.params)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
