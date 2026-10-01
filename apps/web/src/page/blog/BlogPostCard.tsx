import styler from '@alinea/styler'
import Link from 'next/link'
import css from './BlogPostCard.module.scss'
import {BlogPostMeta} from './BlogPostMeta'
import type {BlogPostSummary} from './blogPosts'

const styles = styler(css)

export interface BlogPostCardProps {
  post: BlogPostSummary
}

export function BlogPostCard({post}: BlogPostCardProps) {
  return (
    <Link href={post.url} className={styles.root()}>
      <h3 className={styles.root.title()}>{post.title}</h3>
      <BlogPostMeta
        category={post.category}
        publishDate={post.publishDate}
        author={post.author?.name}
      />
      {post.introduction && (
        <p className={styles.root.introduction()}>{post.introduction}</p>
      )}
      <span className={styles.root.read()}>Read →</span>
    </Link>
  )
}
