import {initPages} from '@alinea/content/pages'
import {PreviewData} from 'next'

export function createApi(previewToken?: PreviewData) {
  const pages = initPages(previewToken as string)
  return {
    async getHomePage() {
      return pages.whereType('HomePage').sure()
    },
    async getPostSlugs() {
      return pages.whereType('BlogPost').select(page => page.path)
    },
    async getPostBySlug(slug: string) {
      return pages.whereType('BlogPost').first(page => page.path.is(slug))
    },
    async getAllPosts() {
      return pages.whereType('BlogPost').select(page => ({
        title: page.title,
        date: page.date,
        path: page.path,
        author: page.author,
        coverImage: page.coverImage,
        excerpt: page.excerpt
      }))
    }
  }
}
