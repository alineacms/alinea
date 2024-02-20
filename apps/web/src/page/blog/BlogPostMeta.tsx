import {UrlReference} from 'alinea'
import {HStack, fromModule} from 'alinea/ui'
import css from './BlogPostMeta.module.scss'

const styles = fromModule(css)

export interface BlogPostMetaProps {
  publishDate: string
  author?: {
    url: UrlReference
    avatar?: UrlReference
    name: string
  }
}

export function BlogPostMeta({publishDate, author}: BlogPostMetaProps) {
  const date = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(publishDate))
  return (
    <HStack className={styles.root()} gap={8} align="flex-start">
      {author && (
        <HStack center gap={8}>
          By
          <a href={author.url._url} className={styles.root.author.url()}>
            <HStack center gap={8}>
              {author.avatar && (
                <img
                  alt="Author avatar"
                  className={styles.root.author.avatar()}
                  src={author.avatar._url}
                />
              )}
              {author.name}
            </HStack>
          </a>
        </HStack>
      )}
      <time>— {date}</time>
    </HStack>
  )
}
