import {LocalHub, Server} from '@alinea/server'
import {NextApiRequest, NextApiResponse} from 'next'
import {pagesSchema} from '../../../schema'

const server = new Server({
  dashboardUrl: '/admin',
  hub: new LocalHub(pagesSchema, 'content')
})

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return server.respond(req, res)
}
