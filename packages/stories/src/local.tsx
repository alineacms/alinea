//import {PasswordLessLogin} from '@alinea/auth.passwordless/PasswordLessLogin'
import {Config} from '@alinea/core/Config'
import {Workspaces} from '@alinea/core/Workspace'
import '@alinea/css/global.css'
import {renderDashboard} from '@alinea/dashboard'
import {Backend} from '@alinea/server/Backend'
import {Data} from '@alinea/server/Data'
import {IndexedDBDrafts} from '@alinea/server/drafts/IndexedDBDrafts.js'
import {createCache} from '../../website/.alinea/cache'
import {config} from '../../website/alinea.config'

type LocalBackendOptions<T extends Workspaces> = {
  config: Config<T>
}

class LocalBackend<T extends Workspaces> extends Backend<T> {
  constructor(options: LocalBackendOptions<T>) {
    super({
      ...options,
      createStore: createCache,
      drafts: new IndexedDBDrafts(),
      get target(): Data.Target {
        throw 'not implemented'
      },
      get media(): Data.Media {
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
