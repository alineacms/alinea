import type {ImageLink} from 'alinea'
import type {Metadata} from 'next'
import {cms} from '@/cms'
import {Home} from '@/schema/Home'

/** Canonical origin of the website, also on preview and local deploys */
export const siteUrl = 'https://alineacms.com'
export const siteName = 'Alinea CMS'

const defaultImage = {src: '/opengraph-image.png', width: 1200, height: 630}

export interface PageMetadata {
  title?: string
  description?: string
  openGraph?: {
    image?: ImageLink
    title?: string
    description?: string
  }
}

export interface MetadataProps {
  url: string
  title: string
  metadata?: PageMetadata | null
  /** Used when the page has no description set in its metadata */
  description?: string | null
  /** Used when the page has no open graph image set in its metadata */
  image?: ImageLink | null
  /** Shares the page as an article, eg. a blog post */
  article?: {
    publishedTime?: string | null
    authors?: Array<string>
  }
}

async function getDefaultMetadata(): Promise<PageMetadata | null> {
  const defaultData = await cms.get({
    type: Home,
    select: {metadata: Home.metadata}
  })
  return defaultData?.metadata ?? null
}

export async function getMetadata(
  data: MetadataProps | null
): Promise<Metadata> {
  // Not found pages are marked noindex by Next.js and have no canonical url
  if (!data) return {title: `Page not found - ${siteName}`}

  const defaultMetadata = await getDefaultMetadata()
  const {url, title, metadata, article} = data
  const metaTitle =
    metadata?.title && metadata?.title !== title
      ? metadata.title
      : `${title} - ${siteName}`
  const description =
    metadata?.description || data.description || defaultMetadata?.description
  const metaImage = metadata?.openGraph?.image?.src
    ? metadata.openGraph.image
    : data.image?.src
      ? data.image
      : defaultImage
  const images = [
    {url: metaImage.src, width: metaImage.width, height: metaImage.height}
  ]
  const shared = {
    url,
    siteName,
    locale: 'en_US',
    title: metadata?.openGraph?.title || metaTitle,
    description: metadata?.openGraph?.description || description,
    images
  }
  return {
    title: metaTitle,
    description,
    alternates: {canonical: url},
    openGraph: article
      ? {
          ...shared,
          type: 'article',
          publishedTime: article.publishedTime || undefined,
          authors: article.authors
        }
      : {...shared, type: 'website'}
  }
}

function collectText(value: unknown): string {
  if (Array.isArray(value)) return value.map(collectText).join('')
  if (!value || typeof value !== 'object') return ''
  if ('_type' in value && value._type === 'text' && 'text' in value)
    return typeof value.text === 'string' ? value.text : ''
  if ('content' in value) return collectText(value.content)
  return ''
}

/**
 * A meta description from the first paragraph of a rich text body that is
 * long enough to describe the page, shortened to fit search results
 */
export function describeText(body: unknown, maxLength = 160) {
  if (!Array.isArray(body)) return undefined
  for (const node of body) {
    if (!node || typeof node !== 'object' || node._type !== 'paragraph')
      continue
    const text = collectText(node).replace(/`/g, '').replace(/\s+/g, ' ').trim()
    if (text.length < 50) continue
    if (text.length <= maxLength) return text
    // Keep whole sentences where possible, cut between words otherwise
    const sentences = text.match(/.+?[.!?]+(\s+|$)/g) ?? []
    let description = ''
    for (const sentence of sentences) {
      if (description.length + sentence.length > maxLength) break
      description += sentence
    }
    if (description.length >= 50) return description.trim()
    const cut = text.slice(0, maxLength - 1)
    return `${cut.slice(0, cut.lastIndexOf(' '))}…`
  }
  return undefined
}
