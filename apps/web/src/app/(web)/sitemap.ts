import type {MetadataRoute} from 'next'

const pages = [
  import('@/page/DocPage'),
  import('@/page/HomePage'),
  import('@/page/BlogPostPage'),
  import('@/page/BlogPage'),
  import('@/page/GenericPage'),
  import('@/page/PlaygroundPage')
]

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return Promise.all(pages)
    .then(mods => mods.map(({default: page}) => page.sitemap()))
    .then(maps => Promise.all(maps))
    .then(maps => maps.flat())
}
