import {Database} from 'alinea/backend'
import {Auth, Backend} from 'alinea/backend/Backend'
import {memoryBackend} from 'alinea/backend/data/MemoryBackend'
import {createHandler} from 'alinea/backend/Handler'
import {Store} from 'alinea/backend/Store'
import {createStore} from 'alinea/backend/store/CreateStore'
import {CMS} from 'alinea/core/CMS'
import {Config, createConfig} from 'alinea/core/Config'
import {createId} from 'alinea/core/Id'
import {localUser} from 'alinea/core/User'
import {AddressInfo} from 'node:net'
import PLazy from 'p-lazy'

const auth: Auth = {
  async authenticate() {
    return new Response('ok')
  },
  async verify(ctx) {
    return {...ctx, user: localUser, token: 'dev'}
  }
}

export function createCMS<Definition extends Config>(definition: Definition) {
  const config = createConfig(definition)
  const store: Promise<Store> = createStore()
  const db = store.then(async store => {
    const db = new Database(config, store)
    await db.fill({async *entries() {}}, '')
    return db
  })
  const backend = db.then(
    (db): Backend => ({
      ...memoryBackend(db),
      target: {
        async mutate(ctx, params) {
          return {commitHash: createId()}
        }
      },
      media: {
        async prepareUpload(ctx, file) {
          const id = createId()
          const serve = await listenForUpload()
          return {
            entryId: createId(),
            location: `media/${file}_${id}`,
            previewUrl: `media/${file}_${id}`,
            url: serve.url
          }
        }
      }
    })
  )
  const handle = PLazy.from(async () => {
    return createHandler(cms, await backend, db)
  })
  const cms: CMS<Definition> = new CMS(config, async () => {
    const {connect} = await handle
    return connect({
      handlerUrl: new URL('http://localhost:3000'),
      apiKey: 'dev',
      user: localUser,
      token: ''
    })
  })
  return Object.assign(cms, {db})
}

async function listenForUpload(): Promise<{url: string}> {
  const {createServer} = await import('http')
  const server = createServer((req, res) => {
    res.end()
    server.close()
  })
  return new Promise(resolve => {
    server.listen(0, () => {
      resolve({
        url: `http://localhost:${(server.address() as AddressInfo).port}`
      })
    })
  })
}
