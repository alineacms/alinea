import {Auth, Session} from '@alinea/core'
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import {Router} from 'express'
import type {IncomingHttpHeaders} from 'http'
import jwt from 'jsonwebtoken'
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
    router.post('/auth.passwordless', bodyParser.json(), (req, res) => {
      const email = req.body.email
      if (!email) return res.sendStatus(400)
      const token = jwt.sign({sub: email}, this.options.jwtSecret)
      const url = `${req.protocol}://${req.get('host')}${
        req.originalUrl
      }?token=${token}`
      this.options.transporter
        .sendMail({
          from: this.options.from,
          to: req.body.email,
          subject: this.options.subject,
          text: url
        })
        .then(() => {
          res.send('ok')
        })
    })
    router.get('/auth.passwordless', cookieParser(), (req, res) => {
      if (req.query.token) {
        res.cookie('auth.passwordless', req.query.token, {
          secure: req.protocol === 'https',
          httpOnly: true
        })
        return res.redirect(this.options.dashboardUrl)
      }
      const token = req.cookies['auth.passwordless']
      if (token)
        try {
          return res.json(jwt.verify(token, this.options.jwtSecret))
        } catch (e) {}
      res.sendStatus(403)
    })
    return router
  }
}
