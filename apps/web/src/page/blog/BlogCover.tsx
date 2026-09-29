import styler from '@alinea/styler'
import type {ImageLink} from 'alinea'
import {imageBlurUrl} from 'alinea/ui'
import Image from 'next/image'
import heroBg from '@/assets/hero-alinea.jpg'
import css from './BlogCover.module.scss'

const styles = styler(css)

export type BlogCoverSize = 'featured' | 'post'

export interface BlogCoverProps {
  cover?: ImageLink | null
  /** Rendered large on the gradient when there is no cover image */
  text?: string | null
  /** Rendered smaller on the gradient when there is no cover text */
  fallbackText?: string
  size?: BlogCoverSize
  sizes: string
  priority?: boolean
  className?: string
}

export function BlogCover({
  cover,
  text,
  fallbackText,
  size = 'featured',
  sizes,
  priority,
  className
}: BlogCoverProps) {
  if (cover?.src) {
    const blurUrl = imageBlurUrl(cover)
    return (
      <div className={styles.root(size, styler.merge({className}))}>
        <Image
          className={styles.root.image()}
          src={cover.src}
          alt={cover.alt || cover.title || ''}
          fill
          priority={priority}
          sizes={sizes}
          placeholder={blurUrl ? 'blur' : undefined}
          blurDataURL={blurUrl}
          style={{
            objectPosition: cover.focus
              ? `${cover.focus.x * 100}% ${cover.focus.y * 100}%`
              : undefined
          }}
        />
      </div>
    )
  }
  return (
    <div className={styles.root(size, 'gradient', styler.merge({className}))}>
      <Image
        className={styles.root.image({flipped: size === 'post'})}
        src={heroBg.src}
        alt=""
        fill
        priority={priority}
        sizes={sizes}
        placeholder="blur"
        blurDataURL={heroBg.blurDataURL}
      />
      {text ? (
        <span className={styles.root.text()}>{text}</span>
      ) : (
        fallbackText && (
          <span className={styles.root.fallback()}>{fallbackText}</span>
        )
      )}
    </div>
  )
}
