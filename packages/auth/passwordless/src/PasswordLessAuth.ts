import {Auth, Session} from '@alinea/core'
import bodyParser from 'body-parser'
import {Router} from 'express'
import expressJwt from 'express-jwt'
import type {IncomingHttpHeaders} from 'http'
import jwt from 'jsonwebtoken'
import {Transporter} from 'nodemailer'

type PasswordLessAuthOptions = {
  dashboardUrl: string
  subject: string
  from: string
  transporter: Transporter
  jwtSecret: string
  isUser: (email: string) => Promise<boolean>
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
    router.post('/auth.passwordless', bodyParser.json(), async (req, res) => {
      const email = req.body.email
      if (!email) return res.sendStatus(400)
      const isUser = await this.options.isUser(email)
      if (!isUser) return res.sendStatus(404)
      const token = jwt.sign({sub: email}, this.options.jwtSecret)
      const url = `${this.options.dashboardUrl}?token=${token}`
      this.options.transporter
        .sendMail({
          from: this.options.from,
          to: req.body.email,
          subject: this.options.subject,
          text: url
        })
        .then(() => {
          res.sendStatus(200)
        })
    })
    router.use(
      expressJwt({secret: this.options.jwtSecret, algorithms: ['HS256']})
    )
    return router
  }
}
