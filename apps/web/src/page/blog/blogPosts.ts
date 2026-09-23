import {type Infer, Query} from 'alinea'
import {Entry} from 'alinea/core/Entry'
import {cms} from '@/cms'
import {BlogPost} from '@/schema/BlogPost'

export type BlogCategory = NonNullable<Infer<typeof BlogPost>['category']>

/** Labels as configured in the BlogPost category field */
export const blogCategoryLabels: Record<BlogCategory, string> = {
  release: 'Release',
  update: 'Update',
  community: 'Community'
}

export const blogPostSummary = {
  id: Entry.id,
  url: Query.url,
  title: BlogPost.title,
  category: BlogPost.category,
  publishDate: BlogPost.publishDate,
  introduction: BlogPost.introduction,
  author: BlogPost.author,
  cover: BlogPost.cover,
  coverText: BlogPost.coverText
}

export type BlogPostSummary = Awaited<ReturnType<typeof findBlogPosts>>[number]

/** All blog posts, newest first */
export async function findBlogPosts() {
  const posts = await cms.find({type: BlogPost, select: blogPostSummary})
  return posts.sort((a, b) =>
    (b.publishDate ?? '').localeCompare(a.publishDate ?? '')
  )
}

export function formatPublishDate(publishDate: string | null | undefined) {
  const date = publishDate ? new Date(publishDate) : new Date()
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(date)
}

function countWords(value: unknown): number {
  if (Array.isArray(value))
    return value.reduce<number>((total, item) => total + countWords(item), 0)
  if (!value || typeof value !== 'object') return 0
  if ('_type' in value && value._type === 'text' && 'text' in value) {
    const text = typeof value.text === 'string' ? value.text : ''
    return text.split(/\s+/).filter(Boolean).length
  }
  return Object.values(value).reduce<number>(
    (total, item) => total + countWords(item),
    0
  )
}

/** Estimated reading time in minutes at ~200 words per minute */
export function readingTime(body: unknown) {
  return Math.max(1, Math.round(countWords(body) / 200))
}
