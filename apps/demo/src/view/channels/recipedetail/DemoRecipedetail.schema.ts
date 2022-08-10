import {Schema, type} from '@alinea/core'
import {link} from '@alinea/input.link'
import {path} from '@alinea/input.path'
import {richText} from '@alinea/input.richtext'
import {select} from '@alinea/input.select'
import {text} from '@alinea/input.text'
import {DemoBlocksSchema} from '../../blocks/DemoBlocks.schema'

export const DemoRecipedetailSchema = type('Recipedetail', {
  title: text('Title', {width: 0.5, multiline: true}),
  path: path('Path', {width: 0.5}),
  image: link.image('Image', {
    type: 'image'
  }),
  category: select('Type', {
    appetizer: 'Appetizer',
    main_cours: 'Main course',
    dessert: 'Dessert'
  }),
  intro: richText('Intro'),
  blocks: DemoBlocksSchema
})

export type DemoRecipedetailSchema = Schema.TypeOf<
  typeof DemoRecipedetailSchema
>
