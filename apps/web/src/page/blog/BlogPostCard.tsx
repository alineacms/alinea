import styler from '@alinea/styler'
import Link from 'next/link'
import {BlogAvatar} from './BlogAvatar'
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
      <BlogPostMeta category={post.category} publishDate={post.publishDate} />
      <h3 className={styles.root.title()}>{post.title}</h3>
      {post.introduction && (
        <p className={styles.root.introduction()}>{post.introduction}</p>
      )}
      <div className={styles.root.footer()}>
        {post.author?.name ? (
          <span className={styles.root.author()}>
            <BlogAvatar
              name={post.author.name}
              src={post.author.avatar?._url}
              size="small"
            />
            {post.author.name}
          </span>
        ) : (
          <span />
        )}
        <span className={styles.root.read()}>Read →</span>
      </div>
    </Link>
  )
}
