import {suite} from '@alinea/suite'
import {diff} from '../source/Source.js'
import {FSSource} from './FSSource.js'
import {GithubSource} from './GithubSource.js'

const test = suite(import.meta)

test('sync', async () => {
  if (!process.env.GITHUB_AUTH_TOKEN) return
  const dir = 'apps/web/content/demo'
  const fsSource = new FSSource(dir)
  const ghSource = new GithubSource({
    owner: 'alineacms',
    repo: 'alinea',
    branch: 'main',
    authToken: process.env.GITHUB_AUTH_TOKEN!,
    contentDir: 'apps/web/content/demo'
  })
  const batch = await diff(fsSource, ghSource)
  test.is(batch.changes.length, 0)
})
