import {backend} from '@alinea/content/backend'

export function createApi(previewToken?: string) {
  const pages = backend.loadPages({preview: true})
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
