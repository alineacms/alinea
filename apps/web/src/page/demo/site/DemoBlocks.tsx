import type {Infer} from 'alinea'
import type {Graph} from 'alinea/core/Graph'
import type {demoBlocksField} from '@/schema/demo/DemoBlocks'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import {
  type DemoArticleCardData,
  type DemoCollectionCardData,
  type DemoProductCardData,
  findArticleCards,
  findCollectionCards,
  findProductCards
} from '../demoData'
import styler from '@alinea/styler'
import css from './DemoBlocks.module.scss'
import {DemoCollectionGrid} from './DemoCollectionGrid'
import {DemoFeaturedProducts} from './DemoFeaturedProducts'
import {DemoHero} from './DemoHero'
import {DemoJournalTeaser} from './DemoJournalTeaser'
import {DemoNewsletter} from './DemoNewsletter'
import {DemoQuote} from './DemoQuote'
import {DemoStores} from './DemoStores'
import {DemoStory} from './DemoStory'

const styles = styler(css)

export type DemoBlocksData = Infer<ReturnType<typeof demoBlocksField>>

export interface DemoBlocksProps {
  locale: DemoLocale
  blocks: DemoBlocksData | null | undefined
  products: Array<DemoProductCardData>
  collections: Array<DemoCollectionCardData>
  articles: Array<DemoArticleCardData>
}

function pick<Card extends {id: string}>(
  cards: Array<Card>,
  links: Array<{entryId: string}> | null | undefined
) {
  return (links ?? []).flatMap(link =>
    cards.filter(card => card.id === link.entryId)
  )
}

/** Renders the blocks of the page builder field */
export function DemoBlocks({
  locale,
  blocks,
  products,
  collections,
  articles
}: DemoBlocksProps) {
  if (!blocks?.length) return null
  // The newsletter block brings its own spacing towards the footer
  const endsWithPanel = blocks.at(-1)?._type === 'DemoNewsletterBlock'
  return (
    <>
      {blocks.map((block, index) => renderBlock(block, index))}
      {!endsWithPanel && <div className={styles.DemoBlocks.end()} />}
    </>
  )
  function renderBlock(block: DemoBlocksData[number], index: number) {
    switch (block._type) {
      case 'DemoHeroBlock':
        return <DemoHero key={block._id} {...block} first={index === 0} />
      case 'DemoFeaturedProductsBlock':
        return (
          <DemoFeaturedProducts
            key={block._id}
            {...block}
            locale={locale}
            cards={pick(products, block.products)}
          />
        )
      case 'DemoCollectionGridBlock':
        return (
          <DemoCollectionGrid
            key={block._id}
            {...block}
            locale={locale}
            cards={pick(collections, block.collections)}
          />
        )
      case 'DemoStoryBlock':
        return <DemoStory key={block._id} {...block} locale={locale} />
      case 'DemoQuoteBlock':
        return <DemoQuote key={block._id} {...block} />
      case 'DemoJournalTeaserBlock':
        return (
          <DemoJournalTeaser
            key={block._id}
            {...block}
            locale={locale}
            articles={articles}
          />
        )
      case 'DemoStoresBlock':
        return <DemoStores key={block._id} {...block} />
      case 'DemoNewsletterBlock':
        return <DemoNewsletter key={block._id} {...block} locale={locale} />
      default:
        return null
    }
  }
}

/** Loads the products, collections and articles the blocks refer to */
DemoBlocks.query = async (
  graph: Graph,
  blocks: DemoBlocksData | null | undefined,
  locale: DemoLocale
): Promise<DemoBlocksProps> => {
  const list = blocks ?? []
  const productIds = list.flatMap(block =>
    block._type === 'DemoFeaturedProductsBlock'
      ? (block.products ?? []).map(link => link.entryId)
      : []
  )
  const collectionIds = list.flatMap(block =>
    block._type === 'DemoCollectionGridBlock'
      ? (block.collections ?? []).map(link => link.entryId)
      : []
  )
  const hasJournal = list.some(
    block => block._type === 'DemoJournalTeaserBlock'
  )
  const [products, collections, articles] = await Promise.all([
    findProductCards(graph, productIds, locale),
    findCollectionCards(graph, collectionIds, locale),
    hasJournal ? findArticleCards(graph, locale, 6) : []
  ])
  return {locale, blocks: list, products, collections, articles}
}
