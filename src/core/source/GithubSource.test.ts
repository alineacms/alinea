import {suite} from '@alinea/suite'
import {diff} from '../source/Source.js'
import {FSSource} from './FSSource.js'
import {GithubSource, normalizeGithubSourceOptions} from './GithubSource.js'

const test = suite(import.meta)

test('normalizes repository directories', () => {
  const options = normalizeGithubSourceOptions({
    owner: 'owner',
    repo: 'repo',
    branch: 'main',
    authToken: 'token',
    rootDir: '/',
    contentDir: '\\content\\pages\\'
  })

  test.is(options.rootDir, '')
  test.is(options.contentDir, 'content/pages')
})

test('sync', async () => {
  if (!process.env.GITHUB_AUTH_TOKEN) return
  const dir = 'test/fixtures/demo'
  const fsSource = new FSSource(dir)
  const ghSource = new GithubSource({
    owner: 'alineacms',
    repo: 'alinea',
    branch: 'main',
    authToken: process.env.GITHUB_AUTH_TOKEN!,
    rootDir: 'apps/web',
    contentDir: 'content/demo'
  })
  const batch = await diff(fsSource, ghSource)
  test.is(batch.changes.length, 0)
})
