import type {ImageLink} from 'alinea'
import type {Metadata} from 'next'
import {cms} from '@/cms'
import {Home} from '@/schema/Home'

const appUrl = 'https://alineacms.com'
const siteName = 'Alinea CMS'

export type MetadataProps = {
  url: string
  title: string
  metadata: {
    title: string
    description: string
    openGraph: {
      image: ImageLink
      title: string
      description: string
    }
  }
}

async function getDefaultMetadata(): Promise<MetadataProps['metadata'] | null> {
  const defaultData = await cms.get({
    type: Home,
    select: {metadata: Home.metadata}
  })
  if (!defaultData) return null
  return defaultData?.metadata
}

export async function getMetadata(
  data: MetadataProps | null
): Promise<Metadata> {
  const defaultMetadata = await getDefaultMetadata()
  const basicMetadata = {
    metadataBase: new URL(appUrl),
    openGraph: {type: 'website', siteName},
    alternates: {
      canonical: data?.url && data.url !== '/' ? data?.url : appUrl
    }
  }

  if (!data) return {...basicMetadata, title: `Page not found - ${siteName}`}

  const {url, title, metadata} = data
  const metaTitle =
    metadata?.title && metadata?.title !== title
      ? `${metadata.title} - ${siteName}`
      : `${title} - ${siteName}`
  const metaImage = metadata?.openGraph?.image?.src
    ? metadata.openGraph.image
    : defaultMetadata?.openGraph?.image

  return {
    ...basicMetadata,
    title: metaTitle,
    description: metadata?.description || defaultMetadata?.description,
    openGraph: {
      ...basicMetadata.openGraph,
      url: appUrl + url,
      title: metadata?.openGraph?.title || metaTitle,
      description:
        metadata?.openGraph?.description ||
        metadata?.description ||
        defaultMetadata?.openGraph?.description ||
        defaultMetadata?.description,
      images: metaImage?.src && [
        {
          url: metaImage.src,
          width: metaImage.width,
          height: metaImage.height
        }
      ]
    }
  }
}
