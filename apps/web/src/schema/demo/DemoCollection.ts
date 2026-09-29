import {Config, Field} from 'alinea'
import {IcOutlineCollectionsBookmark} from '@/icons'
import {demoEntryUrl} from './DemoUrl'

export const DemoCollection = Config.type('Collection', {
  icon: IcOutlineCollectionsBookmark,
  entryUrl: demoEntryUrl,
  fields: {
    ...Field.tabs(
      Field.tab('Content', {
        fields: {
          title: Field.text('Title', {width: 0.5, required: true}),
          path: Field.path('Path', {width: 0.5}),
          intro: Field.text('Intro', {multiline: true}),
          cover: Field.image('Cover image', {shared: true}),
          products: Field.entry.multiple('Products', {
            shared: true,
            condition: {_type: 'DemoProduct'}
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
