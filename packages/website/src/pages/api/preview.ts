import type {NextApiRequest, NextApiResponse} from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const url = new URL(req.url!, 'http://localhost')
  const slug = url.search.substring(1)
  res.setPreviewData({})
  // Todo: let's sign the slug with our secret so we don't open redirects
  res.redirect(slug)
}
