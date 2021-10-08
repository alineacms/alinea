import {PasswordLessAuth} from '@alinea/auth.passwordless/PasswordLessAuth.js'
import {ContentIndex} from '@alinea/index'
import {GithubPersistence, LocalHub, Server} from '@alinea/server'
import {createTransport} from 'nodemailer'
import {schema} from '../../../schema'

const cacheDir =
  process.env.NODE_ENV === 'production' ? 'packages/website/' : ''
const dashboardUrl =
  process.env.NODE_ENV === 'production'
    ? 'https://alinea.vercel.app/admin'
    : 'http://localhost:3000/admin'
const index = ContentIndex.fromCacheFile(
  `${cacheDir}.next/server/chunks/content`
)
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
    return email.endsWith('@codeurs.be')
  }
})
const persistence = new GithubPersistence({
  index,
  contentDir: 'packages/website/content',
  githubAuthToken: process.env.GITHUB_TOKEN!,
  owner: 'codeurs',
  repo: 'alinea',
  branch: 'main'
})
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
