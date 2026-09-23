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
    badge: Field.text('Header badge', {
      width: 0.5,
      help: 'Shown next to the logo in the header, eg. "Cloud"'
    }),
    hero: Field.object('Hero', {
      fields: {
        badge: Field.text('Badge', {
          help: 'Short pill shown above the headline'
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
