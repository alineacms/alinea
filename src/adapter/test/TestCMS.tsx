import sqlite from '@alinea/sqlite-wasm'
import {Database, Handler} from 'alinea/backend'
import {Store} from 'alinea/backend/Store'
import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {CMS} from 'alinea/core/CMS'
import {Config, createConfig} from 'alinea/core/Config'
import {createId} from 'alinea/core/Id'
import {Logger} from 'alinea/core/util/Logger'
import {AddressInfo} from 'node:net'
import {connect} from 'rado/driver/sql.js'

export function createCMS<Definition extends Config>(definition: Definition) {
  const config = createConfig(definition)
  const store: Promise<Store> = sqlite().then(({Database}) =>
    connect(new Database())
  )
  const db = store.then(async store => {
    const db = new Database(config, store)
    await db.fill({async *entries() {}}, '')
    return db
  })
  const cms: CMS<Definition> = new CMS(
    config,
    db.then(async db => {
      return new Handler({
        config,
        db,
        previews: new JWTPreviews('test'),
        previewAuthToken: 'test',
        target: {
          mutate: async () => ({commitHash: createId()})
        },
        media: {
          async prepareUpload(file: string) {
            const id = createId()
            const serve = await listenForUpload()
            return {
              entryId: createId(),
              location: `media/${file}_${id}`,
              previewUrl: `media/${file}_${id}`,
              upload: {
                url: serve.url
              }
            }
          }
        }
      }).connect({logger: new Logger('test')})
    })
  )
  return cms
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
