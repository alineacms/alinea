import type {
  AuthApi,
  AuthedContext,
  RequestContext
} from 'alinea/core/Connection'
import type {User} from 'alinea/core/User'

export class LocalAuth implements AuthApi {
  #user: Promise<User>

  constructor(user: Promise<User>) {
    this.#user = user
  }

  async authenticate() {
    return new Response('ok')
  }

  async verify(request: Request, ctx: RequestContext): Promise<AuthedContext> {
    return {...ctx, user: await this.#user, token: 'dev'}
  }
}
