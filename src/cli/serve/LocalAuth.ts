import type {
  AuthApi,
  AuthedContext,
  RequestContext
} from 'alinea/core/Connection'
import type {User} from 'alinea/core/User'

export class LocalAuth implements AuthApi {
  #context: RequestContext
  #user: Promise<User>

  constructor(context: RequestContext, user: Promise<User>) {
    this.#context = context
    this.#user = user
  }

  async authenticate() {
    return new Response('ok')
  }

  async verify(request: Request): Promise<AuthedContext> {
    const ctx = this.#context
    return {...ctx, user: await this.#user, token: 'dev'}
  }
}
