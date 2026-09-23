import type {ReactNode} from 'react'
import {I18nProvider} from 'react-aria-components'

export interface LocaleProps {
  locale?: string
  children: ReactNode
}

/** Formats the children in `locale`, or the surrounding locale if left out */
export function Locale({locale, children}: LocaleProps) {
  if (!locale) return children
  return <I18nProvider locale={locale}>{children}</I18nProvider>
}
