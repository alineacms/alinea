import {schema, store} from '.alinea'
import {PasswordLessAuth} from '@alinea/auth.passwordless/PasswordLessAuth.js'
import {JsonLoader, Server} from '@alinea/server'
import {GithubTarget} from '@alinea/server/target/GithubTarget'
import dotenv from 'dotenv'
import {createTransport} from 'nodemailer'
import {drafts} from '../../../drafts'

dotenv.config({path: '../../.env'})

const isProduction = process.env.NODE_ENV === 'production'
const dashboardUrl = isProduction
  ? 'https://alinea.vercel.app/admin'
  : 'http://localhost:3000/admin'
const target = new GithubTarget({
  loader: JsonLoader,
  contentDir: 'packages/website/content',
  githubAuthToken: process.env.GITHUB_TOKEN!,
  owner: 'codeurs',
  repo: 'alinea',
  branch: 'main',
  author: {
    name: 'Ben',
    email: 'ben@codeurs.be'
  }
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
const server = new Server({
  auth,
  dashboardUrl,
  schema,
  store: await store,
  drafts: drafts,
  target
})

export default server.respond

// We disable the body parse that is added by Next.js as it incorrectly parses
// application/octet-stream as string.
export const config = {api: {bodyParser: false}}
