import {PasswordLessAuth} from '@alinea/auth.passwordless/PasswordLessAuth.js'
import {Cache} from '@alinea/cache'
import {
  FSPersistence,
  GithubPersistence,
  LocalHub,
  Server
} from '@alinea/server'
import {schema} from 'alinea/schema'
import dotenv from 'dotenv'
import {createTransport} from 'nodemailer'

dotenv.config({path: '../../.env'})

const isProduction = process.env.NODE_ENV === 'production'
const cacheDir = isProduction ? 'packages/website/' : ''
const dashboardUrl = isProduction
  ? 'https://alinea.vercel.app/admin'
  : 'http://localhost:3000/admin'
const index = Cache.fromFile({
  schema,
  dir: 'content',
  cacheFile: `${cacheDir}.next/server/chunks/content`
})
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
  jwtSecret: process.env.JWT_SECRET!,
  async isUser(email: string) {
    return email.endsWith('@codeurs.be')
  }
})
const persistence = isProduction
  ? new GithubPersistence({
      index,
      contentDir: 'packages/website/content',
      githubAuthToken: process.env.GITHUB_TOKEN!,
      owner: 'codeurs',
      repo: 'alinea',
      branch: 'main'
    })
  : new FSPersistence(index, 'content')
const server = new Server({
  auth,
  dashboardUrl,
  hub: new LocalHub({
    schema: schema,
    index,
    persistence
  })
})

export default server.respond
