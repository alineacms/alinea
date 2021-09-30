import {Auth, Session} from '@alinea/core'
import {Router} from 'express'
import type {IncomingHttpHeaders} from 'http'
import {Transporter} from 'nodemailer'

type PasswordLessAuthOptions = {
  dashboardUrl: string
  subject: string
  from: string
  transporter: Transporter
  jwtSecret: string
}

// Todo: rate limit requests. In theory we need some external state store to do
// so but in practice we'll probably get away with an in memory check as the
// amount of instances won't be many. Alternatively a redis endpoint could be
// provided in the options to keep state.

export class PasswordLessAuth implements Auth.Server {
  constructor(protected options: PasswordLessAuthOptions) {}

  authenticate(req: IncomingHttpHeaders): Promise<Session> {
    throw 'ok'
  }

  router(): Router {
    const router = Router()
    const token = 'abc'
    router.post('/auth.passwordless', (req, res) => {
      this.options.transporter.sendMail({
        from: this.options.from,
        to: req.body.email,
        subject: this.options.subject,
        text: `${this.options.dashboardUrl}?token=${token}`
      })
      res.send('ok')
    })
    return router
  }
}
