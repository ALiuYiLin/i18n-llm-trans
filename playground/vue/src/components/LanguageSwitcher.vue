<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { LOCALE_LABELS, SUPPORTED_LOCALES, normalizeLocale, setLocale } from '../i18n'

const { t, locale } = useI18n()

function handleChange(event: Event): void {
  setLocale(normalizeLocale((event.target as HTMLSelectElement).value))
}
</script>

<template>
  <label class="language-switcher">
    <span class="language-switcher__label">{{ t('languageSwitcher.label') }}</span>
    <select class="language-switcher__select" :value="locale" @change="handleChange">
      <option v-for="value in SUPPORTED_LOCALES" :key="value" :value="value">
        {{ LOCALE_LABELS[value] }}
      </option>
    </select>
  </label>
</template>
