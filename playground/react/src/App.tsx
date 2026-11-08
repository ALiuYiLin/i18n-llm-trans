import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './components/LanguageSwitcher'
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  initialLocaleSource,
  normalizeLocale,
} from './i18n'

const now = new Date()

const features = [
  { title: 'features.localeFiles.title', description: 'features.localeFiles.description' },
  { title: 'features.detection.title', description: 'features.detection.description' },
  { title: 'features.switcher.title', description: 'features.switcher.description' },
  { title: 'features.persistence.title', description: 'features.persistence.description' },
] as const

export default function App() {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.resolvedLanguage ?? i18n.language)

  const dateTime = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' }).format(now),
    [locale],
  )
  const number = useMemo(() => new Intl.NumberFormat(locale).format(1234567.89), [locale])

  return (
    <div className="page">
      <header className="page__header">
        <div className="brand">
          <span className="brand__badge">{t('app.framework')}</span>
          <div className="brand__text">
            <h1>{t('app.title')}</h1>
            <p>{t('app.stack')}</p>
          </div>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="page__main">
        <section className="hero">
          <p className="hero__eyebrow">{t('app.tagline')}</p>
          <h2>{t('hero.greeting', { name: t('hero.name') })}</h2>
          <p className="hero__description">{t('hero.description', { framework: t('app.framework') })}</p>
          <ul className="pills">
            <li>
              {t('status.currentLocale')}: <code>{locale}</code>
            </li>
            <li>
              {t('status.fallbackLocale')}: <code>{DEFAULT_LOCALE}</code>
            </li>
            <li>
              {t('status.detectionSource')}: {t(`sources.${initialLocaleSource}`)}
            </li>
          </ul>
        </section>

        <section className="section">
          <h3>{t('features.title')}</h3>
          <ul className="features">
            {features.map((feature) => (
              <li key={feature.title} className="card">
                <h4>{t(feature.title)}</h4>
                <p>{t(feature.description)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="section">
          <h3>{t('formats.title')}</h3>
          <dl className="formats">
            <div className="formats__item">
              <dt>{t('formats.dateTime')}</dt>
              <dd>{dateTime}</dd>
            </div>
            <div className="formats__item">
              <dt>{t('formats.number')}</dt>
              <dd>{number}</dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className="page__footer">
        <p>{t('footer.note', { key: LOCALE_STORAGE_KEY })}</p>
        <p>{t('footer.supported', { locales: SUPPORTED_LOCALES.join(' / ') })}</p>
      </footer>
    </div>
  )
}
