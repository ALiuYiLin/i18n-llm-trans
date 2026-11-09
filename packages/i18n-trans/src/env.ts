import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { LlmEnv } from './types'

interface ProcessWithEnvFile {
  loadEnvFile?: (path: string) => void
}

export function loadLlmEnv(cwd: string, envFile?: string): LlmEnv {
  const file = envFile ?? join(cwd, '.env')

  if (existsSync(file)) {
    const loader = (process as unknown as ProcessWithEnvFile).loadEnvFile
    if (typeof loader === 'function') {
      // Existing process.env values win over the .env file.
      loader(file)
    }
  }

  const baseUrl = process.env.I18N_LLM_BASE_URL?.trim()
  const apiKey = process.env.I18N_LLM_API_KEY?.trim()
  const model = process.env.I18N_LLM_MODEL?.trim()

  const missing = [
    ['I18N_LLM_BASE_URL', baseUrl],
    ['I18N_LLM_API_KEY', apiKey],
    ['I18N_LLM_MODEL', model],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missing.length > 0) {
    throw new Error(
      `Missing LLM configuration: ${missing.join(', ')}. Add them to ${file} or your environment.`,
    )
  }

  return {
    baseUrl: (baseUrl as string).replace(/\/+$/, ''),
    apiKey: apiKey as string,
    model: model as string,
    timeoutMs: toNumber(process.env.I18N_LLM_TIMEOUT_MS, 60_000),
    maxRetries: toNumber(process.env.I18N_LLM_MAX_RETRIES, 1),
    jsonMode: (process.env.I18N_LLM_JSON_MODE ?? 'true').toLowerCase() !== 'false',
  }
}

function toNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}
