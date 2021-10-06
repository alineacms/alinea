import {LocalHub, Server} from '@alinea/server'
import {NextApiRequest, NextApiResponse} from 'next'
import path from 'path'
import {pagesSchema} from '../../../schema'

const cachePath =
  process.env.NODE_ENV === 'production'
    ? path.join(process.cwd(), '.next/server/chunks')
    : undefined

const server = new Server({
  dashboardUrl: '/admin',
  hub: new LocalHub({
    schema: pagesSchema,
    contentPath: 'content',
    cachePath
  })
})

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return server.respond(req, res)
}
