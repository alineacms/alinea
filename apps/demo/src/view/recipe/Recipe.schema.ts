import {type} from 'alinea/core'
import {link} from 'alinea/input/link'
import {object} from 'alinea/input/object'
import {path} from 'alinea/input/path'
import {richText} from 'alinea/input/richtext'
import {text} from 'alinea/input/text'

export const RecipeSchema = type('Recipe', {
  title: text('Title', {width: 0.5, multiline: true}),
  path: path('Path', {width: 0.5}),
  header: object('Header', {
    fields: type('Image fields', {
      image: link.image('Image', {inline: true}),
      credit: richText('Credit')
    })
  }),
  intro: richText('Intro'),
  ingredients: richText('Ingredients'),
  instructions: richText('Instructions')
})
