import {PasswordLessAuth} from '@alinea/auth.passwordless/PasswordLessAuth'
import {DevServer, JsonLoader, Server} from '@alinea/backend'
import {GithubData} from '@alinea/backend/data/GithubData'
import {RedisDrafts} from '@alinea/backend/drafts/RedisDrafts'
import {JWTPreviews} from '@alinea/backend/util/JWTPreviews'
import {config, createStore} from '@alinea/content'
import dotenv from 'dotenv'
import findConfig from 'find-config'
import Redis from 'ioredis'
import {createTransport} from 'nodemailer'

function createServer() {
  dotenv.config({path: findConfig('.env')!})
  const drafts = new RedisDrafts({
    client: new Redis(process.env.REDIS_DSN)
  })
  const isProduction = process.env.NODE_ENV === 'production'
  const dashboardUrl = isProduction
    ? 'https://alinea.sh/admin'
    : 'http://localhost:3000/admin'

  const data = new GithubData({
    config,
    loader: JsonLoader,
    rootDir: 'apps/web',
    githubAuthToken: process.env.GITHUB_TOKEN!,
    owner: 'alineacms',
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
  return new Server({
    dashboardUrl,
    auth,
    config,
    createStore,
    drafts: drafts,
    target: data,
    media: data,
    previews: new JWTPreviews(process.env.JWT_SECRET!)
  })
}

export const backend =
  process.env.NODE_ENV === 'development'
    ? new DevServer({
        config,
        createStore
      })
    : createServer()
