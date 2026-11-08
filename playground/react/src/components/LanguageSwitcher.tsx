import { LOCALE_LABELS, SUPPORTED_LOCALES, normalizeLocale, setLocale, useI18n } from '../i18n'

export default function LanguageSwitcher() {
  const { t, locale } = useI18n()

  return (
    <label className="language-switcher">
      <span className="language-switcher__label">{t('语言')}</span>
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
