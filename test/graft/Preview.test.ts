import {composeBackend} from '#/backend/api/CreateBackend.js'
import {createHandler} from '#/backend/Handler.js'
import {createCMS} from '#/core.js'
import type {AuthedContext} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import {getScope} from '#/core/Scope.js'
import {createRecord, recordJson} from '#/core/EntryRecord.js'
import {createFilePatch} from '#/core/source/FilePatch.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'
import {encodePreviewPayload} from '#/preview/PreviewPayload.js'
import {suite} from '@alinea/suite'

const test = suite(import.meta)

const Page = Config.document('Page', {fields: {body: Field.text('Body')}})
const main = Config.workspace('Main', {
  source: 'content',
  roots: {pages: Config.root('Pages')}
})

test('the handler previews a record delta', async () => {
  const cms = createCMS({schema: {Page}, workspaces: {main}})
  const db = new LocalDB(cms.config)
  await db.create({type: Page, id: 'home', set: {title: 'Home', body: 'Hi'}})
  const entry = await db.get({id: 'home', select: Entry})
  const handle = createHandler({
    cms,
    db,
    remote(context) {
      return composeBackend(db, {
        async verify(): Promise<AuthedContext> {
          return {...context, token: 'test', user: {roles: [], sub: 'a'}}
        }
      })
    }
  })
  const draft = createRecord(
    {...entry, data: {...entry.data, body: 'Draft'}},
    'published'
  )
  const payload = await encodePreviewPayload({
    version: 2,
    locale: null,
    entryId: 'home',
    contentHash: await db.sha,
    status: 'published',
    fileHash: entry.fileHash,
    delta: await createFilePatch(recordJson(entry), JSON.stringify(draft))
  })
  const response = await handle(
    new Request('http://localhost/api?action=resolve', {
      method: 'POST',
      headers: {accept: 'application/json', 'content-type': 'application/json'},
      body: getScope(cms.config).stringify({
        first: true,
        id: 'home',
        select: Entry.data,
        preview: {payload}
      })
    }),
    {apiKey: 'test', handlerUrl: new URL('http://localhost/api'), isDev: true}
  )
  test.is(response.status, 200)
  const result = await response.json()
  test.is(result.body, 'Draft')
})
