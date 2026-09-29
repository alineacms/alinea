import type {MetadataRoute} from 'next'
import {siteUrl} from '@/utils/metadata'

const pages = [
  import('@/page/HomePage'),
  import('@/page/DocPage'),
  import('@/page/BlogPage'),
  import('@/page/BlogPostPage'),
  import('@/page/ChangelogPage'),
  import('@/page/GenericPage'),
  import('@/page/DemoPage'),
  import('@/page/PlaygroundPage')
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const modules = await Promise.all(pages)
  const maps = await Promise.all(
    modules.map(({default: page}) => page.sitemap())
  )
  // Always list the production urls, also when built for a preview deploy
  return maps.flat().map(page => ({...page, url: `${siteUrl}${page.url}`}))
}
