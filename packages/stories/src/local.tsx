//import {PasswordLessLogin} from '@alinea/auth.passwordless/PasswordLessLogin'
import {Config} from '@alinea/core/Config'
import {createId} from '@alinea/core/Id'
import {Workspaces} from '@alinea/core/Workspace'
import '@alinea/css/global.css'
import {renderDashboard} from '@alinea/dashboard'
import {Backend} from '@alinea/server/Backend'
import {Data} from '@alinea/server/Data'
import {IndexedDBDrafts} from '@alinea/server/drafts/IndexedDBDrafts.js'
import {SqlJsDriver} from '@alinea/store/sqlite/drivers/SqlJsDriver.js'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore.js'
import initSqlJs from 'sql.js-fts5'
import {config} from '../../website/alinea.config'

type LocalBackendOptions<T extends Workspaces> = {
  config: Config<T>
}

class LocalBackend<T extends Workspaces> extends Backend<T> {
  constructor(options: LocalBackendOptions<T>) {
    super({
      ...options,
      createStore: () => {
        return initSqlJs({
          locateFile: () =>
            `https://www.unpkg.com/sql.js-fts5@1.4.0/dist/sql-wasm.wasm`
        }).then(
          ({Database}) =>
            new SqliteStore(new SqlJsDriver(new Database()), createId)
        )
      },
      drafts: new IndexedDBDrafts(),
      get target(): Data.Target {
        throw 'not implemented'
      },
      get media(): Data.Media {
        throw 'not implemented'
      },
      get jwtSecret(): string {
        throw 'not implemented'
      }
    })
  }
  signToken(tokenData: string | object | Buffer): string {
    return JSON.stringify(tokenData)
  }
  verifyToken<T>(token: string): T {
    return JSON.parse(token)
  }
}

const backend = new LocalBackend({
  config
})

renderDashboard({
  config,
  client: backend
})
