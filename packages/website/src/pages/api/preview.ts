import type {NextApiRequest, NextApiResponse} from 'next'
import {backend} from '../../../alinea.backend'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const previewToken = decodeURIComponent(
    new URL(req.url!, 'http://localhost').search
  ).substring(1)
  const {url} = await backend.parsePreviewToken(previewToken)
  res.setPreviewData(previewToken)
  res.redirect(url)
}
