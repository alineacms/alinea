import {config, createCache} from '.alinea'
import {PasswordLessAuth} from '@alinea/auth.passwordless/PasswordLessAuth.js'
import {JsonLoader, Server} from '@alinea/server'
import {GithubData} from '@alinea/server/data/GithubData.js'
import {RedisDrafts} from '@alinea/server/drafts/RedisDrafts.js'
import dotenv from 'dotenv'
import findConfig from 'find-config'
import Redis from 'ioredis'
import {createTransport} from 'nodemailer'

dotenv.config({path: findConfig('.env')!})

export const drafts = new RedisDrafts({
  client: new Redis(process.env.REDIS_DSN)
})

const isProduction = process.env.NODE_ENV === 'production'
const dashboardUrl = isProduction
  ? 'https://alinea.vercel.app/admin'
  : 'http://localhost:3000/admin'

const data = new GithubData({
  config,
  loader: JsonLoader,
  rootDir: 'packages/website',
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

export const server = new Server({
  auth,
  config,
  createStore: createCache,
  drafts: drafts,
  target: data,
  media: data,
  jwtSecret: process.env.JWT_SECRET!
})
