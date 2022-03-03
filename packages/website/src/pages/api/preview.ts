import type {NextApiRequest, NextApiResponse} from 'next'
import {server} from '../../../alinea.server'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const previewToken = decodeURIComponent(
    new URL(req.url!, 'http://localhost').search
  ).substring(1)
  const {id, url} = await server.parsePreviewToken(previewToken)
  res.setPreviewData(id)
  res.redirect(url)
}
