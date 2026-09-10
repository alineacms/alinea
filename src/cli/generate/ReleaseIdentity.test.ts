import {expect, test} from 'bun:test'
import type {Config} from '#/core/Config.js'
import {checkpointFormat} from '#/database/runtime/Checkpoint.js'
import {dashboardBinding, releaseIdentity} from './ReleaseIdentity.js'
import {transform} from 'esbuild'

const config: Config = {
  schema: {},
  workspaces: {},
  baseUrl: {production: 'example.test', development: 'http://localhost:3000'}
}

test('project identity stays stable across deployment releases and preview branches', () => {
  const main = releaseIdentity(config, 'config', '/repo/alinea.config.ts', {})
  const preview = releaseIdentity(
    config,
    'config',
    '/different-build/alinea.config.ts',
    {VERCEL_GIT_COMMIT_REF: 'feature/example'}
  )
  expect(main.project).toBe('https://example.test')
  expect(preview.project).toBe(main.project)
  expect(preview.namespace).toBe('feature/example')
  expect(preview.releaseId).not.toBe(main.releaseId)
  expect(main.schemaId).toBe(`alinea-sqlite-${checkpointFormat}`)
  expect(main.epoch).toBe('1')
  expect(
    releaseIdentity(config, 'config', '/repo/config.ts', {
      CF_PAGES_BRANCH: 'cloudflare-preview'
    }).namespace
  ).toBe('cloudflare-preview')
})

test('explicit identities override hosting metadata and support source epoch replacement', () => {
  const identity = releaseIdentity(
    {
      ...config,
      replica: {
        project: 'stable-project',
        namespace: 'content',
        epoch: 'reset-2'
      }
    },
    'new-config',
    '/repo/config.ts',
    {VERCEL_GIT_COMMIT_REF: 'code-branch'}
  )
  expect(identity).toMatchObject({
    project: 'stable-project',
    namespace: 'content',
    epoch: 'reset-2',
    configId: 'new-config'
  })
  expect(() =>
    releaseIdentity(
      {...config, replica: {project: ''}},
      'config',
      '/repo/config.ts',
      {}
    )
  ).toThrow('non-empty')
})

test('local configurations without production URLs use distinct config-file identities', () => {
  const config: Config = {schema: {}, workspaces: {}}
  expect(releaseIdentity(config, 'config', '/repo/a.ts', {}).project).toBe(
    'local:/repo/a.ts'
  )
  expect(releaseIdentity(config, 'config', '/repo/b.ts', {}).project).toBe(
    'local:/repo/b.ts'
  )
})

test('generated dashboard scope matches checkpoints without pinning deployment IDs or user identity', async () => {
  for (const env of [
    {},
    {VERCEL_GIT_COMMIT_REF: 'feature/日本語"quoted'},
    {CF_PAGES_BRANCH: 'cf-preview'}
  ]) {
    const binding = dashboardBinding(config, '/repo/config.ts', env)
    const checkpoint = releaseIdentity(
      config,
      'config-id',
      '/repo/config.ts',
      env
    )
    expect(binding).toEqual({
      project: checkpoint.project,
      namespace: checkpoint.namespace,
      epoch: checkpoint.epoch
    })
    const result = await transform(
      'export default process.env.ALINEA_REPLICA_BINDING',
      {
        format: 'esm',
        define: {'process.env.ALINEA_REPLICA_BINDING': JSON.stringify(binding)}
      }
    )
    const loaded = await import(
      `data:text/javascript;base64,${Buffer.from(result.code).toString('base64')}`
    )
    expect(loaded.default).toEqual(binding)
    expect(Object.keys(loaded.default).sort()).toEqual([
      'epoch',
      'namespace',
      'project'
    ])
  }
  expect(
    dashboardBinding(
      {...config, replica: {namespace: 'explicit', epoch: 'reset'}},
      '/repo/config.ts',
      {VERCEL_GIT_COMMIT_REF: 'ignored'}
    )
  ).toEqual({
    project: 'https://example.test',
    namespace: 'explicit',
    epoch: 'reset'
  })
})
