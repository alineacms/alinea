import {Config, Field} from 'alinea'
import {IcOutlineArticle} from '@/icons'
import {demoEntryUrl} from './DemoUrl'

export const DemoProductCallout = Config.type('Product callout', {
  fields: {
    product: Field.entry('Product', {
      required: true,
      condition: {_type: 'DemoProduct'}
    }),
    note: Field.text('Note', {
      multiline: true,
      help: 'A line on why this product fits the story'
    })
  }
})

export const DemoArticleImage = Config.type('Image', {
  fields: {
    image: Field.image('Image', {required: true}),
    caption: Field.text('Caption')
  }
})

export const DemoArticle = Config.type('Article', {
  icon: IcOutlineArticle,
  entryUrl: demoEntryUrl,
  fields: {
    ...Field.tabs(
      Field.tab('Content', {
        fields: {
          title: Field.text('Title', {width: 0.5, required: true}),
          path: Field.path('Path', {width: 0.5}),
          publishDate: Field.date('Publish date', {width: 0.5, shared: true}),
          category: Field.select('Category', {
            width: 0.5,
            shared: true,
            initialValue: 'craft',
            options: {
              craft: 'Craft',
              materials: 'Materials',
              homes: 'Homes',
              studio: 'Studio news'
            }
          }),
          author: Field.entry('Author', {
            width: 0.5,
            shared: true,
            condition: {_type: 'DemoAuthor'}
          }),
          readingTime: Field.number('Reading time', {
            width: 0.5,
            shared: true,
            help: 'In minutes'
          }),
          cover: Field.image('Cover image', {shared: true}),
          coverCredit: Field.text('Cover credit', {shared: true}),
          intro: Field.text('Intro', {multiline: true}),
          body: Field.richText('Body', {
            searchable: true,
            schema: {DemoProductCallout, DemoArticleImage}
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
