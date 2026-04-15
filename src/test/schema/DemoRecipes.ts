import {Config, Field} from '#/index.js'

export const DemoRecipes = Config.type('Recipes', {
  contains: ['DemoRecipe'],
  fields: {
    title: Field.text('Title', {width: 0.5, multiline: true}),
    path: Field.path('Path', {width: 0.5})
  }
})
