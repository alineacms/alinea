import {config, createCache} from '.alinea'
import {PasswordLessAuth} from '@alinea/auth.passwordless/PasswordLessAuth.js'
import {JsonLoader, Server} from '@alinea/server'
import {GithubData} from '@alinea/server/data/GithubData.js'
import {FirestoreDrafts} from '@alinea/server/drafts/FirestoreDrafts.js'
import dotenv from 'dotenv'
import findConfig from 'find-config'
import {cert, getApp, initializeApp} from 'firebase-admin/app'
import {getFirestore} from 'firebase-admin/firestore'
import {createTransport} from 'nodemailer'

dotenv.config({path: findConfig('.env')!})

try {
  getApp()
} catch (e) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIRESTORE_SERVICE_ACCOUNT!))
  })
}

export const drafts = new FirestoreDrafts({
  collection: getFirestore().collection('Draft')
})
const isProduction = process.env.NODE_ENV === 'production'
const dashboardUrl = isProduction
  ? 'https://alinea.vercel.app/admin'
  : 'http://localhost:3000/admin'
const data = new GithubData({
  config,
  loader: JsonLoader,
  contentDir: 'packages/website/content',
  mediaDir: 'packages/website/public',
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
  store: await createCache(),
  drafts: drafts,
  target: data,
  media: data
})
