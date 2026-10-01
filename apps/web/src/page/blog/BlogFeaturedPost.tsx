import styler from '@alinea/styler'
import Link from 'next/link'
import {BlogCover} from './BlogCover'
import css from './BlogFeaturedPost.module.scss'
import {BlogPostMeta} from './BlogPostMeta'
import type {BlogPostSummary} from './blogPosts'

const styles = styler(css)

export interface BlogFeaturedPostProps {
  post: BlogPostSummary
}

export function BlogFeaturedPost({post}: BlogFeaturedPostProps) {
  return (
    <Link href={post.url} className={styles.root()}>
      <BlogCover
        className={styles.root.cover()}
        cover={post.cover}
        text={post.coverText}
        fallbackText={post.title}
        sizes="(max-width: 1023px) 100vw, 480px"
        priority
      />
      <div className={styles.root.content()}>
        <h2 className={styles.root.title()}>{post.title}</h2>
        <BlogPostMeta
          category={post.category}
          publishDate={post.publishDate}
          author={post.author?.name}
        />
        {post.introduction && (
          <p className={styles.root.introduction()}>{post.introduction}</p>
        )}
        <span className={styles.root.read()}>Read the post →</span>
      </div>
    </Link>
  )
}
