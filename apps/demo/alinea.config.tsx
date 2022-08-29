import {ReadonlyBackend} from '@alinea/backend/ReadonlyBackend'
import {createConfig, root, schema, workspace} from '@alinea/core'
import {MediaSchema} from '@alinea/dashboard/schema/MediaSchema'
import {BrowserPreview} from '@alinea/dashboard/view/preview/BrowserPreview'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPermMedia} from '@alinea/ui/icons/IcRoundPermMedia'
import {DemoHomeSchema} from './src/view/channels/home/DemoHome.schema'
import {DemoRecipedetailSchema} from './src/view/channels/recipedetail/DemoRecipedetail.schema'
import {DemoRecipesSchema} from './src/view/channels/recipes/DemoRecipes.schema'

const demoSchema = schema({
  ...MediaSchema,
  Home: DemoHomeSchema,
  Recipes: DemoRecipesSchema,
  Recipedetail: DemoRecipedetailSchema
})

const demo = workspace('Demo', {
  schema: demoSchema,
  typeNamespace: 'content',
  source: './content',
  mediaDir: './public',
  color: '#17b179',
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
    return (
      <BrowserPreview
        url={`${location}/api/preview?${previewToken}`}
        prettyUrl={entry.url}
      />
    )
  }
})

export const config = createConfig({
  workspaces: {demo},
  backend: {
    configureBackend({config, createStore}) {
      return new ReadonlyBackend({config, createStore})
    }
  }
})
