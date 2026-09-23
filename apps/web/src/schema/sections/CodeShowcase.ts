import {Config, Field} from 'alinea'
import {anchorField, checksField, labeledLink} from './options'

export const CodeShowcase = Config.type('Code showcase', {
  fields: {
    ...Field.tabs(
      Field.tab('Content', {
        fields: {
          title: Field.text('Title'),
          text: Field.text('Text', {multiline: true}),
          checks: checksField(),
          link: labeledLink('Link')
        }
      }),
      Field.tab('Code', {
        fields: {
          filename: Field.text('File name'),
          code: Field.code('Code'),
          tooltip: Field.code('Tooltip', {
            help: 'Type information shown floating over the code'
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
