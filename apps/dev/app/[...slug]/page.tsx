import {Entry} from 'alinea/core'
import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {cache} from 'react'
import {cms} from '@/cms'

type PageProps = {
  params: Promise<{slug: Array<string>}>
}

type MetadataImage = {
  src?: string
  url?: string
  width?: number
  height?: number
  title?: string
}

type MetadataValue = {
  title?: string
  description?: string
  openGraph?: {
    title?: string
    description?: string
    image?: MetadataImage
  }
}

type PageFields = Record<string, unknown> & {
  _url?: string
  metadata?: MetadataValue
  summary?: unknown
  title?: unknown
}

const pageByUrl = cache((url: string) => {
  return cms.first({
    url,
    select: Entry
  })
})

const pageFieldsByUrl = cache(async (url: string) => {
  const entry = await pageByUrl(url)
  if (!entry) return null
  const schema = cms.schema as Record<string, unknown>
  const type = schema[entry.type]
  if (!type) return null
  return cms.first({
    url,
    type: type as never
  }) as Promise<PageFields | null>
})

async function urlFromParams(params: PageProps['params']) {
  const slug = await params.then(({slug}) => slug)
  return `/${slug.join('/')}`
}

async function pageFromParams(params: PageProps['params']) {
  const url = await urlFromParams(params)
  return pageByUrl(url)
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function metadataImage(image: MetadataImage | undefined) {
  const url = text(image?.url) ?? text(image?.src)
  if (!url) return undefined
  return {
    url,
    width: image?.width,
    height: image?.height,
    alt: text(image?.title)
  }
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const url = await urlFromParams(props.params)
  const [page, fields] = await Promise.all([
    pageByUrl(url),
    pageFieldsByUrl(url)
  ])
  if (!page) return {}

  const data = page.data as Record<string, unknown>
  const metadata = fields?.metadata ?? ((data.metadata ?? {}) as MetadataValue)
  const title = text(metadata.title) ?? text(fields?.title) ?? text(page.title)
  const description =
    text(metadata.description) ?? text(fields?.summary) ?? text(data.summary)
  const openGraphTitle = text(metadata.openGraph?.title) ?? title
  const openGraphDescription =
    text(metadata.openGraph?.description) ?? description
  const image = metadataImage(metadata.openGraph?.image)

  return {
    title,
    description,
    alternates: {
      canonical: page.url
    },
    openGraph: {
      url: fields?._url ?? page.url,
      title: openGraphTitle,
      description: openGraphDescription,
      images: image ? [image] : undefined
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: openGraphTitle,
      description: openGraphDescription,
      images: image ? [image.url] : undefined
    }
  }
}

export default async function Example(props: PageProps) {
  const page = await pageFromParams(props.params)
  if (!page) return notFound()
  return <div>{JSON.stringify(page)}</div>
}
