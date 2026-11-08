import { useMemo } from 'react'
import { FRAMEWORK_LABEL, STACK_LABEL } from './app-config'
import LanguageSwitcher from './components/LanguageSwitcher'
import {
  FALLBACK_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  initialLocaleSource,
  useI18n,
} from './i18n'

const now = new Date()

const features = [
  { title: '语言资源文件', description: '翻译存放在 src/locales/*.json 中，键名就是中文原文。' },
  { title: '自动识别语言', description: '首次访问时跟随浏览器语言，无法识别时使用中文源文案。' },
  { title: '即时切换', description: '切换语言会同时更新界面、<html lang> 属性和页面标题。' },
  { title: '记住选择', description: '你的选择会写入 localStorage，下次访问时自动恢复。' },
] as const

const detectionSourceText = {
  storage: '本地保存的偏好',
  browser: '浏览器语言',
  default: '默认回退',
} as const

export default function App() {
  const { t, locale } = useI18n()

  const dateTime = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' }).format(now),
    [locale],
  )
  const number = useMemo(() => new Intl.NumberFormat(locale).format(1234567.89), [locale])

  return (
    <div className="page">
      <header className="page__header">
        <div className="brand">
          <span className="brand__badge">{FRAMEWORK_LABEL}</span>
          <div className="brand__text">
            <h1>{t('i18n 演练场')}</h1>
            <p>{STACK_LABEL}</p>
          </div>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="page__main">
        <section className="hero">
          <p className="hero__eyebrow">{t('同一套界面，运行时切换语言。')}</p>
          <h2>{t('你好，{name}！', { name: t('朋友') })}</h2>
          <p className="hero__description">
            {t('本页面使用 {framework} 构建。在下方切换语言，所有文案会立即更新，无需刷新页面。', {
              framework: FRAMEWORK_LABEL,
            })}
          </p>
          <ul className="pills">
            <li>
              {t('当前语言')}: <code>{locale}</code>
            </li>
            <li>
              {t('回退语言')}: <code>{FALLBACK_LOCALE}</code>
            </li>
            <li>
              {t('初始识别来源')}: {t(detectionSourceText[initialLocaleSource])}
            </li>
          </ul>
        </section>

        <section className="section">
          <h3>{t('本演练场包含')}</h3>
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
          <h3>{t('本地化格式')}</h3>
          <dl className="formats">
            <div className="formats__item">
              <dt>{t('日期与时间')}</dt>
              <dd>{dateTime}</dd>
            </div>
            <div className="formats__item">
              <dt>{t('数字')}</dt>
              <dd>{number}</dd>
            </div>
          </dl>
        </section>

        <section className="section">
          <h3>{t('一词多译')}</h3>
          <p className="section__hint">
            {t('同一个中文词在不同场景下可以对应不同的英文，通过 __TRANS_ID 区分。')}
          </p>
          <div className="demo-actions">
            <div className="demo-item">
              <button type="button" className="demo-button">
                {t('删除', { __TRANS_ID: 'delete' })}
              </button>
              <p className="demo-caption">
                {t('永久销毁且不可恢复：删除用户、数据库记录或备份。')}
              </p>
            </div>
            <div className="demo-item">
              <button type="button" className="demo-button">
                {t('删除', { __TRANS_ID: 'remove' })}
              </button>
              <p className="demo-caption">
                {t('仅解除关联，对象仍然存在：把用户移出角色组、从仪表盘移除卡片。')}
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="page__footer">
        <p>{t('语言偏好存储键：{key}', { key: LOCALE_STORAGE_KEY })}</p>
        <p>{t('已支持语言：{locales}', { locales: SUPPORTED_LOCALES.join(' / ') })}</p>
      </footer>
    </div>
  )
}
