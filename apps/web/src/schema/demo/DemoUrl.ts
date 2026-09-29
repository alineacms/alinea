import type {EntryUrlMeta} from 'alinea/core/Type'

/** Locales of the demo site, the first one is the default */
export const demoLocales = ['en', 'nl', 'fr'] as const

export type DemoLocale = (typeof demoLocales)[number]

export const demoDefaultLocale: DemoLocale = 'en'

/** The demo site is served under this path */
export const demoBaseUrl = '/demo/site'

export function isDemoLocale(value: unknown): value is DemoLocale {
  return demoLocales.includes(value as DemoLocale)
}

/**
 * Urls of the demo site: `/demo/site/products/ferris-dining-table` for the
 * default locale and `/demo/site/nl/producten/...` for the others.
 */
export function demoEntryUrl({locale, parentPaths, path}: EntryUrlMeta) {
  const prefix = locale && locale !== demoDefaultLocale ? [locale] : []
  const segments = prefix
    .concat(parentPaths, path)
    .filter(segment => segment && segment !== 'index')
  return [demoBaseUrl, ...segments].join('/')
}
