import {Schema, type} from '@alinea/core'
import {link} from '@alinea/input.link'
import {object} from '@alinea/input.object'
import {path} from '@alinea/input.path'
import {richText} from '@alinea/input.richtext'
import {text} from '@alinea/input.text'

export const DemoRecipesSchema = type('Recipes', {
  title: text('Title', {width: 0.5, multiline: true}),
  path: path('Path', {width: 0.5}),
  hero: object('Hero', {
    fields: type('Fields', {
      image: link.image('Image', {
        type: 'image'
      }),
      title: text('Title'),
      text: richText('Text'),
      button: link('Button', {type: ['entry', 'external']})
    })
  })
}).configure({isContainer: true, contains: ['Recipedetail']})

export type DemoRecipesSchema = Schema.TypeOf<typeof DemoRecipesSchema>
