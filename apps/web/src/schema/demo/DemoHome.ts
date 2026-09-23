import {Config, Field} from 'alinea'
import {IcOutlineHome} from '@/icons'
import {demoBlocksField} from './DemoBlocks'
import {demoEntryUrl} from './DemoUrl'

export const DemoHome = Config.type('Home', {
  icon: IcOutlineHome,
  entryUrl: demoEntryUrl,
  fields: {
    ...Field.tabs(
      Field.tab('Content', {
        fields: {
          title: Field.text('Title', {width: 0.5, required: true}),
          path: Field.path('Path', {width: 0.5}),
          blocks: demoBlocksField()
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
