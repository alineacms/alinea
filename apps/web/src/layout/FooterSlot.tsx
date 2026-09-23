'use client'

import {usePathname} from 'next/navigation'
import type {PropsWithChildren} from 'react'
import {isDocsPath} from '@/utils/docs'

/**
 * The site footer is left out on docs pages: the docs sidebar sticks to the
 * viewport and the content column ends with its own compact footer
 */
export function FooterSlot({children}: PropsWithChildren) {
  const pathname = usePathname()
  if (isDocsPath(pathname)) return null
  return children
}
