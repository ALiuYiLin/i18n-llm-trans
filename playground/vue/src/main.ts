import { createApp, watch } from 'vue'
import App from './App.vue'
import { applyDocumentMetadata, i18n } from './i18n'
import './style.css'

applyDocumentMetadata()

// Keep the document metadata in sync even if the locale changes outside
// `setLocale` (for example from a plugin or devtools).
watch(
  () => i18n.global.locale.value,
  () => applyDocumentMetadata(),
)

createApp(App).use(i18n).mount('#app')
