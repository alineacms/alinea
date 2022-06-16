import {Auth} from '@alinea/core'
import {CloudAuthServer, CloudAuthServerOptions} from './server/CloudAuthServer'
import {CloudAuthView} from './view/CloudAuthView'

export const cloudAuth: Auth<CloudAuthServerOptions> = {
  view: CloudAuthView,
  configure: options => new CloudAuthServer(options)
}
