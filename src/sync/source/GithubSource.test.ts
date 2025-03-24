import {suite} from '@alinea/suite'
import {FSSource} from './FSSource.ts'
import {GithubSource} from './GithubSource.ts'

const test = suite(import.meta)

test('sync', async () => {
  if (!process.env.GITHUB_AUTH_TOKEN) return
  const dir = 'test/demo'
  const fsSource = new FSSource(dir)
  const ghSource = new GithubSource({
    owner: 'alineacms',
    repo: 'alinea',
    branch: 'main',
    authToken: process.env.GITHUB_AUTH_TOKEN!,
    cwd: 'apps/web/content/demo'
  })
  const changes = await fsSource.diff(ghSource)
  test.is(changes.length, 0)
})
