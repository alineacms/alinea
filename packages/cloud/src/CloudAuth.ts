import {Auth} from '@alinea/core'
import {CloudAuthServer} from './server/CloudAuthServer'
import {CloudAuthView} from './view/CloudAuthView'

export const cloudAuth: Auth<{}> = {
  view: CloudAuthView,
  configure: () => new CloudAuthServer()
}
