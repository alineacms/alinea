import {Config, Field} from 'alinea'
import {anchorField} from './options'

export const Steps = Config.type('Steps', {
  fields: {
    title: Field.text('Title'),
    description: Field.text('Description', {multiline: true}),
    numbered: Field.check('Numbered', {
      description: 'Show a large step number on each card'
    }),
    steps: Field.list('Steps', {
      schema: {
        Step: Config.type('Step', {
          fields: {
            title: Field.text('Title'),
            text: Field.text('Text', {multiline: true}),
            visual: Field.select('Visual', {
              initialValue: 'none',
              options: {
                none: 'None',
                code: 'Code',
                editor: 'Editor',
                commits: 'Commits'
              }
            }),
            code: Field.code('Code', {
              help: 'Shown in the code visual, or as a code chip without a visual'
            })
          }
        })
      }
    }),
    anchor: anchorField()
  }
})
