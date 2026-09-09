import {expect, test} from 'bun:test'
import type {Config} from '#/core/Config.js'
import {checkpointFormat} from '#/database/runtime/Checkpoint.js'
import {releaseIdentity} from './ReleaseIdentity.js'

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
