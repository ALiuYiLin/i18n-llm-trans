import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { runTrans } from '../src/trans/translate'
import type { TransOptions, TranslationRequest, TranslationUnit } from '../src/types'

const projects: string[] = []

async function createProject(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'i18n-trans-'))
  projects.push(dir)
  for (const [path, content] of Object.entries(files)) {
    const target = join(dir, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content, 'utf8')
  }
  return dir
}

interface ProjectInput {
  source: Record<string, string>
  target: Record<string, string>
  code: string
  hints?: Record<string, string>
  translation?: Record<string, unknown>
}

function projectFiles(input: ProjectInput): Record<string, string> {
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
        translation: {
          placeholderMarker: '⟦TODO⟧',
          batchSize: 20,
          contextLines: 0,
          hints: input.hints ?? {},
          glossary: {},
          ignoreKeys: [],
          maxRetries: 0,
          jsonMode: true,
          ...input.translation,
        },
      },
      null,
      2,
    ),
    'src/locales/zh-CN.json': JSON.stringify(input.source, null, 2),
    'src/locales/en-US.json': JSON.stringify(input.target, null, 2),
    'src/App.tsx': input.code,
  }
}

function readMessages(dir: string, locale: string): Promise<Record<string, string>> {
  return readFile(join(dir, 'src', 'locales', `${locale}.json`), 'utf8').then(
    (raw) => JSON.parse(raw) as Record<string, string>,
  )
}

function options(cwd: string, extra: Partial<TransOptions> = {}): TransOptions {
  return { cwd, quiet: true, ...extra }
}

const fakeTranslator =
  (map: Record<string, string>, calls: TranslationRequest[] = []) =>
  async (request: TranslationRequest): Promise<Record<string, string>> => {
    calls.push(request)
    return Object.fromEntries(request.units.map((unit) => [unit.key, map[unit.key] ?? `[${unit.key}]`]))
  }

afterEach(async () => {
  await Promise.all(projects.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('runTrans', () => {
  it('translates missing keys and replaces marker / legacy placeholders', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 你好: '你好', 保存: '保存', 删除: '删除' },
        target: { 你好: 'Hello', 保存: '⟦TODO⟧ 保存', 删除: '删除' },
        code: `export const a = t('你好'); export const b = t('保存'); export const c = t('删除', 'remove')`,
      }),
    )

    const calls: TranslationRequest[] = []
    const result = await runTrans(
      options(dir),
      {
        translateBatch: fakeTranslator(
          { 保存: 'Save', 删除: 'Delete', 删除__TRANS_ID_remove: 'Remove' },
          calls,
        ),
      },
    )

    expect(result.translated).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.exitCode).toBe(0)
    expect(await readMessages(dir, 'en-US')).toMatchObject({
      你好: 'Hello',
      保存: '⟦REVIEW⟧ Save',
      删除: '⟦REVIEW⟧ Delete',
      删除__TRANS_ID_remove: '⟦REVIEW⟧ Remove',
    })
    expect(calls).toHaveLength(1)
  })

  it('creates a missing target locale file and translates into it', async () => {
    const files = projectFiles({
      source: { 你好: '你好' },
      target: {},
      code: `export const a = t('你好')`,
    })
    delete files['src/locales/en-US.json']
    const dir = await createProject(files)

    const result = await runTrans(options(dir), {
      translateBatch: fakeTranslator({ 你好: 'Hello' }),
    })

    expect(result.translated).toBe(1)
    expect(result.exitCode).toBe(0)
    expect(await readMessages(dir, 'en-US')).toEqual({ 你好: '⟦REVIEW⟧ Hello' })
  })

  it('passes auto context and manual hints to the batch translator', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 删除: '删除' },
        target: { 删除: 'Delete' },
        code: `// remove user from role group\nexport const remove = () => t('删除', 'remove')`,
        hints: { 删除__TRANS_ID_remove: '从角色组移出用户，对象仍然存在' },
      }),
    )

    const calls: TranslationRequest[] = []
    await runTrans(
      options(dir),
      { translateBatch: fakeTranslator({ 删除__TRANS_ID_remove: 'Remove' }, calls) },
    )

    const unit = calls[0]?.units[0] as TranslationUnit
    expect(unit.key).toBe('删除__TRANS_ID_remove')
    expect(unit.transId).toBe('remove')
    expect(unit.hint).toBe('从角色组移出用户，对象仍然存在')
    expect(unit.context).toContain("t('删除', 'remove')")
  })

  it('retries invalid responses and reports failures without writing bad data', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 你好: '你好' },
        target: {},
        code: `export const a = t('你好')`,
      }),
    )

    let attempts = 0
    const result = await runTrans(
      { ...options(dir), limit: 1 },
      {
        maxRetries: 1,
        translateBatch: async () => {
          attempts += 1
          return { 你好: '' }
        },
      },
    )

    expect(attempts).toBe(2)
    expect(result.translated).toBe(0)
    expect(result.failed).toBe(1)
    expect(result.exitCode).toBe(1)
    expect(await readMessages(dir, 'en-US')).toEqual({})
  })

  it('splits units into batches', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 你好: '你好', 保存: '保存', 删除: '删除' },
        target: {},
        code: `export const a = t('你好'); export const b = t('保存'); export const c = t('删除')`,
        translation: { batchSize: 2 },
      }),
    )

    const calls: TranslationRequest[] = []
    const result = await runTrans(options(dir), {
      translateBatch: fakeTranslator({ 你好: 'Hello', 保存: 'Save', 删除: 'Delete' }, calls),
    })

    expect(calls).toHaveLength(2)
    expect(calls[0]?.units).toHaveLength(2)
    expect(calls[1]?.units).toHaveLength(1)
    expect(result.translated).toBe(3)
    expect(result.exitCode).toBe(0)
  })

  it('dry run does not call the LLM or write files', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 你好: '你好' },
        target: {},
        code: `export const a = t('你好')`,
      }),
    )

    let called = false
    const result = await runTrans(options(dir, { dryRun: true }), {
      translateBatch: async () => {
        called = true
        return {}
      },
    })

    expect(called).toBe(false)
    expect(result.dryRun).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(await readMessages(dir, 'en-US')).toEqual({})
  })

  it('does nothing when everything is already translated', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 你好: '你好' },
        target: { 你好: 'Hello' },
        code: `export const a = t('你好')`,
      }),
    )

    let called = false
    const result = await runTrans(options(dir), {
      translateBatch: async () => {
        called = true
        return {}
      },
    })

    expect(called).toBe(false)
    expect(result.translated).toBe(0)
    expect(result.exitCode).toBe(0)
  })

  it('filters units by --keys', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 你好: '你好', 保存: '保存' },
        target: {},
        code: `export const a = t('你好'); export const b = t('保存')`,
      }),
    )

    const calls: TranslationRequest[] = []
    const result = await runTrans(options(dir, { keys: ['保存'] }), {
      translateBatch: fakeTranslator({ 保存: 'Save' }, calls),
    })

    expect(calls[0]?.units.map((unit) => unit.key)).toEqual(['保存'])
    expect(result.translated).toBe(1)
    expect(await readMessages(dir, 'en-US')).toEqual({ 保存: '⟦REVIEW⟧ Save' })
  })

  it('--ignore writes translations without the review marker', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 你好: '你好' },
        target: {},
        code: `export const a = t('你好')`,
      }),
    )

    const result = await runTrans(options(dir, { ignore: true }), {
      translateBatch: fakeTranslator({ 你好: 'Hello' }),
    })

    expect(result.translated).toBe(1)
    expect(await readMessages(dir, 'en-US')).toEqual({ 你好: 'Hello' })
  })

  it('does not re-translate marker-prefixed AI translations', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 你好: '你好' },
        target: { 你好: '⟦REVIEW⟧ Hello' },
        code: `export const a = t('你好')`,
      }),
    )

    let called = false
    const result = await runTrans(options(dir), {
      translateBatch: async () => {
        called = true
        return { 你好: 'Hello again' }
      },
    })

    expect(called).toBe(false)
    expect(result.translated).toBe(0)
    expect(result.exitCode).toBe(0)
    expect(await readMessages(dir, 'en-US')).toEqual({ 你好: '⟦REVIEW⟧ Hello' })
  })

  it('treats ⟦REVIEW⟧ + source text as a translation awaiting review, not a placeholder', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 你好: '你好' },
        target: { 你好: '⟦REVIEW⟧ 你好' },
        code: `export const a = t('你好')`,
      }),
    )

    let called = false
    const result = await runTrans(options(dir), {
      translateBatch: async () => {
        called = true
        return { 你好: 'Hello' }
      },
    })

    expect(called).toBe(false)
    expect(result.translated).toBe(0)
    expect(await readMessages(dir, 'en-US')).toEqual({ 你好: '⟦REVIEW⟧ 你好' })
  })

  it('translates strings with double-brace placeholders (i18next style)', async () => {
    const key = '你好，{{name}}！'
    const dir = await createProject(
      projectFiles({
        source: { [key]: key },
        target: {},
        code: `export const a = t('你好，{{name}}！', { name: 'friend' })`,
      }),
    )

    const result = await runTrans(options(dir), {
      translateBatch: fakeTranslator({ [key]: 'Hello, {{name}}!' }),
    })

    expect(result.translated).toBe(1)
    expect(await readMessages(dir, 'en-US')).toEqual({ [key]: '⟦REVIEW⟧ Hello, {{name}}!' })
  })

  it('rejects translations that change the placeholder brace style', async () => {
    const key = '你好，{{name}}！'
    const dir = await createProject(
      projectFiles({
        source: { [key]: key },
        target: {},
        code: `export const a = t('你好，{{name}}！', { name: 'friend' })`,
      }),
    )

    const result = await runTrans(options(dir), {
      translateBatch: fakeTranslator({ [key]: 'Hello, {name}!' }),
    })

    expect(result.failed).toBe(1)
    expect(result.exitCode).toBe(1)
    expect(await readMessages(dir, 'en-US')).toEqual({})
  })

  it('rejects identical placeholder and review markers', async () => {
    const dir = await createProject(
      projectFiles({
        source: { 你好: '你好' },
        target: {},
        code: `export const a = t('你好')`,
        translation: { placeholderMarker: '⟦X⟧', reviewMarker: '⟦X⟧' },
      }),
    )

    await expect(
      runTrans(options(dir), { translateBatch: async () => ({}) }),
    ).rejects.toThrow(/must be different/)
  })
})
