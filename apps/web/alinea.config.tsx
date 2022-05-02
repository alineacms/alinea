import {createConfig, root, schema, workspace} from '@alinea/core'
import {LocaleSchema} from '@alinea/dashboard/schema/LocaleSchema.js'
import {MediaSchema} from '@alinea/dashboard/schema/MediaSchema.js'
import {BrowserPreview} from '@alinea/dashboard/view/preview/BrowserPreview.js'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPermMedia} from '@alinea/ui/icons/IcRoundPermMedia'
import {DocPageSchema} from './src/view/DocPage.schema'
import {DocsPageSchema} from './src/view/DocsPage.schema'
import {HomePageSchema} from './src/view/HomePage.schema'

export const webSchema = schema({
  ...MediaSchema,
  Home: HomePageSchema,
  Docs: DocsPageSchema,
  Doc: DocPageSchema
})

const web = workspace('Alinea', {
  schema: webSchema,
  source: './content',
  mediaDir: './public',
  color: '#5661E5', // '#EF437C',
  roots: {
    data: root('Alinea website', {
      icon: IcRoundInsertDriveFile,
      contains: ['Home', 'Docs']
    }),
    media: root('Media', {
      icon: IcRoundPermMedia,
      contains: ['MediaLibrary']
    })
  },
  preview({entry, previewToken}) {
    const noPreviews = new Set(['Docs', 'MediaLibrary'])
    if (noPreviews.has(entry.type)) return null
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

const stories = workspace('Stories', {
  schema: webSchema.concat(schema(LocaleSchema)),
  source: './content/stories',
  color: '#EF437C',
  roots: {
    data: root('Stories', {
      icon: IcRoundInsertDriveFile,
      contains: ['Home', 'Docs'],
      i18n: {
        locales: ['nl', 'fr']
      }
    })
  }
})

const workspaces = {web, stories}

export const config = createConfig({
  workspaces:
    process.env.NODE_ENV === 'development'
      ? workspaces
      : ({web} as typeof workspaces)
})
