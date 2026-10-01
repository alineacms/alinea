import styler from '@alinea/styler'
import css from './BlogAvatar.module.scss'

const styles = styler(css)

export interface BlogAvatarProps {
  name: string
  src?: string
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts
  return letters.map(part => part[0].toUpperCase()).join('')
}

export function BlogAvatar({name, src}: BlogAvatarProps) {
  return (
    <span className={styles.root()} aria-hidden="true">
      <span className={styles.root.initials()}>{initials(name)}</span>
      {src && (
        <img className={styles.root.image()} src={src} alt="" loading="lazy" />
      )}
    </span>
  )
}
