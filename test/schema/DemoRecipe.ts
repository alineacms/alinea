import {Config, Field} from 'alinea'

export const DemoRecipe = Config.type('Recipe', {
  fields: {
    title: Field.text('Title', {width: 0.5, multiline: true}),
    path: Field.path('Path', {width: 0.5}),
    header: Field.object('Header', {
      fields: {
        image: Field.image('Image', {inline: true}),
        credit: Field.richText('Credit')
      }
    }),
    intro: Field.richText('Intro'),
    ingredients: Field.richText('Ingredients'),
    instructions: Field.richText('Instructions')
  }
})
