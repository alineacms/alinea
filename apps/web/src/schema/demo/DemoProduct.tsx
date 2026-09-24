import {Config, Field} from 'alinea'
import {IcOutlineChair} from '@/icons'
import {DemoStockOverview} from './DemoStockOverview'
import {demoEntryUrl} from './DemoUrl'

// The Site root is translated, so every field is translated per locale unless
// it is marked shared: the value is then the same in every translation

export const DemoProduct = Config.type('Product', {
  icon: IcOutlineChair,
  entryUrl: demoEntryUrl,
  fields: {
    ...Field.tabs(
      Field.tab('Product', {
        fields: {
          title: Field.text('Name', {width: 0.5, required: true}),
          path: Field.path('Path', {width: 0.5}),
          tagline: Field.text('Tagline', {
            help: 'One line shown under the name on product cards'
          }),
          badge: Field.text('Badge', {
            help: 'Short label on the product card, eg. "New" or "Made to order"'
          }),
          gallery: Field.image.multiple('Gallery', {shared: true}),
          description: Field.richText('Description')
        }
      }),
      Field.tab('Pricing & stock', {
        fields: {
          price: Field.number('Price', {
            width: 0.5,
            shared: true,
            minValue: 0,
            help: 'In euro, including VAT'
          }),
          leadTime: Field.number('Lead time', {
            width: 0.5,
            shared: true,
            minValue: 0,
            help: 'Weeks to make an item once ordered'
          }),
          inStock: Field.check('Available', {
            shared: true,
            description: 'Show this product as available to order'
          }),
          ...Field.view(<DemoStockOverview />),
          finishes: Field.list('Finishes', {
            schema: {
              DemoFinish: Config.type('Finish', {
                fields: {
                  name: Field.text('Name'),
                  swatch: Field.text('Swatch', {
                    width: 1 / 3,
                    placeholder: '#c8a47e'
                  }),
                  stock: Field.number('In stock', {width: 1 / 3, minValue: 0}),
                  surcharge: Field.number('Surcharge', {
                    width: 1 / 3,
                    minValue: 0
                  })
                }
              })
            }
          })
        }
      }),
      Field.tab('Details', {
        fields: {
          material: Field.select('Material', {
            width: 0.5,
            shared: true,
            options: {
              oak: 'Solid oak',
              walnut: 'Solid walnut',
              ash: 'Ash',
              ceramic: 'Glazed stoneware',
              linen: 'Belgian linen',
              cane: 'Oak and woven cane'
            }
          }),
          designer: Field.text('Designer', {width: 0.5, shared: true}),
          dimensions: Field.object('Dimensions', {
            shared: true,
            fields: {
              width: Field.number('Width', {width: 0.25, help: 'cm'}),
              depth: Field.number('Depth', {width: 0.25, help: 'cm'}),
              height: Field.number('Height', {width: 0.25, help: 'cm'}),
              weight: Field.number('Weight', {width: 0.25, help: 'kg'})
            }
          }),
          care: Field.text('Care', {multiline: true}),
          related: Field.entry.multiple('Related articles', {
            shared: true,
            condition: {_type: 'DemoArticle'}
          })
        }
      }),
      Field.tab('SEO', {
        fields: {
          metadata: Field.metadata()
        }
      })
    )
  }
})
