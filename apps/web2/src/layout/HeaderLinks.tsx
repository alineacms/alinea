'use client'

import {Styler} from 'alinea/ui'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {HeaderLink} from './Header'

export interface HeaderLinksProps {
  links: Array<HeaderLink>
  style: Styler
}

export function HeaderLinks({links, style}: HeaderLinksProps) {
  const pathname = usePathname()
  return (
    <>
      {links?.map(link => {
        switch (link.type) {
          case 'entry':
            return (
              <Link
                href={link.url}
                key={link.id}
                className={style({
                  active: pathname.startsWith(link.active || link.url)
                })}
              >
                {link.label}
              </Link>
            )
          default:
            return null
        }
      })}
      <Link
        href="/changelog"
        className={style({active: pathname.startsWith('/changelog')})}
      >
        Changelog
      </Link>
      <a href="https://demo.alinea.sh" target="_blank" className={style()}>
        Demo
      </a>
    </>
  )
}
