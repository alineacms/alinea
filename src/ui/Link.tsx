import styler from '@alinea/styler'
import type {AnchorHTMLAttributes, MouseEvent, ReactNode} from 'react'
import css from './Link.module.css'

const styles = styler(css)

export interface LinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> {
  href?: string
  external?: boolean
  children?: ReactNode
}

export function Link({children, external, href, onClick, ...props}: LinkProps) {
  const isInternal = typeof href === 'string' && !external
  const anchorHref = isInternal ? `#${href}` : href

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (!isInternal || event.defaultPrevented || !shouldHandleClick(event))
      return
    event.preventDefault()
    navigateHash(href)
  }

  return (
    <a
      {...props}
      href={anchorHref}
      onClick={handleClick}
      className={styles.Link(styler.merge(props))}
    >
      {children}
    </a>
  )
}

function shouldHandleClick(event: MouseEvent<HTMLAnchorElement>) {
  const target = event.currentTarget.target
  return (
    event.button === 0 &&
    (!target || target === '_self') &&
    !event.currentTarget.hasAttribute('download') &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey
  )
}

function navigateHash(path: string) {
  const hash = `#${path}`
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash)
    window.dispatchEvent(new Event('popstate'))
  }
}
