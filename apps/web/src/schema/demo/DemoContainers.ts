import {Config, Field} from 'alinea'
import {
  IcOutlineAutoStories,
  IcOutlineChair,
  IcOutlineCollectionsBookmark
} from '@/icons'
import {DemoProduct} from './DemoProduct'
import {demoEntryUrl} from './DemoUrl'

const euro = new Intl.NumberFormat('en-BE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0
})

interface FinishStock {
  stock?: number | null
}

function containerFields() {
  return {
    title: Field.text('Title', {width: 0.5, required: true}),
    path: Field.path('Path', {width: 0.5}),
    intro: Field.text('Intro', {multiline: true}),
    metadata: Field.metadata('SEO')
  }
}

export const DemoProducts = Config.type('Products', {
  icon: IcOutlineChair,
  entryUrl: demoEntryUrl,
  contains: ['DemoProduct'],
  defaultView: 'overview',
  fields: containerFields(),
  overview: {
    columns: {
      image: Config.column({
        header: 'Image',
        width: 72,
        collapsible: false,
        select: DemoProduct.gallery,
        sortable: false
      }),
      price: Config.column({
        header: 'Price',
        width: 110,
        align: 'end',
        select: DemoProduct.price,
        format: price => (typeof price === 'number' ? euro.format(price) : '')
      }),
      material: Config.column({
        header: 'Material',
        select: DemoProduct.material
      }),
      stock: Config.column({
        header: 'Stock',
        width: 130,
        align: 'end',
        select: DemoProduct.finishes,
        sortBy: DemoProduct.inStock,
        format(finishes: Array<FinishStock>) {
          const total = finishes.reduce(
            (sum, finish) => sum + (finish.stock ?? 0),
            0
          )
          return total > 0 ? `${total} in stock` : 'Made to order'
        }
      })
    }
  }
})

export const DemoCollections = Config.type('Collections', {
  icon: IcOutlineCollectionsBookmark,
  entryUrl: demoEntryUrl,
  contains: ['DemoCollection'],
  fields: containerFields()
})

export const DemoJournal = Config.type('Journal', {
  icon: IcOutlineAutoStories,
  entryUrl: demoEntryUrl,
  contains: ['DemoArticle'],
  fields: containerFields()
})
