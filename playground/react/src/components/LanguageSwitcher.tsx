import { useTranslation } from 'react-i18next'
import { LOCALE_LABELS, SUPPORTED_LOCALES, normalizeLocale, setLocale } from '../i18n'

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.resolvedLanguage ?? i18n.language)

  return (
    <label className="language-switcher">
      <span className="language-switcher__label">{t('languageSwitcher.label')}</span>
      <select
        className="language-switcher__select"
        value={locale}
        onChange={(event) => setLocale(normalizeLocale(event.target.value))}
      >
        {SUPPORTED_LOCALES.map((value) => (
          <option key={value} value={value}>
            {LOCALE_LABELS[value]}
          </option>
        ))}
      </select>
    </label>
  )
}
