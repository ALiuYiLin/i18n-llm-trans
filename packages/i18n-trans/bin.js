#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const distFile = join(dirname(fileURLToPath(import.meta.url)), 'dist', 'bin.js')

if (!existsSync(distFile)) {
  console.error('[i18n-trans] dist/bin.js is missing. Build the CLI package first (pnpm build).')
  process.exit(1)
}

await import(pathToFileURL(distFile).href)
