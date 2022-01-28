import {PasswordLessAuth} from '@alinea/auth.passwordless/PasswordLessAuth'
import {createId} from '@alinea/core'
import {Cache, JsonLoader, Server} from '@alinea/server'
import {FileDrafts} from '@alinea/server/drafts/FileDrafts'
import {FirestoreDrafts} from '@alinea/server/drafts/FirestoreDrafts'
import {GitDrafts} from '@alinea/server/drafts/GitDrafts'
import {FileSource} from '@alinea/server/source/FileSource'
import compression from 'compression'
import dotenv from 'dotenv'
import express from 'express'
import {getFirestore} from 'firebase-admin/firestore'
import fs from 'fs/promises'
import {BetterSqlite3} from 'helder.store/sqlite/drivers/BetterSqlite3.js'
import {SqliteStore} from 'helder.store/sqlite/SqliteStore.js'
import http from 'isomorphic-git/http/node/index.js'
import {createTransport} from 'nodemailer'
import {createElement} from 'react'
import ReactDOMServer from 'react-dom/server.js'
import serveHandler from 'serve-handler'
import PageView, {getStaticProps} from '../../website/src/pages'
import App from '../../website/src/pages/_app'
import {schema} from '../../website/src/schema'

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
const store = new SqliteStore(new BetterSqlite3(), createId)
const content = new FileSource({
  fs,
  dir: '../website/content',
  loader: JsonLoader
})

const onAuth = () => ({username: process.env.GITHUB_TOKEN})

const gitDrafts = new GitDrafts({
  schema,
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
  schema,
  fs,
  dir: './dist/drafts'
})
/*initializeApp({
  credential: cert('../../private/serviceAccount.json')
})*/
const firestoreDrafts = new FirestoreDrafts({
  schema,
  collection: getFirestore().collection('Draft')
})

await Cache.create(store, content)

const server = new Server({
  dashboardUrl,
  // auth,
  schema,
  drafts: firestoreDrafts,
  store,
  target: content
})

const app = express()
app.use(server.app)
app.use(compression())
app.get('/api/preview', async (req, res) => {
  const url = new URL(req.url, 'http://localhost:4500')
  const slug = url.search
  const {props} = await getStaticProps({
    preview: true,
    params: {slug: slug.split('/').slice(1)}
  })
  const html = ReactDOMServer.renderToStaticMarkup(
    createElement(App, {
      router: undefined!,
      Component: PageView,
      pageProps: props
    })
  )
  return res.header('content-type', 'text/html').end(`
      <!doctype html>
      <link href="/dist/server.css" rel="stylesheet" />
      ${html}
    `)
})
app.use((req, res) => serveHandler(req, res, {public: '.'}))
app.listen(4500)

console.log('Server started on http://localhost:4500')
