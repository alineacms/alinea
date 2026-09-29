import {Config, Field} from 'alinea'
import {IcRoundCode} from 'alinea/ui/icons/IcRoundCode'

export const CodeTextBlock = Config.type('Code & text', {
  icon: IcRoundCode,
  fields: {
    code: Field.code('Code', {width: 0.75}),
    codePosition: Field.select('Code position', {
      width: 0.25,
      options: {
        left: 'Left',
        right: 'Right'
      }
    }),
    title: Field.text('Title'),
    description: Field.richText('Description'),
    button: Field.link('Button', {
      fields: {
        label: Field.text('Button label')
      }
    })
  }
})
