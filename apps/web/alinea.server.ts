import {PasswordLess} from '@alinea/auth.passwordless'
import {Backend, JsonLoader} from '@alinea/backend'
import {GithubData} from '@alinea/backend.github'
import {RedisDrafts} from '@alinea/backend.redis/RedisDrafts'
import {JWTPreviews} from '@alinea/backend/util/JWTPreviews'
import {backend} from '@alinea/core'
import Redis from 'ioredis'
import {createTransport} from 'nodemailer'

export const configureBackend = backend.configure<PasswordLess>(
  ({auth, config, createStore}) => {
    const dashboardUrl = 'http://localhost:4500'
    const drafts = new RedisDrafts({
      client: new Redis(process.env.REDIS_DSN)
    })
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
    const passwordless = auth.configure({
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
    return new Backend({
      dashboardUrl,
      auth: passwordless,
      config,
      createStore,
      drafts: drafts,
      target: data,
      media: data,
      previews: new JWTPreviews(process.env.JWT_SECRET!)
    })
  }
)
