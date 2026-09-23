import type {Graph} from 'alinea/core/Graph'
import type {ReactNode} from 'react'
import {type DemoTarget, queryLayout} from './demoData'
import {DemoArticlePage} from './pages/DemoArticlePage'
import {DemoCollectionPage} from './pages/DemoCollectionPage'
import {DemoCollectionsPage} from './pages/DemoCollectionsPage'
import {DemoGenericPage} from './pages/DemoGenericPage'
import {DemoHomePage} from './pages/DemoHomePage'
import {DemoJournalPage} from './pages/DemoJournalPage'
import {DemoProductPage} from './pages/DemoProductPage'
import {DemoProductsPage} from './pages/DemoProductsPage'
import {DemoSite} from './site/DemoSite'

type DemoPageRenderer = (graph: Graph, target: DemoTarget) => Promise<ReactNode>

function page<Props extends object>(
  Component: ((props: Props) => ReactNode) & {
    query(graph: Graph, target: DemoTarget): Promise<Props>
  }
): DemoPageRenderer {
  return async (graph, target) => {
    const props = await Component.query(graph, target)
    return <Component {...props} />
  }
}

/** Page components of the demo site, keyed by entry type */
const demoPages: Record<string, DemoPageRenderer> = {
  DemoHome: page(DemoHomePage),
  DemoPage: page(DemoGenericPage),
  DemoProducts: page(DemoProductsPage),
  DemoProduct: page(DemoProductPage),
  DemoCollections: page(DemoCollectionsPage),
  DemoCollection: page(DemoCollectionPage),
  DemoJournal: page(DemoJournalPage),
  DemoArticle: page(DemoArticlePage)
}

export function hasDemoPage(type: string) {
  return type in demoPages
}

/**
 * Queries and renders a demo page, including the site header and footer.
 * Used by the site route and by the inline preview in the demo dashboard.
 */
export async function renderDemoPage(
  graph: Graph,
  target: DemoTarget
): Promise<ReactNode> {
  const render = demoPages[target.type]
  if (!render) return null
  const [layout, content] = await Promise.all([
    queryLayout(graph, target),
    render(graph, target)
  ])
  return <DemoSite layout={layout}>{content}</DemoSite>
}
