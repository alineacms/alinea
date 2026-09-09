import type {AuthApi, AuthedContext, RequestContext} from '#/core/Connection.js'
import type {User} from '#/core/User.js'

export class LocalAuth implements AuthApi {
  #context: RequestContext
  #user: Promise<User>

  constructor(context: RequestContext, user: Promise<User>) {
    this.#context = context
    this.#user = user
  }

  async authenticate(): Promise<Response> {
    throw new Error('Local authentication is not supported')
  }

  async verify(request: Request): Promise<AuthedContext> {
    const ctx = this.#context
    return {...ctx, user: await this.#user, token: 'dev'}
  }
}
