import styler from '@alinea/styler'
import Link from 'next/link'
import css from './ArrowLink.module.scss'
import type {ResolvedLink} from './links'

const styles = styler(css)

export interface ArrowLinkProps {
  link: ResolvedLink | undefined
  className?: string
}

export function ArrowLink({link, className}: ArrowLinkProps) {
  if (!link) return null
  return (
    <Link
      href={link.href}
      target={link.target}
      className={styles.root(styler.merge({className}))}
    >
      {link.label}
      <span aria-hidden="true" className={styles.root.arrow()}>
        →
      </span>
    </Link>
  )
}
