import {Auth} from '@alinea/core'
import {Request, Response, Router} from 'express'
import expressJwt, {UnauthorizedError} from 'express-jwt'
import jwt from 'jsonwebtoken'
import {json} from 'micro'
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

  router(): Router {
    const router = Router()
    router.post('(/*)?/auth.passwordless', async (req, res) => {
      const body = req.body || (await json(req))
      const email = body.email
      if (!email) return res.sendStatus(400)
      const isUser = await this.options.isUser(email)
      if (!isUser) return res.sendStatus(404)
      const token = jwt.sign({sub: email}, this.options.jwtSecret)
      const url = `${this.options.dashboardUrl}?token=${token}`
      await this.options.transporter.sendMail({
        from: this.options.from,
        to: body.email,
        subject: this.options.subject,
        text: url
      })
      return res.sendStatus(200)
    })
    router.use(
      expressJwt({secret: this.options.jwtSecret, algorithms: ['HS256']})
    )
    router.use(function (
      err: Error,
      req: Request,
      res: Response,
      next: () => void
    ) {
      if (err instanceof UnauthorizedError) res.sendStatus(401)
      else next()
    })
    return router
  }
}
