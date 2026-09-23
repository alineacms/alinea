import {Config, Field} from 'alinea'
import {demoBlocksField} from './DemoBlocks'
import {demoEntryUrl} from './DemoUrl'

export const DemoPage = Config.type('Page', {
  entryUrl: demoEntryUrl,
  fields: {
    ...Field.tabs(
      Field.tab('Content', {
        fields: {
          title: Field.text('Title', {width: 0.5, required: true}),
          path: Field.path('Path', {width: 0.5}),
          intro: Field.text('Intro', {multiline: true}),
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
