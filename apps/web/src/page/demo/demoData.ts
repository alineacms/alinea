import {Query} from 'alinea'
import {Entry} from 'alinea/core/Entry'
import type {Graph} from 'alinea/core/Graph'
import {
  DemoArticle,
  DemoAuthor,
  DemoCollection,
  DemoHome,
  DemoProduct
} from '@/schema/demo'
import {
  demoDefaultLocale,
  demoLocales,
  isDemoLocale
} from '@/schema/demo/DemoUrl'
import type {DemoLocale} from '@/schema/demo/DemoUrl'

/** The entry a demo page is rendered for */
export interface DemoTarget {
  id: string
  type: string
  locale: string | null
  /** The entry as it is being edited in the dashboard */
  preview?: Entry
}

export function targetLocale(target: DemoTarget): DemoLocale {
  return isDemoLocale(target.locale) ? target.locale : demoDefaultLocale
}

/** Query options that select the target, or its draft in the dashboard */
export function targetQuery(target: DemoTarget) {
  return {
    id: target.id,
    locale: target.locale,
    preview: target.preview ? {entry: target.preview} : undefined
  }
}

const demoLocation = {workspace: 'demo', root: 'pages'}

/**
 * Find entries by id in a locale. Entries that have not been translated yet
 * fall back to the default locale, keeping the order of the ids.
 */
async function findTranslated<Row extends {id: string}>(
  ids: Array<string>,
  locale: DemoLocale,
  find: (ids: Array<string>, locale: DemoLocale) => Promise<Array<Row>>
): Promise<Array<Row>> {
  if (ids.length === 0) return []
  const found = await find(ids, locale)
  const missing = ids.filter(id => !found.some(row => row.id === id))
  const fallback =
    missing.length && locale !== demoDefaultLocale
      ? await find(missing, demoDefaultLocale)
      : []
  const rows = found.concat(fallback)
  return ids.flatMap(id => rows.filter(row => row.id === id))
}

const productCard = {
  id: Query.id,
  url: Query.url,
  title: DemoProduct.title,
  tagline: DemoProduct.tagline,
  badge: DemoProduct.badge,
  price: DemoProduct.price,
  gallery: DemoProduct.gallery,
  finishes: DemoProduct.finishes
}

export type DemoProductCardData = Awaited<
  ReturnType<typeof findProductCards>
>[number]

export function findProductCards(
  graph: Graph,
  ids: Array<string>,
  locale: DemoLocale
) {
  return findTranslated(ids, locale, (ids, locale) =>
    graph.find({
      ...demoLocation,
      type: DemoProduct,
      id: {in: ids},
      locale,
      select: productCard
    })
  )
}

const collectionCard = {
  id: Query.id,
  url: Query.url,
  title: DemoCollection.title,
  intro: DemoCollection.intro,
  cover: DemoCollection.cover,
  products: DemoCollection.products
}

export type DemoCollectionCardData = Awaited<
  ReturnType<typeof findCollectionCards>
>[number]

export function findCollectionCards(
  graph: Graph,
  ids: Array<string>,
  locale: DemoLocale
) {
  return findTranslated(ids, locale, (ids, locale) =>
    graph.find({
      ...demoLocation,
      type: DemoCollection,
      id: {in: ids},
      locale,
      select: collectionCard
    })
  )
}

const articleCard = {
  id: Query.id,
  url: Query.url,
  locale: Query.locale,
  title: DemoArticle.title,
  intro: DemoArticle.intro,
  cover: DemoArticle.cover,
  category: DemoArticle.category,
  publishDate: DemoArticle.publishDate,
  readingTime: DemoArticle.readingTime,
  author: DemoArticle.author.first({
    select: {name: DemoAuthor.title, role: DemoAuthor.role}
  })
}

export type DemoArticleCardData = Awaited<
  ReturnType<typeof findArticleCards>
>[number]

/**
 * The latest articles in a locale, filled up with articles in the default
 * locale that have not been translated yet.
 */
export async function findArticleCards(
  graph: Graph,
  locale: DemoLocale,
  take?: number,
  exclude?: string
) {
  const all = await graph.find({
    ...demoLocation,
    type: DemoArticle,
    select: articleCard,
    orderBy: {desc: DemoArticle.publishDate}
  })
  const byId = new Map<string, (typeof all)[number]>()
  for (const article of all) {
    if (article.id === exclude) continue
    const current = byId.get(article.id)
    if (article.locale === locale || !current) byId.set(article.id, article)
  }
  const articles = Array.from(byId.values())
  return take ? articles.slice(0, take) : articles
}

export interface DemoNavItem {
  id: string
  title: string
  url: string
  active: boolean
}

export interface DemoTranslation {
  locale: DemoLocale
  url: string
  active: boolean
}

export interface DemoLayoutData {
  locale: DemoLocale
  homeUrl: string
  nav: Array<DemoNavItem>
  translations: Array<DemoTranslation>
}

export async function queryLayout(
  graph: Graph,
  target: DemoTarget
): Promise<DemoLayoutData> {
  const locale = targetLocale(target)
  const [homes, top, current, translations] = await Promise.all([
    graph.find({
      ...demoLocation,
      type: DemoHome,
      select: {locale: Query.locale, url: Query.url}
    }),
    graph.find({
      ...demoLocation,
      locale,
      parentId: null,
      select: {id: Query.id, title: Query.title, url: Query.url}
    }),
    graph.first({
      ...demoLocation,
      id: target.id,
      locale: target.locale,
      select: {parents: Entry.parents}
    }),
    graph.find({
      ...demoLocation,
      id: target.id,
      select: {locale: Query.locale, url: Query.url}
    })
  ])
  const trail = new Set([target.id, ...(current?.parents ?? [])])
  const homeOf = (locale: string) =>
    homes.find(home => home.locale === locale)?.url
  const homeUrl = homeOf(locale) ?? '/demo/site'
  return {
    locale,
    homeUrl,
    nav: top
      .filter(item => item.url !== homeUrl)
      .map(item => ({...item, active: trail.has(item.id)})),
    translations: demoLocales.flatMap(code => {
      const home = homes.find(home => home.locale === code)
      if (!home || !isDemoLocale(home.locale)) return []
      const translation = translations.find(t => t.locale === home.locale)
      return [
        {
          locale: home.locale,
          url: translation?.url ?? home.url,
          active: home.locale === locale
        }
      ]
    })
  }
}
