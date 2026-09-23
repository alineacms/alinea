import styler from '@alinea/styler'
import Link from 'next/link'
import {BlogAvatar} from './BlogAvatar'
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
        sizes="(max-width: 1023px) 100vw, 640px"
        priority
      />
      <div className={styles.root.content()}>
        <BlogPostMeta
          category={post.category}
          publishDate={post.publishDate}
          variant="accent"
        />
        <h2 className={styles.root.title()}>{post.title}</h2>
        {post.introduction && (
          <p className={styles.root.introduction()}>{post.introduction}</p>
        )}
        <div className={styles.root.footer()}>
          {post.author?.name ? (
            <span className={styles.root.author()}>
              <BlogAvatar
                name={post.author.name}
                src={post.author.avatar?._url}
              />
              {post.author.name}
            </span>
          ) : (
            <span />
          )}
          <span className={styles.root.read()}>Read the post →</span>
        </div>
      </div>
    </Link>
  )
}
