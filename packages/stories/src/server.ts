import {PasswordLessAuth} from '@alinea/auth.passwordless/PasswordLessAuth'
import {createId, Hub} from '@alinea/core'
import {
  Backend,
  FileSource,
  GitDrafts,
  Index,
  JsonLoader,
  Server
} from '@alinea/server'
import compression from 'compression'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'fs/promises'
import {BetterSqlite3} from 'helder.store/sqlite/drivers/BetterSqlite3.js'
import {SqliteStore} from 'helder.store/sqlite/SqliteStore.js'
import http from 'isomorphic-git/http/node/index.js'
import {fs as memFs} from 'memfs'
import {createTransport} from 'nodemailer'
import serveHandler from 'serve-handler'
import {schema} from '../../website/.alinea/schema'

process.on('unhandledRejection', (error, p) => {
  console.log('=== UNHANDLED REJECTION ===')
  console.dir(error)
})

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
/*
const index = Cache.fromMemory({
  schema,
  dir: '../website/content',
  fs
})
const ghPersistence = new GithubPersistence({
  index,
  contentDir: 'packages/website/content',
  githubAuthToken: process.env.GITHUB_TOKEN!,
  owner: 'codeurs',
  repo: 'alinea',
  branch: 'main'
})
const filePersistence = new FSPersistence(fs, index, '../website/content')
const hub = new LocalHub({
  schema: schema,
  index,
  persistence: filePersistence
})*/
const store = new SqliteStore(new BetterSqlite3(), createId)
const source = new FileSource({
  fs,
  dir: '../website/content',
  loader: JsonLoader
})
// const drafts = new FileDrafts({fs, dir: './bin/drafts'})
const onAuth = () => ({username: process.env.GITHUB_TOKEN})

const drafts = new GitDrafts({
  fs: memFs.promises as any,
  dir: '/tmp',
  http,
  onAuth,
  url: 'https://github.com/benmerckx/content',
  ref: 'drafts',
  author: {
    name: 'Ben',
    email: 'ben@codeurs.be'
  }
})
await Index.create(store, source)
const hub: Hub = {
  schema,
  content: new Backend(store, source),
  drafts //
}
const server = new Server({
  dashboardUrl,
  // auth,
  hub
})
const app = express()
app.use(server.app)
app.use(compression())
app.use((req, res) =>
  serveHandler(req, res, {
    public: '.'
  })
)
app.listen(4500)

console.log('Server started on http://localhost:4500')
