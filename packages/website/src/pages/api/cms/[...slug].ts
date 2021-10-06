import {Server} from '@alinea/server'
import {NextApiRequest, NextApiResponse} from 'next'
import {hub} from '../../../hub'

const server = new Server({
  dashboardUrl: '/admin',
  hub
})

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return server.respond(req, res)
}
