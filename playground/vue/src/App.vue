<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  initialLocaleSource,
  normalizeLocale,
} from './i18n'

const { t, locale } = useI18n()

const now = new Date()
const currentLocale = computed(() => normalizeLocale(locale.value))
const dateFormatter = computed(
  () => new Intl.DateTimeFormat(currentLocale.value, { dateStyle: 'full', timeStyle: 'short' }),
)
const numberFormatter = computed(() => new Intl.NumberFormat(currentLocale.value))
const detectionKey = `sources.${initialLocaleSource}`

const features = [
  { title: 'features.localeFiles.title', description: 'features.localeFiles.description' },
  { title: 'features.detection.title', description: 'features.detection.description' },
  { title: 'features.switcher.title', description: 'features.switcher.description' },
  { title: 'features.persistence.title', description: 'features.persistence.description' },
] as const
</script>

<template>
  <div class="page">
    <header class="page__header">
      <div class="brand">
        <span class="brand__badge">{{ t('app.framework') }}</span>
        <div class="brand__text">
          <h1>{{ t('app.title') }}</h1>
          <p>{{ t('app.stack') }}</p>
        </div>
      </div>
      <LanguageSwitcher />
    </header>

    <main class="page__main">
      <section class="hero">
        <p class="hero__eyebrow">{{ t('app.tagline') }}</p>
        <h2>{{ t('hero.greeting', { name: t('hero.name') }) }}</h2>
        <p class="hero__description">
          {{ t('hero.description', { framework: t('app.framework') }) }}
        </p>
        <ul class="pills">
          <li>{{ t('status.currentLocale') }}: <code>{{ currentLocale }}</code></li>
          <li>{{ t('status.fallbackLocale') }}: <code>{{ DEFAULT_LOCALE }}</code></li>
          <li>{{ t('status.detectionSource') }}: {{ t(detectionKey) }}</li>
        </ul>
      </section>

      <section class="section">
        <h3>{{ t('features.title') }}</h3>
        <ul class="features">
          <li v-for="feature in features" :key="feature.title" class="card">
            <h4>{{ t(feature.title) }}</h4>
            <p>{{ t(feature.description) }}</p>
          </li>
        </ul>
      </section>

      <section class="section">
        <h3>{{ t('formats.title') }}</h3>
        <dl class="formats">
          <div class="formats__item">
            <dt>{{ t('formats.dateTime') }}</dt>
            <dd>{{ dateFormatter.format(now) }}</dd>
          </div>
          <div class="formats__item">
            <dt>{{ t('formats.number') }}</dt>
            <dd>{{ numberFormatter.format(1234567.89) }}</dd>
          </div>
        </dl>
      </section>
    </main>

    <footer class="page__footer">
      <p>{{ t('footer.note', { key: LOCALE_STORAGE_KEY }) }}</p>
      <p>{{ t('footer.supported', { locales: SUPPORTED_LOCALES.join(' / ') }) }}</p>
    </footer>
  </div>
</template>
