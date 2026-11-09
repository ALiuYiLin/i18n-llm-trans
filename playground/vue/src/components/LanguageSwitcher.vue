<script setup lang="ts">
import { LOCALE_LABELS, SUPPORTED_LOCALES, normalizeLocale, setLocale, useI18n } from '../i18n'

const { t, locale } = useI18n()

function handleChange(event: Event): void {
  setLocale(normalizeLocale((event.target as HTMLSelectElement).value))
}
</script>

<template>
  <label class="language-switcher">
    <span class="language-switcher__label">{{ t('语言') }}</span>
    <select class="language-switcher__select" :value="locale" @change="handleChange">
      <option v-for="value in SUPPORTED_LOCALES" :key="value" :value="value">
        {{ LOCALE_LABELS[value] }}
      </option>
    </select>
  </label>
</template>
