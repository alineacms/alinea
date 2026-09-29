import {Config, Field} from 'alinea'
import {anchorField} from './options'

export const Faq = Config.type('FAQ', {
  fields: {
    title: Field.text('Title'),
    text: Field.richText('Text'),
    items: Field.list('Questions', {
      help: 'The first question is shown open',
      schema: {
        Question: Config.type('Question', {
          fields: {
            question: Field.text('Question'),
            answer: Field.richText('Answer')
          }
        })
      }
    }),
    anchor: anchorField()
  }
})
