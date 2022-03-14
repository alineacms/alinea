import {PasswordLessAuth} from '@alinea/auth.passwordless/PasswordLessAuth'
import {createId} from '@alinea/core'
// We import the global styles here so they're included in the bundle.
// In the Next.js build these are imported in the _app view.
import '@alinea/css/global.css'
import {Cache, JsonLoader, Server} from '@alinea/server'
import {FileData} from '@alinea/server/data/FileData'
import {GithubData} from '@alinea/server/data/GithubData'
import {FileDrafts} from '@alinea/server/drafts/FileDrafts'
import {GitDrafts} from '@alinea/server/drafts/GitDrafts'
import {RedisDrafts} from '@alinea/server/drafts/RedisDrafts.js'
import {JWTPreviews} from '@alinea/server/util/JWTPreviews.js'
import {BetterSqlite3Driver} from '@alinea/store/sqlite/drivers/BetterSqlite3Driver'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import Database from 'better-sqlite3'
import compression from 'compression'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'fs/promises'
import Redis from 'ioredis'
import http from 'isomorphic-git/http/node/index.js'
import {createTransport} from 'nodemailer'
import {createElement} from 'react'
import ReactDOMServer from 'react-dom/server.js'
import serveHandler from 'serve-handler'
import {config} from '../../website/alinea.config'
import PageView, {getStaticProps} from '../../website/src/pages'

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

const data = new FileData({
  config,
  fs,
  loader: JsonLoader,
  rootDir: '../website'
})

const githubData = new GithubData({
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

const onAuth = () => ({username: process.env.GITHUB_TOKEN})

const gitDrafts = new GitDrafts({
  fs,
  dir: './dist/drafts',
  http,
  onAuth,
  url: 'https://github.com/benmerckx/content',
  branch: 'drafts',
  author: {
    name: 'Ben',
    email: 'ben@codeurs.be'
  }
})

const fileDrafts = new FileDrafts({
  fs,
  dir: './dist/drafts'
})
/*initializeApp({
  credential: cert('../../private/serviceAccount.json')
})
const firestoreDrafts = new FirestoreDrafts({
  collection: getFirestore().collection('Draft')
})*/

const redisDrafts = new RedisDrafts({
  client: new Redis(process.env.REDIS_DSN)
})

async function createStore() {
  const store = new SqliteStore(
    new BetterSqlite3Driver(new Database(':memory:')),
    createId
  )
  await Cache.create(store, data)
  return store
}

const server = new Server({
  // auth,
  createStore,
  config,
  drafts: redisDrafts,
  media: data,
  target: data,
  previews: new JWTPreviews(process.env.JWT_SECRET!)
})

const app = express()
app.use(server.app)
app.use(compression())
app.get('/api/preview', async (req, res) => {
  try {
    const previewToken = decodeURIComponent(
      new URL(req.url!, 'http://localhost').search
    ).substring(1)
    res.startTime('token', 'Parse preview token')
    const {id, url} = await server.parsePreviewToken(previewToken)
    res.endTime('token')
    res.startTime('page', 'Fetch page props')
    const {props} = await getStaticProps({
      preview: true,
      previewData: id,
      params: {slug: url.split('/').slice(1)}
    })
    res.endTime('page')
    res.startTime('render', 'React render time')
    const html = ReactDOMServer.renderToStaticMarkup(
      createElement(App, {
        router: undefined!,
        Component: PageView,
        pageProps: props
      })
    )
    res.endTime('render')
    return res.header('content-type', 'text/html').end(
      `<!doctype html>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link href="/dist/server.css" rel="stylesheet" />
      ${html}`
    )
  } catch (e: any) {
    return res
      .header('content-type', 'text/html')
      .end(`${e.stack || e.message}`)
  }
})
app.use((req, res) => serveHandler(req, res, {public: '.'}))
app.listen(4500)

console.log('> Server started on http://localhost:4500')
