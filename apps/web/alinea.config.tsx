import {createConfig, root, schema, workspace} from '@alinea/core'
import {MediaSchema} from '@alinea/dashboard/schema/MediaSchema.js'
import {BrowserPreview} from '@alinea/dashboard/view/preview/BrowserPreview.js'
import {MdInsertDriveFile, MdOutlinePermMedia} from 'react-icons/md/index.js'
import {DocPageSchema} from './src/view/DocPage.schema'
import {DocsPageSchema} from './src/view/DocsPage.schema'
import {HomePageSchema} from './src/view/HomePage.schema'

export const webSchema = schema({
  ...MediaSchema,
  Home: HomePageSchema,
  Docs: DocsPageSchema,
  Doc: DocPageSchema
})

export const config = createConfig({
  workspaces: {
    web: workspace('Alinea', {
      schema: webSchema,
      source: './content',
      mediaDir: './public',
      color: '#EF437C',
      roots: {
        data: root('Alinea website', {
          icon: MdInsertDriveFile,
          contains: ['Home']
        }),
        media: root('Media', {
          icon: MdOutlinePermMedia,
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
  }
})
