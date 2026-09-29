import styler from '@alinea/styler'
import css from './BlogAvatar.module.scss'

const styles = styler(css)

export type BlogAvatarSize = 'small' | 'medium' | 'large'

export interface BlogAvatarProps {
  name: string
  src?: string
  size?: BlogAvatarSize
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts
  return letters.map(part => part[0].toUpperCase()).join('')
}

export function BlogAvatar({name, src, size = 'medium'}: BlogAvatarProps) {
  return (
    <span className={styles.root(size)} aria-hidden="true">
      <span className={styles.root.initials()}>{initials(name)}</span>
      {src && (
        <img className={styles.root.image()} src={src} alt="" loading="lazy" />
      )}
    </span>
  )
}
