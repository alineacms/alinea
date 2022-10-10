import {backend} from '@alinea/content/backend'
import type {NextApiRequest, NextApiResponse} from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // We'll parse the previewToken from the url /api/preview?token
  const previewToken = req.url!.split('?').pop()

  // We can ask alinea to parse and validate the preview token.
  // We'll receive the url of the entry we're currently previewing.
  const {url} = await backend.parsePreviewToken(previewToken)

  // Store the preview token in the Next.js context so we
  // can use it in the next route to query drafts data. Next.js
  // uses a temporary cookie to persist this.
  res.setPreviewData(previewToken)

  // Finally redirect to the page we actually want to view
  res.redirect(url)
}
