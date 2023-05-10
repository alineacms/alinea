import {Database} from 'alinea/backend'
import {Config, Session} from 'alinea/core'
import {Client} from 'alinea/core/Client'
import {atom} from 'jotai'
import {loadable} from 'jotai/utils'
import {QueryClient} from 'react-query'
import {PersistentStore, createPersistentStore} from './util/PersistentStore.js'

export interface DashboardOptions {
  config: Config
  client: Client
  queryClient?: QueryClient
  session: Session
}

export class Dashboard {
  store: Promise<PersistentStore> = createPersistentStore()
  db: Promise<Database> = this.store.then(
    store => new Database(store, this.options.config)
  )

  constructor(public options: DashboardOptions) {}

  initializingAtom = loadable(atom(this.initialize.bind(this)))

  async initialize() {
    const [store, db] = await Promise.all([this.store, this.db])
    await db.syncWith(this.options.client)
    await store.flush()
  }
}
