'use client'

import {Styler} from '@alinea/styler'
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
        switch (link._type) {
          case 'entry':
            return (
              <Link
                href={link.href}
                key={link._id}
                className={style({
                  active: pathname.startsWith(link.fields.active || link.href)
                })}
              >
                {link.fields.label}
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
