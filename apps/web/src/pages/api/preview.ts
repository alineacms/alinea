import {backend} from '@alinea/content/backend.js'
import type {NextApiRequest, NextApiResponse} from 'next'

const id = Math.random()

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('handler: ' + id)
  const previewToken = decodeURIComponent(
    new URL(req.url!, 'http://localhost').search
  ).substring(1)
  const {url} = await backend.parsePreviewToken(previewToken)
  res.setPreviewData(previewToken)
  res.redirect(url)
}
