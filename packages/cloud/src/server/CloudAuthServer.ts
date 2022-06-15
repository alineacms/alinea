import {Handler} from '@alinea/backend/'
import {Auth} from '@alinea/core'

export class CloudAuthServer implements Auth.Server {
  handler: Handler<Request, Response>

  constructor() {
    this.handler = undefined!
  }
}
