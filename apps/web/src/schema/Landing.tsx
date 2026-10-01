import {Config, Field} from 'alinea'
import {labeledLink} from './sections/options'
import {sectionsField} from './sections/sections'

export const Landing = Config.document('Landing', {
  fields: {
    theme: Field.select('Theme', {
      width: 0.5,
      initialValue: 'light',
      options: {
        light: 'Light (site default)',
        dark: 'Dark'
      }
    }),
    hero: Field.object('Hero', {
      fields: {
        badge: Field.text('Badge', {
          help: 'Short marker shown below the buttons, eg. Beta'
        }),
        headline: Field.text('Headline', {
          multiline: true,
          required: true,
          help: 'Wrap text in *asterisks* to render it in the accent color'
        }),
        text: Field.text('Text', {multiline: true}),
        button: labeledLink('Button', 0.5),
        link: labeledLink('Link', 0.5)
      }
    }),
    sections: sectionsField()
  }
})
