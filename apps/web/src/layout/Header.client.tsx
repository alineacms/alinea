'use client'

import {fromModule} from 'alinea/ui'
import {usePathname} from 'next/navigation'
import {HTMLAttributes, PropsWithChildren, useEffect} from 'react'
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

export function MobileMenu({
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  const pathname = usePathname()
  useEffect(() => {
    const checkbox = document.getElementById('mobilemenu')! as HTMLInputElement
    checkbox.checked = false
  }, [pathname])
  return <div {...props}>{children}</div>
}
