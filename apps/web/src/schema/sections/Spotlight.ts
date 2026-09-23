import {Config, Field} from 'alinea'
import {anchorField, checksField, labeledLink} from './options'

export const Spotlight = Config.type('Spotlight', {
  fields: {
    ...Field.tabs(
      Field.tab('Content', {
        fields: {
          heading: Field.text('Section title', {
            width: 0.5,
            help: 'Optional title shown above the panel'
          }),
          intro: Field.text('Section description', {
            width: 0.5,
            multiline: true
          }),
          label: Field.text('Label', {width: 0.5}),
          title: Field.text('Title', {multiline: true}),
          text: Field.text('Text', {multiline: true}),
          checks: checksField(),
          link: labeledLink('Link')
        }
      }),
      Field.tab('Illustration', {
        fields: {
          illustration: Field.select('Illustration', {
            initialValue: 'none',
            options: {
              none: 'None',
              publishFlow: 'Publish flow'
            }
          }),
          snippets: Field.list('Snippets', {
            schema: {
              Snippet: Config.type('Snippet', {
                fields: {
                  filename: Field.text('File name'),
                  code: Field.code('Code')
                }
              })
            }
          })
        }
      }),
      Field.tab('Settings', {
        fields: {
          anchor: anchorField()
        }
      })
    )
  }
})
