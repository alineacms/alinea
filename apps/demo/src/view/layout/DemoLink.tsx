import {HTMLProps} from 'react'

import NextLink from 'next/link'
import {useRouter} from 'next/router'
import {UrlObject} from 'url'

function checkIsExternal(href: string) {
  if (href.startsWith && (href.startsWith('http') || href.startsWith('https')))
    return true
}

function checkIsFile(href: string) {
  const last = href.split('/').pop()
  if (last?.includes('.')) return true
  return false
}

type IProps = Omit<
  | HTMLProps<HTMLAnchorElement>
  | ({as: 'button'} & HTMLProps<HTMLButtonElement>),
  'className'
> & {
  to?: string | UrlObject
  className?: string
}

// eslint-disable-next-line react/display-name
export function DemoLink({as, to, target, children, ...props}: IProps) {
  const Comp = as || 'a'
  const router = useRouter()

  if (!to) {
    return <Comp {...(props as any)}>{children}</Comp>
  }

  if (typeof to !== 'string') {
    return (
      <NextLink href={to} passHref prefetch={false}>
        <Comp {...(props as any)} target={target || '_self'}>
          {children}
        </Comp>
      </NextLink>
    )
  }

  let href = to
  const isExternal = checkIsExternal(href)
  const isFile = checkIsFile(href)
  if (href && (isExternal || isFile)) {
    console.log('test')
    return (
      <Comp
        {...(props as any)}
        href={href}
        target={target || '_blank'}
        rel={isExternal ? 'external nofollow noopener' : null}
      >
        {children}
      </Comp>
    )
  }

  const anchorPieces = href.split('#')
  const anchor = href.startsWith('#') ? href.slice(1) : anchorPieces[1]
  const isInpageAnchor =
    href.includes('#') &&
    (href.startsWith('#') || anchorPieces[0] === router.asPath)
  if (isInpageAnchor) {
    return (
      <Comp
        {...(props as any)}
        target={'_self'}
        onClick={(e: any) => {
          console.log(anchor)
          e.preventDefault()
          scrollToHash(anchor)
        }}
      >
        {children}
      </Comp>
    )
  }

  return (
    <NextLink href={href} passHref prefetch={false}>
      <Comp {...(props as any)} target={target || '_self'}>
        {children}
      </Comp>
    </NextLink>
  )
}

export function scrollToHash(to: string, yOffset = -25) {
  if (!to) return

  const hash = to.substring(0, 1) === '#' ? to.substring(1) : to
  if (!hash) return

  const el: HTMLElement | null = document.getElementById(hash)
  if (!el) return
  const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset

  setTimeout(() => window.scrollTo({top: y, behavior: 'smooth'}), 0)
}
