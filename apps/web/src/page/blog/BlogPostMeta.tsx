import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import css from './BlogPostMeta.module.scss'
import {
  type BlogCategory,
  blogCategoryLabels,
  formatPublishDate
} from './blogPosts'

const styles = styler(css)

export interface BlogPostMetaProps {
  category?: BlogCategory | null
  publishDate?: string | null
  /** Reading time in minutes */
  readingTime?: number
  author?: ReactNode
  className?: string
}

/** One line of meta: "Release · 23 September 2026 · Ben Merckx" */
export function BlogPostMeta({
  category,
  publishDate,
  readingTime,
  author,
  className
}: BlogPostMetaProps) {
  const parts = [
    category && blogCategoryLabels[category],
    publishDate && (
      <time key="date" dateTime={publishDate}>
        {formatPublishDate(publishDate)}
      </time>
    ),
    readingTime !== undefined && `${readingTime} min read`,
    author
  ].filter(Boolean)
  return (
    <p className={styles.root(styler.merge({className}))}>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {part}
        </span>
      ))}
    </p>
  )
}
