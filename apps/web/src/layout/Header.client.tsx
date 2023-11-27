'use client'

import {fromModule} from 'alinea/ui'
import {usePathname} from 'next/navigation'
import {PropsWithChildren} from 'react'
import css from './Header.module.scss'

const styles = fromModule(css)

export function HeaderRoot({children}: PropsWithChildren) {
  const pathname = usePathname()
  return (
    <header className={styles.root({transparent: pathname === '/'})}>
      {children}
    </header>
  )
}
