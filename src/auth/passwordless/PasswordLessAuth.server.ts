import {Handler, router} from 'alinea/backend/router/Router'
import {Auth, createError, Hub, Outcome, User} from 'alinea/core'
import {sign, verify} from 'alinea/core/util/JWT'
import type {Transporter} from 'nodemailer'
import {assert, object, string} from 'superstruct'

export type PasswordLessAuthOptions = {
  dashboardUrl: string
  subject: string
  from: string
  transporter: Transporter
  jwtSecret: string
  isUser: (email: string) => Promise<boolean>
}

const LoginBody = object({
  email: string()
})

// Todo: rate limit requests. In theory we need some external state store to do
// so but in practice we'll probably get away with an in memory check as the
// amount of instances won't be many. Alternatively a redis endpoint could be
// provided in the options to keep state.

export class PasswordLessAuth implements Auth.Server {
  handler: Handler<Request, Response | undefined>
  users = new WeakMap<Request, User>()

  constructor(protected options: PasswordLessAuthOptions) {
    const matcher = router.startAt(Hub.routes.base)
    this.handler = router(
      matcher
        .post(Hub.routes.base + '/auth.passwordless')
        .map(router.parseJson)
        .map(async ({body}) => {
          assert(body, LoginBody)
          const email = body.email
          const isUser = await this.options.isUser(email)
          if (!isUser)
            return Outcome.Failure(createError(404, 'User not found'))
          const token = await sign({sub: email}, this.options.jwtSecret)
          const url = `${this.options.dashboardUrl}?token=${token}`
          await this.options.transporter.sendMail({
            from: this.options.from,
            to: body.email,
            subject: this.options.subject,
            text: url
          })
          return Outcome.Success('Sent')
        })
        .map(router.jsonResponse),

      router
        .use(async (request: Request) => {
          try {
            const user = await this.userFor(request)
          } catch (e) {
            return Outcome.Failure(createError(401, 'Unauthorized'))
          }
        })
        .map(router.jsonResponse)
    ).recover(router.reportError)
  }

  async contextFor(request: Request): Promise<Hub.AuthContext> {
    return {user: await this.userFor(request)}
  }

  async userFor(request: Request) {
    if (this.users.has(request)) return this.users.get(request)!
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) throw createError(400, 'No Authorization header')
    const [scheme, token] = authHeader.split(' ')
    if (scheme !== 'Bearer')
      throw createError(400, 'Invalid Authorization header')
    const user = await verify<User>(token, this.options.jwtSecret)
    this.users.set(request, user)
    return user
  }
}
