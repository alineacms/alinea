import styler from '@alinea/styler'
import {Label, type LabelVariant} from '@/layout/Label'
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
  variant?: LabelVariant
  className?: string
}

export function BlogPostMeta({
  category,
  publishDate,
  readingTime,
  variant = 'neutral',
  className
}: BlogPostMetaProps) {
  const label = category ? blogCategoryLabels[category] : undefined
  return (
    <div className={styles.root(styler.merge({className}))}>
      {label && (
        <Label variant={variant} size="small">
          {label}
        </Label>
      )}
      <time dateTime={publishDate ?? undefined}>
        {formatPublishDate(publishDate)}
      </time>
      {readingTime !== undefined && (
        <>
          <span aria-hidden="true">·</span>
          <span>{readingTime} min read</span>
        </>
      )}
    </div>
  )
}
