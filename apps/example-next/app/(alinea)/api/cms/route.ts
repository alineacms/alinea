//import {db} from '@vercel/postgres'
import {createHandler} from 'alinea/next'
import {cms} from '@/cms'

const handler = createHandler({
  cms
  /*backend: {
    database: {
      driver: '@vercel/postgres',
      client: db
    },
    auth(username, password) {
      return (
        username === process.env.ALINEA_USERNAME &&
        password === process.env.ALINEA_PASSWORD
      )
    },
    github: {
      rootDir: 'apps/web',
      contentDir: 'content',
      authToken: process.env.ALINEA_GITHUB_TOKEN!,
      owner: process.env.ALINEA_GITHUB_OWNER!,
      repo: process.env.ALINEA_GITHUB_REPO!,
      branch: process.env.ALINEA_GITHUB_BRANCH!
    }
  }*/
})

export const GET = handler
export const POST = handler
