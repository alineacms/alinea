import {PasswordLessAuth} from '@alinea/auth.passwordless/PasswordLessAuth'
import {LocalHub, Server} from '@alinea/server'
import dotenv from 'dotenv'
import {createTransport} from 'nodemailer'
import {mySchema} from './schema'

dotenv.config({path: '../../.env'})

const dashboardUrl = 'http://localhost:8000'
const auth = new PasswordLessAuth({
  dashboardUrl,
  subject: 'Login',
  from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
  transporter: createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD
    }
  }),
  jwtSecret: 'secret',
  async isUser(email: string) {
    // Allow any email address to sign in to the demo
    return true
  }
})
const hub = new LocalHub(mySchema, './content')

const server = new Server({
  dashboardUrl,
  auth,
  hub
})

server.listen(4500)

// Todo: "build": "alinea track-build -- next build"
