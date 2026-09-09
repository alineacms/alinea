import {expect, test} from 'bun:test'
import {mkdir, mkdtemp, rm, symlink, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {databaseTracing} from './database-tracing.js'

const checkpoint =
  'checkpoints/00000000-0000-4000-8000-000000000000/release.sqlite'
const loader = `export const databasePath = fileURLToPath(new URL('./${checkpoint}', import.meta.url))`

test('merges exact private artifacts without changing route mappings or distDir', async () => {
  const project = await mkdtemp(join(tmpdir(), 'alinea-traces-'))
  try {
    const generated = join(project, 'node_modules/@alinea/generated')
    await mkdir(generated, {recursive: true})
    await writeFile(
      join(generated, 'package.json'),
      JSON.stringify({
        name: '@alinea/generated',
        exports: {'./package.json': './package.json'}
      })
    )
    const config = {
      distDir: 'custom-next',
      outputFileTracingIncludes: {
        '/api/content': ['private/existing.json'],
        '/other': ['other.bin']
      }
    }
    await writeFile(join(generated, 'database.js'), loader)
    const result = databaseTracing(config, project, ['/api/content'])
    expect(result).toEqual({
      '/api/content': [
        'private/existing.json',
        'node_modules/[@]alinea/generated/database.js',
        `node_modules/[@]alinea/generated/${checkpoint}`
      ],
      '/other': ['other.bin']
    })
    expect(config.outputFileTracingIncludes['/api/content']).toEqual([
      'private/existing.json'
    ])
    expect(
      databaseTracing({...config, outputFileTracingIncludes: result}, project, [
        '/api/content'
      ])
    ).toEqual(result)
    expect(databaseTracing(config, project, [])).toBe(
      config.outputFileTracingIncludes
    )
    await writeFile(
      join(generated, 'database.js'),
      "export const databasePath = fileURLToPath(new URL('../outside.sqlite', import.meta.url))"
    )
    expect(() => databaseTracing(config, project)).toThrow('Invalid generated')
    await rm(join(generated, 'database.js'))
    expect(databaseTracing(config, project)).toBe(
      config.outputFileTracingIncludes
    )
  } finally {
    await rm(project, {recursive: true, force: true})
  }
})

test('resolves hoisted symlinks and rejects an explicitly excluding tracing root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'alinea-monorepo-'))
  try {
    const project = join(root, 'apps/web')
    const generated = join(root, 'packages/generated')
    await mkdir(project, {recursive: true})
    await mkdir(generated, {recursive: true})
    await mkdir(join(root, 'node_modules/@alinea'), {recursive: true})
    await writeFile(
      join(generated, 'package.json'),
      JSON.stringify({
        name: '@alinea/generated',
        exports: {'./database.js': './database.js'}
      })
    )
    await symlink(
      generated,
      join(root, 'node_modules/@alinea/generated'),
      'dir'
    )
    await writeFile(join(generated, 'database.js'), loader)
    expect(databaseTracing({outputFileTracingRoot: root}, project)).toEqual({
      '/*': [
        '../../packages/generated/database.js',
        `../../packages/generated/${checkpoint}`
      ]
    })
    expect(() =>
      databaseTracing({outputFileTracingRoot: project}, project)
    ).toThrow('outside outputFileTracingRoot')
  } finally {
    await rm(root, {recursive: true, force: true})
  }
})
