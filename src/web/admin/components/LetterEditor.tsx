/**
 * Editor of the shared letter sections, one language at a time. Used for
 * a Mission Day's own letter and for the defaults of the instance.
 */
import { useState } from 'preact/hooks';
import { LANGUAGES, type Language } from '../../../shared/rules';
import type { LetterSections } from '../../../shared/types';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/messages';
import { Field } from './common';

const LETTER_SECTIONS: { key: keyof LetterSections; label: MessageKey }[] = [
  { key: 'aboutUs', label: 'settings.aboutUs' },
  { key: 'whatIsIngress', label: 'settings.whatIsIngress' },
  { key: 'whatIsMissionDay', label: 'settings.whatIsMissionDay' },
  { key: 'whyThisCity', label: 'settings.whyThisCity' },
  { key: 'closing', label: 'settings.closing' },
];

/**
 * Language selector followed by one text area per section.
 *
 * @param props - Current texts and change handler.
 * @returns The editor elements.
 */
export function LetterEditor({
  value,
  onChange,
}: {
  value: LetterSections;
  onChange: (value: LetterSections) => void;
}) {
  const { t, language } = useI18n();
  const [letterLanguage, setLetterLanguage] = useState<Language>(language);

  return (
    <>
      <Field label={t('settings.letterLanguage')}>
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
      {LETTER_SECTIONS.map(({ key, label }) => (
        <Field key={key} label={t(label)}>
          <textarea
            rows={4}
            value={value[key][letterLanguage] ?? ''}
            onInput={(e) =>
              onChange({
                ...value,
                [key]: { ...value[key], [letterLanguage]: e.currentTarget.value },
              })
            }
          />
        </Field>
      ))}
    </>
  );
}
