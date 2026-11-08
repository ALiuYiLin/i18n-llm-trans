import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyDocumentMetadata, i18nReady } from './i18n'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root was not found in index.html')
}

void i18nReady.then(() => {
  applyDocumentMetadata()
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
