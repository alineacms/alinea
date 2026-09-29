import {EntryTable, useEntry} from '#/cms.js'
import {Config, Field} from '#/index.js'
import {Entry} from '#/core/Entry.js'
import type {OverviewActionProps, OverviewOptions} from '#/core/Overview.js'

/**
 * A product catalogue with overview columns: linked brands and categories,
 * a formatted price, an export action and a mixed blog with per type columns.
 */
export const Brand = Config.document('Brand', {
  // The section view adds no fields
  fields: {...(Field.view(<BrandProducts />) as {})}
})
export const Category = Config.document('Category', {fields: {}})
export const Person = Config.document('Person', {fields: {}})

export const Product = Config.document('Product', {
  fields: {
    articleNumber: Field.text('Article number'),
    categories: Field.entry.multiple('Categories', {
      condition: {_type: 'Category'}
    }),
    brand: Field.entry('Brand', {condition: {_type: 'Brand'}}),
    price: Field.number('Price'),
    stock: Field.number('Stock', {overview: true})
  }
})

export function ExportProducts({query}: OverviewActionProps) {
  return <button type="button">Export {String(query.root)}</button>
}

/** The products of the brand being edited, with the products columns */
function BrandProducts() {
  const entry = useEntry()
  if (!entry) return null
  return (
    <EntryTable
      aria-label="Products of this brand"
      type={Product}
      filter={{brand: {has: {_entry: entry.id}}}}
    />
  )
}

export const productsOverview: OverviewOptions = {
  columns: {
    articleNumber: Config.column({
      header: 'Article number',
      select: Product.articleNumber,
      width: 140,
      position: 'start'
    }),
    categories: Config.column({
      header: 'Categories',
      select: Product.categories.find({
        select: {entryId: Entry.id, title: Entry.title},
        filter: {_status: 'published'},
        orderBy: {asc: Entry.title}
      })
    }),
    brand: Config.column({
      header: 'Brand',
      select: Product.brand,
      sortBy: Product.brand.first({select: Entry.title})
    }),
    price: Config.column({
      header: 'Price',
      select: Product.price,
      align: 'end',
      width: 120,
      format: (price, {locale}) =>
        typeof price === 'number'
          ? new Intl.NumberFormat(locale ?? 'en', {
              style: 'currency',
              currency: 'EUR'
            }).format(price)
          : ''
    })
  },
  actions: [ExportProducts]
}

export const BlogPost = Config.document('BlogPost', {
  fields: {
    cover: Field.image('Cover'),
    author: Field.entry('Author', {condition: {_type: 'Person'}}),
    publishDate: Field.date('Publish date')
  }
})

export const Event = Config.document('Event', {
  fields: {
    organiser: Field.entry('Organiser', {condition: {_type: 'Person'}}),
    publishDate: Field.date('Publish date')
  }
})

export const Blog = Config.document('Blog', {
  contains: ['BlogPost', 'Event'],
  fields: {},
  overview: {
    columns: {
      author: Config.column({
        header: 'Author',
        select: {BlogPost: BlogPost.author, Event: Event.organiser},
        sortBy: {
          BlogPost: BlogPost.author.first({select: Entry.title}),
          Event: Event.organiser.first({select: Entry.title})
        }
      }),
      date: Config.column({header: 'Published', select: BlogPost.publishDate})
    },
    sort: {desc: BlogPost.publishDate},
    layout: 'cards',
    thumbnail: BlogPost.cover
  }
})

export const config = Config.create({
  schema: {Brand, Category, Person, Product, BlogPost, Event, Blog},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {
        products: Config.root('Products', {
          contains: ['Product'],
          overview: productsOverview
        }),
        brands: Config.root('Brands', {contains: ['Brand']}),
        categories: Config.root('Categories', {contains: ['Category']}),
        people: Config.root('People', {contains: ['Person']}),
        blog: Config.root('Blog', {contains: ['Blog']}),
        media: Config.media()
      }
    })
  }
})
