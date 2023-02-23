import {ReadonlyBackend} from 'alinea/backend/ReadonlyBackend'
import {createConfig, root, schema, workspace} from 'alinea/core'
import {MediaSchema} from 'alinea/dashboard/schema/MediaSchema'
import {BrowserPreview} from 'alinea/dashboard/view/preview/BrowserPreview'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import {DemoHomeSchema} from './src/view/home/DemoHome.schema'
import {RecipeSchema} from './src/view/recipe/Recipe.schema'
import {DemoRecipesSchema} from './src/view/recipes/DemoRecipes.schema'

const demoSchema = schema({
  ...MediaSchema,
  Home: DemoHomeSchema,
  Recipes: DemoRecipesSchema,
  Recipe: RecipeSchema
})

const demo = workspace('Demo', {
  typeNamespace: 'content',
  source: './content',
  mediaDir: './public',
  color: '#B698B0',
  roots: {
    data: root('Demo website', {
      icon: IcRoundInsertDriveFile,
      contains: ['Home', 'Recipes']
    }),
    media: root('Media', {
      icon: IcRoundPermMedia,
      contains: ['MediaLibrary']
    })
  },
  preview({entry, previewToken}) {
    const location =
      process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ''
    if (entry.type === 'Recipes') return null
    return (
      <BrowserPreview
        url={`${location}/api/preview?${previewToken}`}
        prettyUrl={entry.url}
      />
    )
  }
})

export const config = createConfig({
  schema: demoSchema,
  workspaces: {demo},
  backend: {
    configureBackend({config, createStore}) {
      return new ReadonlyBackend({config, createStore})
    }
  }
})
