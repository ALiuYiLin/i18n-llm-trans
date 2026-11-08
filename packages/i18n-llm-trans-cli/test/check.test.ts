import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { runCheck } from '../src/check'
import type { CheckScope } from '../src/types'

const projects: string[] = []

async function createProject(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'i18n-cli-'))
  projects.push(dir)
  for (const [path, content] of Object.entries(files)) {
    const target = join(dir, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content, 'utf8')
  }
  return dir
}

function projectFiles(options: {
  source: Record<string, string>
  target: Record<string, string>
  code: string
}): Record<string, string> {
  return {
    'i18n.config.json': JSON.stringify(
      {
        include: ['src/**/*.{ts,tsx}'],
        exclude: [],
        localesDir: 'src/locales',
        sourceLocale: 'zh-CN',
        targetLocales: ['en-US'],
        callers: ['t', 'translate'],
        transId: { option: '__TRANS_ID', separator: '__TRANS_ID_' },
      },
      null,
      2,
    ),
    'src/locales/zh-CN.json': JSON.stringify(options.source, null, 2),
    'src/locales/en-US.json': JSON.stringify(options.target, null, 2),
    'src/App.tsx': options.code,
  }
}

function readMessages(dir: string, locale: string): Promise<Record<string, string>> {
  return readFile(join(dir, 'src', 'locales', `${locale}.json`), 'utf8').then(
    (raw) => JSON.parse(raw) as Record<string, string>,
  )
}

function run(dir: string, overrides: Partial<{ add: boolean; remove: boolean; scope: CheckScope }> = {}) {
  return runCheck({ cwd: dir, scope: 'all', add: false, remove: false, quiet: true, ...overrides })
}

afterEach(async () => {
  await Promise.all(projects.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('runCheck', () => {
  it('reports missing source keys and missing target translations', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 你好: '你好' },
        target: { 你好: 'Hello' },
        code: `export const a = t('你好'); export const b = t('删除', 'remove')`,
      }),
    )

    const result = await run(dir)

    expect(result.exitCode).toBe(1)
    expect(result.source?.missing.map((item) => item.key)).toEqual(['删除'])
    expect(result.targets[0]?.missing).toEqual(['删除__TRANS_ID_remove'])
  })

  it('--add appends missing keys to the source locale with identity values', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 你好: '你好' },
        target: { 你好: 'Hello' },
        code: `export const b = t('删除')`,
      }),
    )

    const result = await run(dir, { add: true })

    expect(result.actions[0]?.added).toEqual(['删除'])
    expect(await readMessages(dir, 'zh-CN')).toEqual({ 你好: '你好', 删除: '删除' })
    // The target locale can only be fixed by translating, so the check still fails.
    expect(result.exitCode).toBe(1)
  })

  it('--remove drops unused source keys and extra target keys', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 你好: '你好', 旧文案: '旧文案' },
        target: { 你好: 'Hello', 过期译文: 'Old' },
        code: `export const a = t('你好')`,
      }),
    )

    const result = await run(dir, { remove: true })

    expect(result.exitCode).toBe(0)
    expect(await readMessages(dir, 'zh-CN')).toEqual({ 你好: '你好' })
    expect(await readMessages(dir, 'en-US')).toEqual({ 你好: 'Hello' })
  })

  it('keeps keys that appear as literals even when the t() call is dynamic', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 动态键: '动态键' },
        target: { 动态键: 'Dynamic' },
        code: `const keys = ['动态键']; export const a = t(keys[0])`,
      }),
    )

    const result = await run(dir)

    expect(result.source?.unused).toEqual([])
    expect(result.dynamicUsages).toHaveLength(1)
    expect(result.exitCode).toBe(0)
  })

  it('--source only checks the source locale', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 你好: '你好' },
        target: {},
        code: `export const a = t('你好'); export const b = t('删除')`,
      }),
    )

    const result = await run(dir, { scope: 'source' })

    expect(result.targets).toEqual([])
    expect(result.source?.missing.map((item) => item.key)).toEqual(['删除'])
    expect(result.exitCode).toBe(1)
  })

  it('rejects --add together with --target', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 你好: '你好' },
        target: { 你好: 'Hello' },
        code: `export const a = t('你好')`,
      }),
    )

    await expect(run(dir, { scope: 'target', add: true })).rejects.toThrow(/--add/)
  })
})
