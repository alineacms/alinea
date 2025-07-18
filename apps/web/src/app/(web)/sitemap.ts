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
    .then(maps => {
      return maps.flat().map(page => {
        return {
          ...page,
          url: `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}${page.url}`
        }
      })
    })
}
